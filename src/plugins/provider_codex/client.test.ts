import { describe, expect, test } from "bun:test";
import path from "node:path";
import { CodexAppServerClient, CodexAppServerError } from "./client.ts";

const FIXTURE = path.join(import.meta.dir, "__fixtures__/fake-codex.ts");

function makeClient(opts: {
  responses?: Record<string, { result?: unknown; error?: unknown }>;
  output?: { delayMs?: number; line: unknown; raw?: boolean }[];
  onNotification?: (method: string, params: unknown) => void;
  onRequest?: (method: string, params: unknown, requestId: number | string, client: CodexAppServerClient) => void;
}) {
  return new CodexAppServerClient(
    opts.onNotification ?? (() => {}),
    opts.onRequest,
    undefined,
    {
      command: ["bun", "run", FIXTURE],
      env: {
        FAKE_CODEX_RESPONSES: JSON.stringify(opts.responses ?? {}),
        FAKE_CODEX_OUTPUT: JSON.stringify(opts.output ?? []),
      },
    },
  );
}

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() > deadline) return reject(new Error("waitFor timed out"));
      setTimeout(check, 10);
    };
    check();
  });
}

describe("CodexAppServerClient", () => {
  test("request matches response by id", async () => {
    const client = makeClient({ responses: { "thread/start": { result: { thread: { id: "t1" } } } } });
    const result = await client.request("thread/start", { cwd: "/tmp" });
    expect(result).toEqual({ thread: { id: "t1" } });
    client.kill();
  });

  test("error response rejects with CodexAppServerError", async () => {
    const client = makeClient({ responses: { "thread/start": { error: { message: "bad" } } } });
    await expect(client.request("thread/start", {})).rejects.toBeInstanceOf(CodexAppServerError);
    client.kill();
  });

  test("notification dispatches to callback", async () => {
    const received: [string, unknown][] = [];
    const client = makeClient({
      onNotification: (m, p) => received.push([m, p]),
      output: [{ line: { jsonrpc: "2.0", method: "item/agentMessage/delta", params: { itemId: "i1", delta: "hi" } } }],
    });
    await waitFor(() => received.length > 0);
    expect(received).toEqual([["item/agentMessage/delta", { itemId: "i1", delta: "hi" }]]);
    client.kill();
  });

  test("timeout rejects and clears the pending request", async () => {
    const client = makeClient({}); // no response ever configured
    await expect(client.request("thread/start", {}, 50)).rejects.toBeInstanceOf(CodexAppServerError);
    client.kill();
  });

  test("stray non-JSON stdout is ignored", async () => {
    const client = makeClient({
      responses: { initialize: { result: { ok: true } } },
      output: [{ line: "not json at all", raw: true }],
    });
    const result = await client.request("initialize", {});
    expect(result).toEqual({ ok: true });
    client.kill();
  });

  test("incoming server->client request invokes onRequest callback", async () => {
    const received: [string, unknown, number | string][] = [];
    const client = makeClient({
      onRequest: (method, params, requestId) => received.push([method, params, requestId]),
      output: [{
        line: {
          jsonrpc: "2.0", id: 999, method: "item/commandExecution/requestApproval",
          params: { command: "rm -rf /" },
        },
      }],
    });
    await waitFor(() => received.length > 0);
    expect(received).toEqual([["item/commandExecution/requestApproval", { command: "rm -rf /" }, 999]]);
    client.kill();
  });
});
