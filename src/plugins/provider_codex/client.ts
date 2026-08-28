/**
 * JSON-RPC client for a `codex app-server` child process.
 *
 * Protocol facts verified against the installed `codex-cli` binary's own
 * `codex app-server generate-json-schema` output and cross-checked against
 * bb's working implementation. See vozen's spec/protocol-codex.md.
 *
 * Ported from plugins/provider_codex/client.py. No thread/lock: Bun is
 * single-threaded, so pending-request bookkeeping is a plain Map + Promise
 * instead of a Python threading.Event per in-flight request.
 */

const CLIENT_INFO = { name: "vozen", version: "0.1.0", title: null };
const DEFAULT_TIMEOUT_MS = 60_000;

export class CodexAppServerError extends Error {}

type Notification = (method: string, params: unknown) => void;
type RequestHandler = (method: string, params: unknown, requestId: number | string, client: CodexAppServerClient) => void;
type OnExit = () => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
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

export class CodexAppServerClient {
  private readonly onNotification: Notification;
  private readonly onRequest?: RequestHandler;
  private readonly onExit?: OnExit;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly process: Bun.Subprocess<"pipe", "pipe", "pipe">;
  private readonly stderrTail: string[] = [];

  constructor(
    onNotification: Notification, onRequest?: RequestHandler, onExit?: OnExit,
    // Overridable for tests, which spawn a fixture script in place of the
    // real `codex` binary instead of mocking child_process.
    spawnOptions: { command?: string[]; env?: Record<string, string> } = {},
  ) {
    this.onNotification = onNotification;
    this.onRequest = onRequest;
    this.onExit = onExit;
    this.process = Bun.spawn(spawnOptions.command ?? ["codex", "app-server"], {
      stdin: "pipe", stdout: "pipe", stderr: "pipe",
      env: spawnOptions.env ? { ...process.env, ...spawnOptions.env } : undefined,
    });
    this.readLoop();
    this.readStderr();
  }

  private async readLoop(): Promise<void> {
    for await (const rawLine of readLines(this.process.stdout as ReadableStream<Uint8Array>)) {
      const line = rawLine.trim();
      if (!line) continue;
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(line);
      } catch {
        continue; // stray non-protocol stdout traffic is ignored (protocol doc)
      }
      this.dispatch(message);
    }
    // stdout closed: fail any request still waiting so callers do not hang.
    for (const [, box] of this.pending) {
      clearTimeout(box.timer);
      box.reject(new CodexAppServerError("codex app-server exited"));
    }
    this.pending.clear();
    this.onExit?.();
  }

  private async readStderr(): Promise<void> {
    for await (const line of readLines(this.process.stderr as ReadableStream<Uint8Array>)) {
      this.stderrTail.push(line);
      if (this.stderrTail.length > 20) this.stderrTail.shift();
    }
  }

  private dispatch(message: Record<string, unknown>): void {
    const hasId = "id" in message;
    const hasMethod = "method" in message;
    if (hasId && !hasMethod) {
      const id = message.id as number;
      const box = this.pending.get(id);
      if (!box) return;
      this.pending.delete(id);
      clearTimeout(box.timer);
      if ("error" in message) {
        box.reject(new CodexAppServerError(`request failed: ${JSON.stringify(message.error)}`));
      } else {
        box.resolve(message.result);
      }
      return;
    }
    if (hasId && hasMethod) {
      this.onRequest?.(message.method as string, message.params, message.id as number | string, this);
      return;
    }
    if (hasMethod) {
      this.onNotification(message.method as string, message.params);
    }
  }

  private write(payload: Record<string, unknown>): void {
    this.process.stdin.write(JSON.stringify(payload) + "\n");
    this.process.stdin.flush();
  }

  request(method: string, params?: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
    const id = this.nextId++;
    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new CodexAppServerError(`${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
    const payload: Record<string, unknown> = { jsonrpc: "2.0", id, method };
    if (params !== undefined) payload.params = params;
    this.write(payload);
    return promise;
  }

  respond(requestId: number | string, result?: unknown, error?: unknown): void {
    const payload: Record<string, unknown> = { jsonrpc: "2.0", id: requestId };
    if (error !== undefined) payload.error = error;
    else payload.result = result;
    this.write(payload);
  }

  async initialize(): Promise<void> {
    await this.request("initialize", { clientInfo: CLIENT_INFO, capabilities: { experimentalApi: true } });
  }

  async threadStart(cwd: string, approvalPolicy = "never", sandbox = "workspace-write", model?: string): Promise<string> {
    const params: Record<string, unknown> = { cwd, approvalPolicy, sandbox };
    if (model) params.model = model;
    const result = (await this.request("thread/start", params)) as { thread: { id: string } };
    return result.thread.id;
  }

  async turnStart(
    providerThreadId: string, prompt: string, approvalPolicy = "never", sandboxPolicyType = "workspaceWrite",
  ): Promise<void> {
    await this.request("turn/start", {
      threadId: providerThreadId,
      input: [{ type: "text", text: prompt }],
      approvalPolicy,
      sandboxPolicy: { type: sandboxPolicyType },
    });
  }

  async turnSteer(
    providerThreadId: string, prompt: string, approvalPolicy = "never", sandboxPolicyType = "workspaceWrite",
  ): Promise<void> {
    await this.request("turn/steer", {
      threadId: providerThreadId,
      input: [{ type: "text", text: prompt }],
      approvalPolicy,
      sandboxPolicy: { type: sandboxPolicyType },
    });
  }

  async interrupt(providerThreadId: string, turnId: string): Promise<void> {
    await this.request("turn/interrupt", { threadId: providerThreadId, turnId }, 5_000);
  }

  kill(): void {
    this.process.kill();
  }

  /** Resolves once the OS process has actually exited — callers that need
   * to guarantee no more `onExit`/notification callbacks will fire after
   * teardown (e.g. a test closing its db right after `kill()`) should await
   * this instead of assuming `kill()` is synchronous with process death. */
  get exited(): Promise<number> {
    return this.process.exited;
  }

  get stderrTailText(): string {
    return this.stderrTail.join("\n");
  }
}
