import { z } from "zod";

const itemStatusSchema = z.enum([
  "pending",
  "completed",
  "failed",
  "interrupted",
]);

const approvalStatusSchema = z
  .enum(["waiting_for_approval", "denied"])
  .nullable();

export const commandExecutionItemSchema = z.object({
  type: z.literal("commandExecution"),
  id: z.string(),
  command: z.string(),
  cwd: z.string(),
  status: itemStatusSchema,
  approvalStatus: approvalStatusSchema,
  aggregatedOutput: z.string().nullable(),
  exitCode: z.number().nullable(),
  durationMs: z.number().nullable(),
});

export const fileChangeItemSchema = z.object({
  type: z.literal("fileChange"),
  id: z.string(),
  changes: z.array(
    z.object({
      path: z.string(),
      kind: z.enum(["add", "delete", "update"]),
      movePath: z.string().nullable(),
      diff: z.string().nullable(),
    }),
  ),
  status: itemStatusSchema,
  approvalStatus: approvalStatusSchema,
});

export const toolCallItemSchema = z.object({
  type: z.literal("toolCall"),
  id: z.string(),
  server: z.string().nullable(),
  tool: z.string(),
  arguments: z.record(z.string(), z.unknown()).nullable(),
  status: itemStatusSchema,
  approvalStatus: approvalStatusSchema,
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  durationMs: z.number().nullable(),
});

export const threadEventItemSchema = z.discriminatedUnion("type", [
  commandExecutionItemSchema,
  fileChangeItemSchema,
  toolCallItemSchema,
]);
