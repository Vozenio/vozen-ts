/**
 * Real `claude` CLI child process bridge. Spawns Claude Code in
 * `-p --input-format=stream-json --output-format=stream-json` mode — the
 * same non-interactive "Agent SDK" stream-json protocol bb's own Claude
 * bridge uses (see bb-packages/provider-bridge-protocol/recordings/
 * claude-code/, where the manifest tags the CLI itself as "Agent SDK
 * 0.3.197" — that's the CLI's internal version label, not a separate npm
 * package bb links against; there's no such dependency in bb-app's own
 * package.json).
 *
 * Verified empirically against the installed `claude` CLI (2.1.231):
 * spawned once with a persistent stdin pipe, it stays alive across
 * multiple stream-json input lines (one per turn) — the same persistent,
 * multi-turn process model as `codex app-server`, not a fresh spawn per
 * message.
 *
 * Translates Claude's NDJSON events (system/init, assistant, user
 * [tool_result], result) into codex's own notification vocabulary
 * (turn/started, item/started, item/agentMessage/delta, item/completed,
 * turn/completed) so engine.ts's existing persistence/timeline pipeline —
 * built for codex — drives Claude threads with zero changes there.
 *
 * Permission mode is `acceptEdits`, not bb's real `permissionMode:
 * "accept-edits", permissionEscalation: "ask"` pair — verified empirically
 * (spawned the real CLI both ways) that `-p`/stream-json ("print") mode has
 * no interactive escalation channel at all: every permission decision is
 * resolved synchronously by the CLI itself before the next event is even
 * emitted, with no request/response round-trip a bridge could hook into.
 * `--permission-mode manual` doesn't pause and wait either — it just
 * auto-denies every non-trivial tool call outright (confirmed: a Bash
 * `touch` inside an *allowed* directory still came back as a
 * `permission_denied` system event, synchronously, no pending state).
 * `acceptEdits` auto-approves in-workspace file edits/commands and
 * auto-denies (not hangs, not silently allows) anything wider — e.g. an
 * outbound `curl` came back `permission_denied: "This command requires
 * approval"` immediately. That's strictly narrower than
 * `bypassPermissions` (which QA measured letting a network `curl` through
 * with a real 200) but still not bb's real per-call interactive review:
 * there is no `onApprovalRequest`-style callback here because the CLI in
 * this mode never asks, it just decides. Upgrade path: bb's actual
 * interactive flow needs a different invocation of the CLI than `-p`
 * script mode — out of scope for this fix, flagged for whoever picks up
 * real approval UI for Claude threads.
 *
 * ponytail: assistant text arrives as one complete message per turn, not
 * token-level deltas — this bridge doesn't pass whatever flag (if any)
 * would expose incremental generation. The whole message is fed through
 * the delta path as a single delta, so the render is correct but doesn't
 * grow character-by-character like codex's does. Upgrade path: check for
 * a partial-message flag if the live-typing feel is worth chasing.
 */

export class ClaudeAppServerError extends Error {}

type Notification = (method: string, params: unknown) => void;
type OnExit = () => void;

interface ToolCallState {
  itemId: string;
  turnId: string;
  name: string;
  input: unknown;
}

async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        yield buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
      }
    }
    if (buffer) yield buffer;
  } finally {
    reader.releaseLock();
  }
}

/** Claude Code's own built-in tool names — same three-bucket
 * classification as herdrThreadRegistry.ts's classifyClaudeTool(), which
 * exists for the exact same reason (mapping a Claude tool_use onto
 * codex's commandExecution/fileChange/mcpToolCall item vocabulary). Not
 * imported from there: that one lives in the server app and returns
 * bb's work_kind strings ("command"/"file-change"/"tool"); this one
 * returns codex's own item.type strings, a different vocabulary the
 * shared logic doesn't warrant a cross-package dependency for. */
function classifyClaudeTool(name: string): "commandExecution" | "fileChange" | "mcpToolCall" {
  if (name === "Bash" || name === "BashOutput" || name === "KillShell") return "commandExecution";
  if (name === "Write" || name === "Edit" || name === "MultiEdit" || name === "NotebookEdit") return "fileChange";
  return "mcpToolCall";
}

function claudeEditDiff(input: Record<string, unknown>): string | null {
  if (typeof input.old_string !== "string" || typeof input.new_string !== "string") return null;
  const removed = input.old_string.split("\n").map((line) => `-${line}`);
  const added = input.new_string.split("\n").map((line) => `+${line}`);
  return [...removed, ...added].join("\n");
}

function toolResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => (block && typeof block === "object" && (block as Record<string, unknown>).type === "text"
      ? String((block as Record<string, unknown>).text ?? "")
      : ""))
    .join("\n");
}

export class ClaudeAppServerClient {
  private readonly onNotification: Notification;
  private readonly onExit?: OnExit;
  private process: import("bun").Subprocess<"pipe", "pipe", "pipe"> | null = null;
  private sessionId: string | null = null;
  private currentTurnId: string | null = null;
  private readonly pendingTools = new Map<string, ToolCallState>();
  private readonly stderrTail: string[] = [];

  constructor(
    onNotification: Notification,
    // Codex's client also takes an onRequest (approval requests) — Claude
    // approvals are bypassed outright (see class doc), so there is never
    // one to forward. Kept as a parameter anyway so a call site written
    // against CodexAppServerClient's shape still lines up positionally.
    _onRequest?: unknown,
    onExit?: OnExit,
    private readonly spawnOptions: { command?: string[]; env?: Record<string, string> } = {},
  ) {
    this.onNotification = onNotification;
    this.onExit = onExit;
  }

  /** No separate handshake in Claude's stream-json protocol — the
   * equivalent of codex's `initialize` request happens implicitly on
   * spawn. Kept as a method so runThreadStart's `await client.initialize()`
   * call site needs no provider-specific branch. */
  async initialize(): Promise<void> {}

  /** Returns a synthetic id immediately — verified empirically that the
   * real CLI stays silent (bar unrelated SessionStart hook chatter) until
   * it receives its *first* stream-json input line, only then emitting
   * `system/init` with its own real session_id. Waiting for that here
   * would deadlock: nothing engine.ts does between threadStart() and the
   * first turnStart() would ever supply that first line. providerThreadId
   * is never read back by turnStart/turnSteer below (the process is
   * already bound via `this.process`), so a synthetic id costs nothing —
   * the real session_id, once observed, lands in `this.sessionId` purely
   * for stderrTailText-style debugging. */
  async threadStart(cwd: string, _approvalPolicy = "never"): Promise<string> {
    const command = this.spawnOptions.command ?? [
      "claude", "-p",
      "--input-format=stream-json", "--output-format=stream-json", "--verbose",
      "--permission-mode", "acceptEdits",
    ];
    this.process = Bun.spawn(command, {
      cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe",
      env: this.spawnOptions.env ? { ...process.env, ...this.spawnOptions.env } : undefined,
    });
    this.readLoop();
    this.readStderr();
    return `claude-${crypto.randomUUID()}`;
  }

  private async readLoop(): Promise<void> {
    if (!this.process) return;
    for await (const rawLine of readLines(this.process.stdout as ReadableStream<Uint8Array>)) {
      const line = rawLine.trim();
      if (!line) continue;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line);
      } catch {
        continue; // stray non-protocol stdout traffic is ignored, same as codex's client
      }
      this.handleEvent(event);
    }
    this.onExit?.();
  }

  private async readStderr(): Promise<void> {
    if (!this.process) return;
    for await (const line of readLines(this.process.stderr as ReadableStream<Uint8Array>)) {
      this.stderrTail.push(line);
      if (this.stderrTail.length > 20) this.stderrTail.shift();
    }
  }

  private handleEvent(event: Record<string, unknown>): void {
    const type = event.type;
    if (type === "system" && event.subtype === "init") {
      this.sessionId = String(event.session_id ?? "");
      return;
    }
    if (type === "assistant") {
      this.handleAssistantEvent(event);
      return;
    }
    if (type === "user") {
      this.handleUserEvent(event);
      return;
    }
    if (type === "result") {
      this.handleResultEvent(event);
    }
  }

  private handleAssistantEvent(event: Record<string, unknown>): void {
    const turnId = this.currentTurnId;
    if (!turnId) return;
    const message = (event.message as Record<string, unknown>) ?? {};
    const content = message.content;
    if (!Array.isArray(content)) return;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string" && b.text) {
        // No native id on a text block — synthesize one that's globally
        // unique (crypto.randomUUID(), not a per-instance counter), since
        // timeline_rows.id is a global primary key shared across every
        // thread's ClaudeAppServerClient instance, not scoped per-thread.
        const itemId = `claude-item-${crypto.randomUUID()}`;
        const item = { id: itemId, type: "agentMessage", text: b.text };
        this.onNotification("item/started", { turnId, itemId, item: { ...item, text: "" } });
        this.onNotification("item/agentMessage/delta", { turnId, itemId, delta: b.text });
        this.onNotification("item/completed", { turnId, itemId, item });
        continue;
      }
      if (b.type === "tool_use" && typeof b.id === "string" && typeof b.name === "string") {
        // Use Claude's own tool_use id (a real toolu_... — globally unique
        // by construction) instead of synthesizing one — this *is* the id
        // that comes back on the matching tool_result, so reusing it also
        // means no separate id-correlation bookkeeping is needed here.
        const itemId = b.id;
        this.pendingTools.set(b.id, { itemId, turnId, name: b.name, input: b.input });
        const kind = classifyClaudeTool(b.name);
        const startedItem: Record<string, unknown> = kind === "commandExecution"
          ? { id: itemId, type: kind, status: "inProgress", command: (b.input as Record<string, unknown>)?.command ?? b.name, cwd: null }
          : kind === "fileChange"
          ? { id: itemId, type: kind, status: "inProgress", changes: [] }
          : { id: itemId, type: kind, status: "inProgress", tool: b.name, arguments: b.input };
        this.onNotification("item/started", { turnId, itemId, item: startedItem });
      }
    }
  }

  private handleUserEvent(event: Record<string, unknown>): void {
    const message = (event.message as Record<string, unknown>) ?? {};
    const content = message.content;
    if (!Array.isArray(content)) return;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (b.type !== "tool_result" || typeof b.tool_use_id !== "string") continue;
      const pending = this.pendingTools.get(b.tool_use_id);
      if (!pending) continue;
      this.pendingTools.delete(b.tool_use_id);
      const isError = b.is_error === true;
      const output = toolResultText(b.content);
      const input = (pending.input && typeof pending.input === "object" ? pending.input : {}) as Record<string, unknown>;
      const kind = classifyClaudeTool(pending.name);
      const completedItem: Record<string, unknown> = kind === "commandExecution"
        ? {
          id: pending.itemId, type: kind, status: isError ? "failed" : "completed",
          command: typeof input.command === "string" ? input.command : pending.name,
          cwd: null, aggregatedOutput: output, exitCode: isError ? 1 : 0, durationMs: null,
        }
        : kind === "fileChange"
        ? {
          id: pending.itemId, type: kind, status: isError ? "failed" : "completed",
          changes: [{ path: typeof input.file_path === "string" ? input.file_path : "", kind: "edit", diff: claudeEditDiff(input) }],
        }
        : {
          id: pending.itemId, type: kind, status: isError ? "failed" : "completed",
          server: null, tool: pending.name, arguments: input, result: output, error: isError ? output : null, durationMs: null,
        };
      this.onNotification("item/completed", { turnId: pending.turnId, itemId: pending.itemId, item: completedItem, completedAtMs: Date.now() });
    }
  }

  private handleResultEvent(event: Record<string, unknown>): void {
    const turnId = this.currentTurnId;
    if (!turnId) return;
    const status = event.is_error === true ? "failed" : "completed";
    this.onNotification("turn/completed", { turnId, turn: { id: turnId, status } });
    this.currentTurnId = null;
  }

  private write(payload: Record<string, unknown>): void {
    this.process?.stdin.write(`${JSON.stringify(payload)}\n`);
    this.process?.stdin.flush();
  }

  /** Both turnStart and turnSteer are the same operation in Claude's
   * protocol — "write the next stream-json user line" — codex's own
   * turn/start vs turn/steer distinction (new turn vs steering an
   * in-progress one) doesn't exist here; every prompt just becomes the
   * next line on the same persistent process's stdin. */
  private sendTurn(prompt: string): void {
    // Claude's protocol has no native turn id (a turn is just "the next
    // stream-json line") — synthesized globally unique, same reasoning as
    // the text-block item id above.
    const turnId = `claude-turn-${crypto.randomUUID()}`;
    this.currentTurnId = turnId;
    this.onNotification("turn/started", { turnId, turn: { id: turnId } });
    const userItemId = `claude-item-${crypto.randomUUID()}`;
    const userItem = { id: userItemId, type: "userMessage", content: [{ text: prompt }] };
    this.onNotification("item/started", { turnId, itemId: userItemId, item: userItem });
    this.onNotification("item/completed", { turnId, itemId: userItemId, item: userItem });
    this.write({ type: "user", message: { role: "user", content: prompt } });
  }

  async turnStart(_providerThreadId: string, prompt: string, _approvalPolicy = "never"): Promise<void> {
    this.sendTurn(prompt);
  }

  async turnSteer(_providerThreadId: string, prompt: string, _approvalPolicy = "never"): Promise<void> {
    this.sendTurn(prompt);
  }

  /** No approval requests are ever raised (bypassPermissions), so this is
   * never actually called — exists only so call sites written against
   * CodexAppServerClient's shape (`session.client!.respond(...)`) still
   * type-check against the shared union. */
  respond(_requestId: number | string, _result?: unknown, _error?: unknown): void {}

  kill(): void {
    this.process?.kill();
  }

  /** Resolves once the OS process has actually exited — see
   * CodexAppServerClient's identically-named getter for why callers care. */
  get exited(): Promise<number> {
    return this.process?.exited ?? Promise.resolve(0);
  }

  get stderrTailText(): string {
    return this.stderrTail.join("\n");
  }
}
