import { describe, expect, test } from "bun:test";
import { itemText, subscriptionTargetKey } from "./models.ts";

describe("itemText", () => {
  test("agentMessage returns its text", () => {
    expect(itemText({ type: "agentMessage", text: "hi" })).toBe("hi");
  });

  test("userMessage joins content text parts", () => {
    expect(itemText({ type: "userMessage", content: [{ text: "a" }, { text: "b" }] })).toBe("a\nb");
  });

  test("unknown type returns empty string", () => {
    expect(itemText({ type: "commandExecution" })).toBe("");
  });
});

describe("subscriptionTargetKey", () => {
  test("thread-detail includes the id", () => {
    expect(subscriptionTargetKey({ kind: "thread-detail", threadId: "thr_1" })).toBe("thread-detail:thr_1");
  });

  test("thread-list has no id", () => {
    expect(subscriptionTargetKey({ kind: "thread-list" })).toBe("thread-list");
  });

  test("unknown kind returns null", () => {
    expect(subscriptionTargetKey({ kind: "bogus" })).toBeNull();
  });
});
