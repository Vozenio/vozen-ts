// Portable type declarations for `@get-bb/plugin-sdk`. Unpublished BB
// workspace contracts are flattened; public subpaths may reuse the
// package root without requiring any other @bb/* package.
//
// Confused by the API, or need a symbol that isn't here? Clone the BB repo
// and read the real source: https://github.com/get-bb/bb

import { z } from 'zod';

interface JsonObject {
    [key: string]: JsonValue;
}
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

declare const threadEventItemPresentationLabelSchema: z.ZodObject<{
    completed: z.ZodString;
    pending: z.ZodString;
}, z.core.$strip>;
type ThreadEventItemPresentationLabel = z.infer<typeof threadEventItemPresentationLabelSchema>;
/**
 * The row's leading icon, by name. Two vocabularies share the one field:
 *
 * - a host glyph (`{ glyph: "FileText" }`), the same names the plugin
 *   branding and provider declaration icons use;
 * - a plugin-declared icon (`{ glyph: "echo-provider/receipt" }`), the
 *   namespaced form `"<pluginId>/<name>"` that names an entry of the
 *   plugin's manifest map `bb.branding.experimental_icons`
 *   (`NAMESPACED_GLYPH_PATTERN` in plugin-icon.ts). The server rejects at
 *   ingest a namespaced glyph that is not the emitting plugin's own declared
 *   icon; clients resolve the name against the plugin inventory they hold
 *   and draw the SVG tinted with `currentColor`.
 *
 * Both are names, never bytes or paths: the row persists the name and
 * follows the plugin's current map at render time. If the plugin is gone or
 * the name is unknown when the row renders, the icon is simply not found and
 * the per-kind fallback glyph draws instead — accepted, so a persisted row
 * never depends on a file that may have moved. The schema stays a plain
 * non-blank string on purpose: persisted rows must parse forever.
 */
declare const threadEventItemPresentationIconSchema: z.ZodObject<{
    glyph: z.ZodString;
}, z.core.$strip>;
type ThreadEventItemPresentationIcon = z.infer<typeof threadEventItemPresentationIconSchema>;
declare const threadEventItemPresentationTintSchema: z.ZodObject<{
    dark: z.ZodString;
    light: z.ZodString;
}, z.core.$strip>;
type ThreadEventItemPresentationTint = z.infer<typeof threadEventItemPresentationTintSchema>;
declare const threadEventItemPresentationSchema: z.ZodObject<{
    detail: z.ZodOptional<z.ZodString>;
    icon: z.ZodObject<{
        glyph: z.ZodString;
    }, z.core.$strip>;
    label: z.ZodObject<{
        completed: z.ZodString;
        pending: z.ZodString;
    }, z.core.$strip>;
    suppress: z.ZodOptional<z.ZodBoolean>;
    tint: z.ZodOptional<z.ZodObject<{
        dark: z.ZodString;
        light: z.ZodString;
    }, z.core.$strip>>;
    title: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type ThreadEventItemPresentation = z.infer<typeof threadEventItemPresentationSchema>;

declare const threadEventWebSearchItemSchema: z.ZodObject<{
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    queries: z.ZodArray<z.ZodString>;
    resultText: z.ZodNullable<z.ZodString>;
    type: z.ZodLiteral<"webSearch">;
}, z.core.$strip>;
type ThreadEventWebSearchItem = z.infer<typeof threadEventWebSearchItemSchema>;
declare const threadEventWebFetchItemSchema: z.ZodObject<{
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    pattern: z.ZodNullable<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    prompt: z.ZodNullable<z.ZodString>;
    resultText: z.ZodNullable<z.ZodString>;
    type: z.ZodLiteral<"webFetch">;
    url: z.ZodString;
}, z.core.$strip>;
type ThreadEventWebFetchItem = z.infer<typeof threadEventWebFetchItemSchema>;
/**
 * A file the agent read. The single most common generic tool in the
 * production corpus (Claude `Read`: 7,568 calls across 141 threads rendered
 * as an opaque `toolCall`), so it earns a core kind: clients show the path,
 * the permission matrix treats it as a read, and no tool-name table is
 * needed to recognise it. `cmd` carries the native shell form when the
 * provider read through a command (`cat`, `sed -n`) rather than a structured
 * tool, so the row can still show what actually ran.
 */
declare const threadEventFileReadItemSchema: z.ZodObject<{
    cmd: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    path: z.ZodString;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    type: z.ZodLiteral<"fileRead">;
}, z.core.$strip>;
type ThreadEventFileReadItem = z.infer<typeof threadEventFileReadItemSchema>;
/**
 * One kind for every exploration tool that is not a file read: grep, glob,
 * and directory listing, discriminated by `mode`. Claude `Grep` + `Glob` and
 * the shell `rg`/`ls`/`find` commands bridges already classify into
 * `command` activity intents all fold into it. `query` is the pattern: text
 * or a regex for `content`, a glob for `path`, and an optional filter for
 * `list` (empty when the whole directory is listed). `path` is the root the
 * search ran under when the provider named one. `cmd` carries the native
 * shell form when the provider searched through a command.
 */
declare const threadEventSearchItemSchema: z.ZodObject<{
    cmd: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    mode: z.ZodEnum<{
        content: "content";
        list: "list";
        path: "path";
    }>;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    path: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    query: z.ZodString;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    type: z.ZodLiteral<"search">;
}, z.core.$strip>;
type ThreadEventSearchItem = z.infer<typeof threadEventSearchItemSchema>;
/**
 * The agent delegated work to a child agent. One kind replaces the three
 * encodings in the production data — codex `spawnAgent`/`wait` tool calls,
 * the Claude `Agent` tool call with nested child turns, and backgrounded
 * `local_agent` background tasks — and the `thread/openWork` notification:
 * an open delegation IS open work.
 *
 * `childRef` is the provider-native id of the child (a codex agent id, a
 * Claude subagent id, a bb child thread id when the delegation became a bb
 * thread); child turns link back through their `parentToolCallId`.
 * `background: true` marks a delegation that outlives its spawning turn, in
 * which case its progress and terminal state ride the thread-scoped
 * `item/delegation/progress` and `item/delegation/completed` events exactly
 * as `backgroundTask` does; a foreground delegation settles through the
 * ordinary turn-scoped `item/completed`.
 */
declare const threadEventDelegationItemSchema: z.ZodObject<{
    background: z.ZodBoolean;
    childRef: z.ZodString;
    id: z.ZodString;
    label: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    summary: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"delegation">;
}, z.core.$strip>;
type ThreadEventDelegationItem = z.infer<typeof threadEventDelegationItemSchema>;
/**
 * A structured plan snapshot the agent maintains as an item: codex
 * `update_plan` (its `turn/plan/updated` notification reaches 295 threads in
 * the production corpus and the UI discards it today) and the Claude
 * `TaskCreate`/`TaskUpdate`/`TodoWrite` family. Each snapshot carries the
 * full step list; a later snapshot supersedes an earlier one. Distinct from
 * the `plan` item, which is the free-text plan-mode document.
 */
declare const threadEventPlanStepsItemSchema: z.ZodObject<{
    explanation: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    steps: z.ZodArray<z.ZodObject<{
        status: z.ZodOptional<z.ZodEnum<{
            active: "active";
            completed: "completed";
            failed: "failed";
            pending: "pending";
        }>>;
        step: z.ZodString;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"planSteps">;
}, z.core.$strip>;
type ThreadEventPlanStepsItem = z.infer<typeof threadEventPlanStepsItemSchema>;
/**
 * A plugin-defined item kind outside the core vocabulary
 * (`"<pluginId>/<name>"`, see provider-extension-kind.ts). The payload is
 * opaque JSON here; the server validates it against the owning plugin's
 * declared schema at ingest. `presentation` is REQUIRED — an
 * extension item has no core renderer to fall back on, so the declarative
 * base is the only thing every client can show.
 */
declare const threadEventExtensionItemSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodString & z.ZodType<`${string}/${string}`, string, z.core.$ZodTypeInternals<`${string}/${string}`, string>>;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    payload: z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>;
    presentation: z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    type: z.ZodLiteral<"extension">;
}, z.core.$strip>;
type ThreadEventExtensionItem = z.infer<typeof threadEventExtensionItemSchema>;
/**
 * A materialized provider background task. Dynamic workflows (taskType
 * "local_workflow"), backgrounded shell commands (taskType "local_bash"), and
 * backgrounded subagents (taskType "local_agent" / "local_subagent") become
 * items. The item id is derived from the provider task id and stays stable
 * across the started → progress* → completed lifecycle.
 */
declare const threadEventBackgroundTaskItemSchema: z.ZodObject<{
    description: z.ZodString;
    error: z.ZodOptional<z.ZodString>;
    familyId: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    outputFile: z.ZodOptional<z.ZodString>;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    skipTranscript: z.ZodBoolean;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    summary: z.ZodOptional<z.ZodString>;
    taskStatus: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        killed: "killed";
        paused: "paused";
        pending: "pending";
        running: "running";
        stopped: "stopped";
    }>;
    taskType: z.ZodString;
    type: z.ZodLiteral<"backgroundTask">;
    usage: z.ZodOptional<z.ZodObject<{
        durationMs: z.ZodNumber;
        toolUses: z.ZodNumber;
        totalTokens: z.ZodNumber;
    }, z.core.$strip>>;
    workflow: z.ZodOptional<z.ZodObject<{
        agents: z.ZodArray<z.ZodObject<{
            agentType: z.ZodOptional<z.ZodString>;
            attempt: z.ZodNumber;
            cached: z.ZodBoolean;
            durationMs: z.ZodOptional<z.ZodNumber>;
            error: z.ZodOptional<z.ZodString>;
            index: z.ZodNumber;
            isolation: z.ZodOptional<z.ZodString>;
            label: z.ZodString;
            lastProgressAt: z.ZodNumber;
            lastToolName: z.ZodOptional<z.ZodString>;
            lastToolSummary: z.ZodOptional<z.ZodString>;
            model: z.ZodString;
            phaseIndex: z.ZodOptional<z.ZodNumber>;
            phaseTitle: z.ZodOptional<z.ZodString>;
            promptPreview: z.ZodOptional<z.ZodString>;
            queuedAt: z.ZodOptional<z.ZodNumber>;
            resultPreview: z.ZodOptional<z.ZodString>;
            startedAt: z.ZodOptional<z.ZodNumber>;
            state: z.ZodEnum<{
                done: "done";
                failed: "failed";
                queued: "queued";
                running: "running";
                skipped: "skipped";
            }>;
            tokens: z.ZodOptional<z.ZodNumber>;
            toolCalls: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        phases: z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            kind: z.ZodOptional<z.ZodString>;
            title: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    workflowName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type ThreadEventBackgroundTaskItem = z.infer<typeof threadEventBackgroundTaskItemSchema>;
declare const threadEventItemSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    clientRequestId: z.ZodOptional<z.ZodString>;
    content: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        text: z.ZodString;
        type: z.ZodLiteral<"text">;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"image">;
        url: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        path: z.ZodString;
        type: z.ZodLiteral<"localImage">;
    }, z.core.$strip>, z.ZodObject<{
        path: z.ZodString;
        type: z.ZodLiteral<"localFile">;
    }, z.core.$strip>], "type">>;
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"userMessage">;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    text: z.ZodString;
    type: z.ZodLiteral<"agentMessage">;
}, z.core.$strip>, z.ZodObject<{
    aggregatedOutput: z.ZodOptional<z.ZodString>;
    approvalStatus: z.ZodNullable<z.ZodEnum<{
        denied: "denied";
        waiting_for_approval: "waiting_for_approval";
    }>>;
    command: z.ZodString;
    cwd: z.ZodString;
    durationMs: z.ZodOptional<z.ZodNumber>;
    exitCode: z.ZodOptional<z.ZodNumber>;
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    truncation: z.ZodOptional<z.ZodObject<{
        aggregatedOutput: z.ZodOptional<z.ZodObject<{
            originalLength: z.ZodNumber;
            retainedHeadLength: z.ZodNumber;
            retainedTailLength: z.ZodNumber;
            truncatedAt: z.ZodNumber;
        }, z.core.$strip>>;
        result: z.ZodOptional<z.ZodObject<{
            originalLength: z.ZodNumber;
            retainedHeadLength: z.ZodNumber;
            retainedTailLength: z.ZodNumber;
            truncatedAt: z.ZodNumber;
        }, z.core.$strip>>;
        resultText: z.ZodOptional<z.ZodObject<{
            originalLength: z.ZodNumber;
            retainedHeadLength: z.ZodNumber;
            retainedTailLength: z.ZodNumber;
            truncatedAt: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"commandExecution">;
}, z.core.$strip>, z.ZodObject<{
    approvalStatus: z.ZodNullable<z.ZodEnum<{
        denied: "denied";
        waiting_for_approval: "waiting_for_approval";
    }>>;
    changes: z.ZodArray<z.ZodObject<{
        diff: z.ZodOptional<z.ZodString>;
        kind: z.ZodEnum<{
            add: "add";
            delete: "delete";
            update: "update";
        }>;
        movePath: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
    }, z.core.$strip>>;
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    type: z.ZodLiteral<"fileChange">;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    queries: z.ZodArray<z.ZodString>;
    resultText: z.ZodNullable<z.ZodString>;
    type: z.ZodLiteral<"webSearch">;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    pattern: z.ZodNullable<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    prompt: z.ZodNullable<z.ZodString>;
    resultText: z.ZodNullable<z.ZodString>;
    type: z.ZodLiteral<"webFetch">;
    url: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    path: z.ZodString;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"imageView">;
}, z.core.$strip>, z.ZodObject<{
    cmd: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    path: z.ZodString;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    type: z.ZodLiteral<"fileRead">;
}, z.core.$strip>, z.ZodObject<{
    cmd: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    mode: z.ZodEnum<{
        content: "content";
        list: "list";
        path: "path";
    }>;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    path: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    query: z.ZodString;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    type: z.ZodLiteral<"search">;
}, z.core.$strip>, z.ZodObject<{
    arguments: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    result: z.ZodOptional<z.ZodUnknown>;
    server: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    tool: z.ZodString;
    truncation: z.ZodOptional<z.ZodObject<{
        aggregatedOutput: z.ZodOptional<z.ZodObject<{
            originalLength: z.ZodNumber;
            retainedHeadLength: z.ZodNumber;
            retainedTailLength: z.ZodNumber;
            truncatedAt: z.ZodNumber;
        }, z.core.$strip>>;
        result: z.ZodOptional<z.ZodObject<{
            originalLength: z.ZodNumber;
            retainedHeadLength: z.ZodNumber;
            retainedTailLength: z.ZodNumber;
            truncatedAt: z.ZodNumber;
        }, z.core.$strip>>;
        resultText: z.ZodOptional<z.ZodObject<{
            originalLength: z.ZodNumber;
            retainedHeadLength: z.ZodNumber;
            retainedTailLength: z.ZodNumber;
            truncatedAt: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"toolCall">;
}, z.core.$strip>, z.ZodObject<{
    content: z.ZodArray<z.ZodString>;
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    summary: z.ZodArray<z.ZodString>;
    type: z.ZodLiteral<"reasoning">;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    text: z.ZodString;
    type: z.ZodLiteral<"plan">;
}, z.core.$strip>, z.ZodObject<{
    explanation: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    steps: z.ZodArray<z.ZodObject<{
        status: z.ZodOptional<z.ZodEnum<{
            active: "active";
            completed: "completed";
            failed: "failed";
            pending: "pending";
        }>>;
        step: z.ZodString;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"planSteps">;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"contextCompaction">;
}, z.core.$strip>, z.ZodObject<{
    description: z.ZodString;
    error: z.ZodOptional<z.ZodString>;
    familyId: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    outputFile: z.ZodOptional<z.ZodString>;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    skipTranscript: z.ZodBoolean;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    summary: z.ZodOptional<z.ZodString>;
    taskStatus: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        killed: "killed";
        paused: "paused";
        pending: "pending";
        running: "running";
        stopped: "stopped";
    }>;
    taskType: z.ZodString;
    type: z.ZodLiteral<"backgroundTask">;
    usage: z.ZodOptional<z.ZodObject<{
        durationMs: z.ZodNumber;
        toolUses: z.ZodNumber;
        totalTokens: z.ZodNumber;
    }, z.core.$strip>>;
    workflow: z.ZodOptional<z.ZodObject<{
        agents: z.ZodArray<z.ZodObject<{
            agentType: z.ZodOptional<z.ZodString>;
            attempt: z.ZodNumber;
            cached: z.ZodBoolean;
            durationMs: z.ZodOptional<z.ZodNumber>;
            error: z.ZodOptional<z.ZodString>;
            index: z.ZodNumber;
            isolation: z.ZodOptional<z.ZodString>;
            label: z.ZodString;
            lastProgressAt: z.ZodNumber;
            lastToolName: z.ZodOptional<z.ZodString>;
            lastToolSummary: z.ZodOptional<z.ZodString>;
            model: z.ZodString;
            phaseIndex: z.ZodOptional<z.ZodNumber>;
            phaseTitle: z.ZodOptional<z.ZodString>;
            promptPreview: z.ZodOptional<z.ZodString>;
            queuedAt: z.ZodOptional<z.ZodNumber>;
            resultPreview: z.ZodOptional<z.ZodString>;
            startedAt: z.ZodOptional<z.ZodNumber>;
            state: z.ZodEnum<{
                done: "done";
                failed: "failed";
                queued: "queued";
                running: "running";
                skipped: "skipped";
            }>;
            tokens: z.ZodOptional<z.ZodNumber>;
            toolCalls: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        phases: z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            kind: z.ZodOptional<z.ZodString>;
            title: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    workflowName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    background: z.ZodBoolean;
    childRef: z.ZodString;
    id: z.ZodString;
    label: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    summary: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"delegation">;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodString & z.ZodType<`${string}/${string}`, string, z.core.$ZodTypeInternals<`${string}/${string}`, string>>;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    payload: z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>;
    presentation: z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
    type: z.ZodLiteral<"extension">;
}, z.core.$strip>], "type">;
type ThreadEventItem = z.infer<typeof threadEventItemSchema>;
/** All thread events — provider-originated or system-originated. */
declare const threadEventSchema: z.ZodPipe<z.ZodUnknown, z.ZodUnion<readonly [z.ZodIntersection<z.ZodDiscriminatedUnion<[z.ZodObject<{
    threadId: z.ZodString;
    type: z.ZodLiteral<"thread/started">;
}, z.core.$strip>, z.ZodObject<{
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"thread/identity">;
}, z.core.$strip>, z.ZodObject<{
    parentToolCallId: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"turn/started">;
}, z.core.$strip>, z.ZodObject<{
    error: z.ZodOptional<z.ZodObject<{
        message: z.ZodString;
    }, z.core.$strip>>;
    providerCheckpointId: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
    }>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"turn/completed">;
}, z.core.$strip>, z.ZodObject<{
    clientRequestId: z.ZodString;
    providerThreadId: z.ZodString;
    scope: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"thread">;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"turn">;
        turnId: z.ZodString;
    }, z.core.$strip>], "kind">;
    threadId: z.ZodString;
    type: z.ZodLiteral<"turn/input/accepted">;
}, z.core.$strict>, z.ZodObject<{
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    threadName: z.ZodString;
    type: z.ZodLiteral<"thread/name/updated">;
}, z.core.$strip>, z.ZodObject<{
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"thread/compacted">;
}, z.core.$strip>, z.ZodObject<{
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"thread/context/cleared">;
}, z.core.$strip>, z.ZodObject<{
    objective: z.ZodString;
    providerThreadId: z.ZodString;
    status: z.ZodEnum<{
        active: "active";
        budgetLimited: "budgetLimited";
        complete: "complete";
        paused: "paused";
    }>;
    threadId: z.ZodString;
    timeUsedSeconds: z.ZodNumber;
    tokenBudget: z.ZodNullable<z.ZodNumber>;
    tokensUsed: z.ZodNumber;
    type: z.ZodLiteral<"thread/goal/updated">;
}, z.core.$strip>, z.ZodObject<{
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"thread/goal/cleared">;
}, z.core.$strip>, z.ZodObject<{
    item: z.ZodDiscriminatedUnion<[z.ZodObject<{
        clientRequestId: z.ZodOptional<z.ZodString>;
        content: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            text: z.ZodString;
            type: z.ZodLiteral<"text">;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"image">;
            url: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            path: z.ZodString;
            type: z.ZodLiteral<"localImage">;
        }, z.core.$strip>, z.ZodObject<{
            path: z.ZodString;
            type: z.ZodLiteral<"localFile">;
        }, z.core.$strip>], "type">>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        type: z.ZodLiteral<"userMessage">;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        text: z.ZodString;
        type: z.ZodLiteral<"agentMessage">;
    }, z.core.$strip>, z.ZodObject<{
        aggregatedOutput: z.ZodOptional<z.ZodString>;
        approvalStatus: z.ZodNullable<z.ZodEnum<{
            denied: "denied";
            waiting_for_approval: "waiting_for_approval";
        }>>;
        command: z.ZodString;
        cwd: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        exitCode: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        truncation: z.ZodOptional<z.ZodObject<{
            aggregatedOutput: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
            result: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
            resultText: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"commandExecution">;
    }, z.core.$strip>, z.ZodObject<{
        approvalStatus: z.ZodNullable<z.ZodEnum<{
            denied: "denied";
            waiting_for_approval: "waiting_for_approval";
        }>>;
        changes: z.ZodArray<z.ZodObject<{
            diff: z.ZodOptional<z.ZodString>;
            kind: z.ZodEnum<{
                add: "add";
                delete: "delete";
                update: "update";
            }>;
            movePath: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
        }, z.core.$strip>>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        type: z.ZodLiteral<"fileChange">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        queries: z.ZodArray<z.ZodString>;
        resultText: z.ZodNullable<z.ZodString>;
        type: z.ZodLiteral<"webSearch">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        pattern: z.ZodNullable<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        prompt: z.ZodNullable<z.ZodString>;
        resultText: z.ZodNullable<z.ZodString>;
        type: z.ZodLiteral<"webFetch">;
        url: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"imageView">;
    }, z.core.$strip>, z.ZodObject<{
        cmd: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        type: z.ZodLiteral<"fileRead">;
    }, z.core.$strip>, z.ZodObject<{
        cmd: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        mode: z.ZodEnum<{
            content: "content";
            list: "list";
            path: "path";
        }>;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        query: z.ZodString;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        type: z.ZodLiteral<"search">;
    }, z.core.$strip>, z.ZodObject<{
        arguments: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        durationMs: z.ZodOptional<z.ZodNumber>;
        error: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        result: z.ZodOptional<z.ZodUnknown>;
        server: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        tool: z.ZodString;
        truncation: z.ZodOptional<z.ZodObject<{
            aggregatedOutput: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
            result: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
            resultText: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"toolCall">;
    }, z.core.$strip>, z.ZodObject<{
        content: z.ZodArray<z.ZodString>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        summary: z.ZodArray<z.ZodString>;
        type: z.ZodLiteral<"reasoning">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        text: z.ZodString;
        type: z.ZodLiteral<"plan">;
    }, z.core.$strip>, z.ZodObject<{
        explanation: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        steps: z.ZodArray<z.ZodObject<{
            status: z.ZodOptional<z.ZodEnum<{
                active: "active";
                completed: "completed";
                failed: "failed";
                pending: "pending";
            }>>;
            step: z.ZodString;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"planSteps">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"contextCompaction">;
    }, z.core.$strip>, z.ZodObject<{
        description: z.ZodString;
        error: z.ZodOptional<z.ZodString>;
        familyId: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        outputFile: z.ZodOptional<z.ZodString>;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        skipTranscript: z.ZodBoolean;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        summary: z.ZodOptional<z.ZodString>;
        taskStatus: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            killed: "killed";
            paused: "paused";
            pending: "pending";
            running: "running";
            stopped: "stopped";
        }>;
        taskType: z.ZodString;
        type: z.ZodLiteral<"backgroundTask">;
        usage: z.ZodOptional<z.ZodObject<{
            durationMs: z.ZodNumber;
            toolUses: z.ZodNumber;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>>;
        workflow: z.ZodOptional<z.ZodObject<{
            agents: z.ZodArray<z.ZodObject<{
                agentType: z.ZodOptional<z.ZodString>;
                attempt: z.ZodNumber;
                cached: z.ZodBoolean;
                durationMs: z.ZodOptional<z.ZodNumber>;
                error: z.ZodOptional<z.ZodString>;
                index: z.ZodNumber;
                isolation: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
                lastProgressAt: z.ZodNumber;
                lastToolName: z.ZodOptional<z.ZodString>;
                lastToolSummary: z.ZodOptional<z.ZodString>;
                model: z.ZodString;
                phaseIndex: z.ZodOptional<z.ZodNumber>;
                phaseTitle: z.ZodOptional<z.ZodString>;
                promptPreview: z.ZodOptional<z.ZodString>;
                queuedAt: z.ZodOptional<z.ZodNumber>;
                resultPreview: z.ZodOptional<z.ZodString>;
                startedAt: z.ZodOptional<z.ZodNumber>;
                state: z.ZodEnum<{
                    done: "done";
                    failed: "failed";
                    queued: "queued";
                    running: "running";
                    skipped: "skipped";
                }>;
                tokens: z.ZodOptional<z.ZodNumber>;
                toolCalls: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            phases: z.ZodArray<z.ZodObject<{
                index: z.ZodNumber;
                kind: z.ZodOptional<z.ZodString>;
                title: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        workflowName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        background: z.ZodBoolean;
        childRef: z.ZodString;
        id: z.ZodString;
        label: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        summary: z.ZodOptional<z.ZodString>;
        type: z.ZodLiteral<"delegation">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodString & z.ZodType<`${string}/${string}`, string, z.core.$ZodTypeInternals<`${string}/${string}`, string>>;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        payload: z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>;
        presentation: z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        type: z.ZodLiteral<"extension">;
    }, z.core.$strip>], "type">;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/started">;
}, z.core.$strip>, z.ZodObject<{
    item: z.ZodDiscriminatedUnion<[z.ZodObject<{
        clientRequestId: z.ZodOptional<z.ZodString>;
        content: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            text: z.ZodString;
            type: z.ZodLiteral<"text">;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"image">;
            url: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            path: z.ZodString;
            type: z.ZodLiteral<"localImage">;
        }, z.core.$strip>, z.ZodObject<{
            path: z.ZodString;
            type: z.ZodLiteral<"localFile">;
        }, z.core.$strip>], "type">>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        type: z.ZodLiteral<"userMessage">;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        text: z.ZodString;
        type: z.ZodLiteral<"agentMessage">;
    }, z.core.$strip>, z.ZodObject<{
        aggregatedOutput: z.ZodOptional<z.ZodString>;
        approvalStatus: z.ZodNullable<z.ZodEnum<{
            denied: "denied";
            waiting_for_approval: "waiting_for_approval";
        }>>;
        command: z.ZodString;
        cwd: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        exitCode: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        truncation: z.ZodOptional<z.ZodObject<{
            aggregatedOutput: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
            result: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
            resultText: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"commandExecution">;
    }, z.core.$strip>, z.ZodObject<{
        approvalStatus: z.ZodNullable<z.ZodEnum<{
            denied: "denied";
            waiting_for_approval: "waiting_for_approval";
        }>>;
        changes: z.ZodArray<z.ZodObject<{
            diff: z.ZodOptional<z.ZodString>;
            kind: z.ZodEnum<{
                add: "add";
                delete: "delete";
                update: "update";
            }>;
            movePath: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
        }, z.core.$strip>>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        type: z.ZodLiteral<"fileChange">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        queries: z.ZodArray<z.ZodString>;
        resultText: z.ZodNullable<z.ZodString>;
        type: z.ZodLiteral<"webSearch">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        pattern: z.ZodNullable<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        prompt: z.ZodNullable<z.ZodString>;
        resultText: z.ZodNullable<z.ZodString>;
        type: z.ZodLiteral<"webFetch">;
        url: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"imageView">;
    }, z.core.$strip>, z.ZodObject<{
        cmd: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        type: z.ZodLiteral<"fileRead">;
    }, z.core.$strip>, z.ZodObject<{
        cmd: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        mode: z.ZodEnum<{
            content: "content";
            list: "list";
            path: "path";
        }>;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        query: z.ZodString;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        type: z.ZodLiteral<"search">;
    }, z.core.$strip>, z.ZodObject<{
        arguments: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        durationMs: z.ZodOptional<z.ZodNumber>;
        error: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        result: z.ZodOptional<z.ZodUnknown>;
        server: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        tool: z.ZodString;
        truncation: z.ZodOptional<z.ZodObject<{
            aggregatedOutput: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
            result: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
            resultText: z.ZodOptional<z.ZodObject<{
                originalLength: z.ZodNumber;
                retainedHeadLength: z.ZodNumber;
                retainedTailLength: z.ZodNumber;
                truncatedAt: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"toolCall">;
    }, z.core.$strip>, z.ZodObject<{
        content: z.ZodArray<z.ZodString>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        summary: z.ZodArray<z.ZodString>;
        type: z.ZodLiteral<"reasoning">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        text: z.ZodString;
        type: z.ZodLiteral<"plan">;
    }, z.core.$strip>, z.ZodObject<{
        explanation: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        steps: z.ZodArray<z.ZodObject<{
            status: z.ZodOptional<z.ZodEnum<{
                active: "active";
                completed: "completed";
                failed: "failed";
                pending: "pending";
            }>>;
            step: z.ZodString;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"planSteps">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"contextCompaction">;
    }, z.core.$strip>, z.ZodObject<{
        description: z.ZodString;
        error: z.ZodOptional<z.ZodString>;
        familyId: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        outputFile: z.ZodOptional<z.ZodString>;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        skipTranscript: z.ZodBoolean;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        summary: z.ZodOptional<z.ZodString>;
        taskStatus: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            killed: "killed";
            paused: "paused";
            pending: "pending";
            running: "running";
            stopped: "stopped";
        }>;
        taskType: z.ZodString;
        type: z.ZodLiteral<"backgroundTask">;
        usage: z.ZodOptional<z.ZodObject<{
            durationMs: z.ZodNumber;
            toolUses: z.ZodNumber;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>>;
        workflow: z.ZodOptional<z.ZodObject<{
            agents: z.ZodArray<z.ZodObject<{
                agentType: z.ZodOptional<z.ZodString>;
                attempt: z.ZodNumber;
                cached: z.ZodBoolean;
                durationMs: z.ZodOptional<z.ZodNumber>;
                error: z.ZodOptional<z.ZodString>;
                index: z.ZodNumber;
                isolation: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
                lastProgressAt: z.ZodNumber;
                lastToolName: z.ZodOptional<z.ZodString>;
                lastToolSummary: z.ZodOptional<z.ZodString>;
                model: z.ZodString;
                phaseIndex: z.ZodOptional<z.ZodNumber>;
                phaseTitle: z.ZodOptional<z.ZodString>;
                promptPreview: z.ZodOptional<z.ZodString>;
                queuedAt: z.ZodOptional<z.ZodNumber>;
                resultPreview: z.ZodOptional<z.ZodString>;
                startedAt: z.ZodOptional<z.ZodNumber>;
                state: z.ZodEnum<{
                    done: "done";
                    failed: "failed";
                    queued: "queued";
                    running: "running";
                    skipped: "skipped";
                }>;
                tokens: z.ZodOptional<z.ZodNumber>;
                toolCalls: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            phases: z.ZodArray<z.ZodObject<{
                index: z.ZodNumber;
                kind: z.ZodOptional<z.ZodString>;
                title: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        workflowName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        background: z.ZodBoolean;
        childRef: z.ZodString;
        id: z.ZodString;
        label: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        summary: z.ZodOptional<z.ZodString>;
        type: z.ZodLiteral<"delegation">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodString & z.ZodType<`${string}/${string}`, string, z.core.$ZodTypeInternals<`${string}/${string}`, string>>;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        payload: z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>;
        presentation: z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        type: z.ZodLiteral<"extension">;
    }, z.core.$strip>], "type">;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/completed">;
}, z.core.$strip>, z.ZodObject<{
    delta: z.ZodString;
    itemId: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/agentMessage/delta">;
}, z.core.$strip>, z.ZodObject<{
    delta: z.ZodString;
    itemId: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodString;
    reset: z.ZodOptional<z.ZodBoolean>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/commandExecution/outputDelta">;
}, z.core.$strip>, z.ZodObject<{
    delta: z.ZodString;
    itemId: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/fileChange/outputDelta">;
}, z.core.$strip>, z.ZodObject<{
    delta: z.ZodString;
    itemId: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/reasoning/summaryTextDelta">;
}, z.core.$strip>, z.ZodObject<{
    delta: z.ZodString;
    itemId: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/reasoning/textDelta">;
}, z.core.$strip>, z.ZodObject<{
    delta: z.ZodString;
    itemId: z.ZodString;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/plan/delta">;
}, z.core.$strip>, z.ZodObject<{
    itemId: z.ZodString;
    message: z.ZodOptional<z.ZodString>;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/mcpToolCall/progress">;
}, z.core.$strip>, z.ZodObject<{
    itemId: z.ZodString;
    message: z.ZodOptional<z.ZodString>;
    parentToolCallId: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/toolCall/progress">;
}, z.core.$strip>, z.ZodObject<{
    item: z.ZodObject<{
        description: z.ZodString;
        error: z.ZodOptional<z.ZodString>;
        familyId: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        outputFile: z.ZodOptional<z.ZodString>;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        skipTranscript: z.ZodBoolean;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        summary: z.ZodOptional<z.ZodString>;
        taskStatus: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            killed: "killed";
            paused: "paused";
            pending: "pending";
            running: "running";
            stopped: "stopped";
        }>;
        taskType: z.ZodString;
        type: z.ZodLiteral<"backgroundTask">;
        usage: z.ZodOptional<z.ZodObject<{
            durationMs: z.ZodNumber;
            toolUses: z.ZodNumber;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>>;
        workflow: z.ZodOptional<z.ZodObject<{
            agents: z.ZodArray<z.ZodObject<{
                agentType: z.ZodOptional<z.ZodString>;
                attempt: z.ZodNumber;
                cached: z.ZodBoolean;
                durationMs: z.ZodOptional<z.ZodNumber>;
                error: z.ZodOptional<z.ZodString>;
                index: z.ZodNumber;
                isolation: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
                lastProgressAt: z.ZodNumber;
                lastToolName: z.ZodOptional<z.ZodString>;
                lastToolSummary: z.ZodOptional<z.ZodString>;
                model: z.ZodString;
                phaseIndex: z.ZodOptional<z.ZodNumber>;
                phaseTitle: z.ZodOptional<z.ZodString>;
                promptPreview: z.ZodOptional<z.ZodString>;
                queuedAt: z.ZodOptional<z.ZodNumber>;
                resultPreview: z.ZodOptional<z.ZodString>;
                startedAt: z.ZodOptional<z.ZodNumber>;
                state: z.ZodEnum<{
                    done: "done";
                    failed: "failed";
                    queued: "queued";
                    running: "running";
                    skipped: "skipped";
                }>;
                tokens: z.ZodOptional<z.ZodNumber>;
                toolCalls: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            phases: z.ZodArray<z.ZodObject<{
                index: z.ZodNumber;
                kind: z.ZodOptional<z.ZodString>;
                title: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        workflowName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/backgroundTask/progress">;
}, z.core.$strip>, z.ZodObject<{
    item: z.ZodObject<{
        description: z.ZodString;
        error: z.ZodOptional<z.ZodString>;
        familyId: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        outputFile: z.ZodOptional<z.ZodString>;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        skipTranscript: z.ZodBoolean;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        summary: z.ZodOptional<z.ZodString>;
        taskStatus: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            killed: "killed";
            paused: "paused";
            pending: "pending";
            running: "running";
            stopped: "stopped";
        }>;
        taskType: z.ZodString;
        type: z.ZodLiteral<"backgroundTask">;
        usage: z.ZodOptional<z.ZodObject<{
            durationMs: z.ZodNumber;
            toolUses: z.ZodNumber;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>>;
        workflow: z.ZodOptional<z.ZodObject<{
            agents: z.ZodArray<z.ZodObject<{
                agentType: z.ZodOptional<z.ZodString>;
                attempt: z.ZodNumber;
                cached: z.ZodBoolean;
                durationMs: z.ZodOptional<z.ZodNumber>;
                error: z.ZodOptional<z.ZodString>;
                index: z.ZodNumber;
                isolation: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
                lastProgressAt: z.ZodNumber;
                lastToolName: z.ZodOptional<z.ZodString>;
                lastToolSummary: z.ZodOptional<z.ZodString>;
                model: z.ZodString;
                phaseIndex: z.ZodOptional<z.ZodNumber>;
                phaseTitle: z.ZodOptional<z.ZodString>;
                promptPreview: z.ZodOptional<z.ZodString>;
                queuedAt: z.ZodOptional<z.ZodNumber>;
                resultPreview: z.ZodOptional<z.ZodString>;
                startedAt: z.ZodOptional<z.ZodNumber>;
                state: z.ZodEnum<{
                    done: "done";
                    failed: "failed";
                    queued: "queued";
                    running: "running";
                    skipped: "skipped";
                }>;
                tokens: z.ZodOptional<z.ZodNumber>;
                toolCalls: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            phases: z.ZodArray<z.ZodObject<{
                index: z.ZodNumber;
                kind: z.ZodOptional<z.ZodString>;
                title: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        workflowName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/backgroundTask/completed">;
}, z.core.$strip>, z.ZodObject<{
    item: z.ZodObject<{
        background: z.ZodBoolean;
        childRef: z.ZodString;
        id: z.ZodString;
        label: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        summary: z.ZodOptional<z.ZodString>;
        type: z.ZodLiteral<"delegation">;
    }, z.core.$strip>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/delegation/progress">;
}, z.core.$strip>, z.ZodObject<{
    item: z.ZodObject<{
        background: z.ZodBoolean;
        childRef: z.ZodString;
        id: z.ZodString;
        label: z.ZodString;
        parentToolCallId: z.ZodOptional<z.ZodString>;
        presentation: z.ZodOptional<z.ZodObject<{
            detail: z.ZodOptional<z.ZodString>;
            icon: z.ZodObject<{
                glyph: z.ZodString;
            }, z.core.$strip>;
            label: z.ZodObject<{
                completed: z.ZodString;
                pending: z.ZodString;
            }, z.core.$strip>;
            suppress: z.ZodOptional<z.ZodBoolean>;
            tint: z.ZodOptional<z.ZodObject<{
                dark: z.ZodString;
                light: z.ZodString;
            }, z.core.$strip>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        summary: z.ZodOptional<z.ZodString>;
        type: z.ZodLiteral<"delegation">;
    }, z.core.$strip>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"item/delegation/completed">;
}, z.core.$strip>, z.ZodObject<{
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    tokenUsage: z.ZodObject<{
        last: z.ZodObject<{
            cachedInputTokens: z.ZodNumber;
            inputTokens: z.ZodNumber;
            outputTokens: z.ZodNumber;
            reasoningOutputTokens: z.ZodNumber;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>;
        modelContextWindow: z.ZodNullable<z.ZodNumber>;
        total: z.ZodObject<{
            cachedInputTokens: z.ZodNumber;
            inputTokens: z.ZodNumber;
            outputTokens: z.ZodNumber;
            reasoningOutputTokens: z.ZodNumber;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>;
    type: z.ZodLiteral<"thread/tokenUsage/updated">;
}, z.core.$strip>, z.ZodObject<{
    contextWindowUsage: z.ZodObject<{
        estimated: z.ZodBoolean;
        modelContextWindow: z.ZodNullable<z.ZodNumber>;
        usedTokens: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"thread/contextWindowUsage/updated">;
}, z.core.$strip>, z.ZodObject<{
    explanation: z.ZodOptional<z.ZodString>;
    plan: z.ZodArray<z.ZodObject<{
        status: z.ZodOptional<z.ZodEnum<{
            active: "active";
            completed: "completed";
            failed: "failed";
            pending: "pending";
        }>>;
        step: z.ZodString;
    }, z.core.$strip>>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"turn/plan/updated">;
}, z.core.$strip>, z.ZodObject<{
    diff: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"turn/diff/updated">;
}, z.core.$strip>, z.ZodObject<{
    detail: z.ZodOptional<z.ZodString>;
    errorInfo: z.ZodOptional<z.ZodObject<{
        category: z.ZodEnum<{
            "active-turn-not-steerable": "active-turn-not-steerable";
            "bad-request": "bad-request";
            "budget-exceeded": "budget-exceeded";
            "connection-failed": "connection-failed";
            "context-window-exceeded": "context-window-exceeded";
            "max-output-tokens": "max-output-tokens";
            "max-turns": "max-turns";
            "rate-limit": "rate-limit";
            "stream-disconnected": "stream-disconnected";
            "structured-output-retries": "structured-output-retries";
            "thread-rollback-failed": "thread-rollback-failed";
            "too-many-failed-attempts": "too-many-failed-attempts";
            billing: "billing";
            internal: "internal";
            overloaded: "overloaded";
            policy: "policy";
            sandbox: "sandbox";
            unauthorized: "unauthorized";
            unknown: "unknown";
        }>;
        httpStatusCode: z.ZodNullable<z.ZodNumber>;
        providerCode: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    message: z.ZodString;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"provider/error">;
    willRetry: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    providerThreadId: z.ZodString;
    rateLimits: z.ZodObject<{
        kind: z.ZodEnum<{
            "spend-control": "spend-control";
            "subscription-window": "subscription-window";
            credits: "credits";
            unknown: "unknown";
        }>;
        overageReason: z.ZodNullable<z.ZodString>;
        overageStatus: z.ZodNullable<z.ZodEnum<{
            allowed: "allowed";
            rejected: "rejected";
            unavailable: "unavailable";
            warning: "warning";
        }>>;
        providerId: z.ZodString;
        reachedReason: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            allowed: "allowed";
            blocked: "blocked";
            unknown: "unknown";
            warning: "warning";
        }>;
        windows: z.ZodArray<z.ZodObject<{
            label: z.ZodNullable<z.ZodString>;
            providerKey: z.ZodNullable<z.ZodString>;
            resetsAtMs: z.ZodNullable<z.ZodNumber>;
            status: z.ZodEnum<{
                allowed: "allowed";
                blocked: "blocked";
                unknown: "unknown";
                warning: "warning";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"provider/rateLimits/updated">;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodString & z.ZodType<`${string}/${string}`, string, z.core.$ZodTypeInternals<`${string}/${string}`, string>>;
    payload: z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>;
    providerThreadId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"thread/extensionState/updated">;
}, z.core.$strip>, z.ZodObject<{
    category: z.ZodEnum<{
        "compaction-skipped": "compaction-skipped";
        config: "config";
        deprecation: "deprecation";
        general: "general";
    }>;
    details: z.ZodOptional<z.ZodString>;
    providerThreadId: z.ZodString;
    summary: z.ZodOptional<z.ZodString>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"provider/warning">;
}, z.core.$strip>, z.ZodObject<{
    fallbackModel: z.ZodString;
    message: z.ZodString;
    originalModel: z.ZodString;
    providerThreadId: z.ZodString;
    reason: z.ZodEnum<{
        provider: "provider";
        refusal: "refusal";
    }>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"provider/modelFallback">;
}, z.core.$strip>, z.ZodObject<{
    parentToolCallId: z.ZodOptional<z.ZodString>;
    providerId: z.ZodString;
    providerThreadId: z.ZodString;
    rawEvent: z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        jsonrpc: z.ZodLiteral<"2.0">;
        method: z.ZodString;
        params: z.ZodOptional<z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>;
    }, z.core.$strip>;
    rawType: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"provider/unhandled">;
}, z.core.$strip>], "type">, z.ZodObject<{
    scope: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"thread">;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"turn">;
        turnId: z.ZodString;
    }, z.core.$strip>], "kind">;
}, z.core.$strip>>, z.ZodIntersection<z.ZodDiscriminatedUnion<[z.ZodObject<{
    direction: z.ZodLiteral<"outbound">;
    initiator: z.ZodEnum<{
        agent: "agent";
        system: "system";
        user: "user";
    }>;
    request: z.ZodObject<{
        method: z.ZodEnum<{
            "thread/start": "thread/start";
            "turn/start": "turn/start";
        }>;
        params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>;
    source: z.ZodEnum<{
        spawn: "spawn";
        tell: "tell";
    }>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"client/thread/start">;
}, z.core.$strip>, z.ZodObject<{
    continuationOfRequestId: z.ZodOptional<z.ZodString>;
    direction: z.ZodLiteral<"outbound">;
    execution: z.ZodObject<{
        model: z.ZodString;
        permissionMode: z.ZodEnum<{
            "accept-edits": "accept-edits";
            "workspace-write": "workspace-write";
            auto: "auto";
            full: "full";
            readonly: "readonly";
        }>;
        reasoningLevel: z.ZodEnum<{
            high: "high";
            low: "low";
            max: "max";
            medium: "medium";
            none: "none";
            ultra: "ultra";
            ultracode: "ultracode";
            xhigh: "xhigh";
        }>;
        seq: z.ZodOptional<z.ZodNumber>;
        serviceTier: z.ZodEnum<{
            default: "default";
            fast: "fast";
        }>;
        source: z.ZodEnum<{
            "client/thread/start": "client/thread/start";
            "client/turn/requested": "client/turn/requested";
            "client/turn/start": "client/turn/start";
        }>;
    }, z.core.$strip>;
    initiator: z.ZodEnum<{
        agent: "agent";
        system: "system";
        user: "user";
    }>;
    input: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        mentions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            end: z.ZodNumber;
            resource: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDiscriminatedUnion<[z.ZodObject<{
                kind: z.ZodLiteral<"thread">;
                label: z.ZodString;
                projectId: z.ZodOptional<z.ZodString>;
                threadId: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"project">;
                label: z.ZodString;
                projectId: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"section">;
                label: z.ZodString;
                sectionId: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                entryKind: z.ZodEnum<{
                    directory: "directory";
                    file: "file";
                }>;
                kind: z.ZodLiteral<"path">;
                label: z.ZodString;
                path: z.ZodString;
                source: z.ZodEnum<{
                    "thread-storage": "thread-storage";
                    workspace: "workspace";
                }>;
            }, z.core.$strip>, z.ZodObject<{
                argumentHint: z.ZodNullable<z.ZodString>;
                kind: z.ZodLiteral<"command">;
                label: z.ZodString;
                name: z.ZodString;
                origin: z.ZodEnum<{
                    builtin: "builtin";
                    project: "project";
                    user: "user";
                }>;
                source: z.ZodEnum<{
                    command: "command";
                    skill: "skill";
                }>;
                trigger: z.ZodEnum<{
                    "/": "/";
                }>;
            }, z.core.$strip>, z.ZodObject<{
                icon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                itemId: z.ZodString;
                kind: z.ZodLiteral<"plugin">;
                label: z.ZodString;
                pluginId: z.ZodString;
            }, z.core.$strip>], "kind">>;
            start: z.ZodNumber;
        }, z.core.$strip>>>;
        text: z.ZodString;
        type: z.ZodLiteral<"text">;
        visibility: z.ZodOptional<z.ZodEnum<{
            "agent-only": "agent-only";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"image">;
        url: z.ZodString;
        visibility: z.ZodOptional<z.ZodEnum<{
            "agent-only": "agent-only";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        path: z.ZodString;
        type: z.ZodLiteral<"localImage">;
        visibility: z.ZodOptional<z.ZodEnum<{
            "agent-only": "agent-only";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        mimeType: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        sizeBytes: z.ZodOptional<z.ZodNumber>;
        type: z.ZodLiteral<"localFile">;
        visibility: z.ZodOptional<z.ZodEnum<{
            "agent-only": "agent-only";
        }>>;
    }, z.core.$strip>], "type">>;
    inputGroups: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        mentions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            end: z.ZodNumber;
            resource: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDiscriminatedUnion<[z.ZodObject<{
                kind: z.ZodLiteral<"thread">;
                label: z.ZodString;
                projectId: z.ZodOptional<z.ZodString>;
                threadId: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"project">;
                label: z.ZodString;
                projectId: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"section">;
                label: z.ZodString;
                sectionId: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                entryKind: z.ZodEnum<{
                    directory: "directory";
                    file: "file";
                }>;
                kind: z.ZodLiteral<"path">;
                label: z.ZodString;
                path: z.ZodString;
                source: z.ZodEnum<{
                    "thread-storage": "thread-storage";
                    workspace: "workspace";
                }>;
            }, z.core.$strip>, z.ZodObject<{
                argumentHint: z.ZodNullable<z.ZodString>;
                kind: z.ZodLiteral<"command">;
                label: z.ZodString;
                name: z.ZodString;
                origin: z.ZodEnum<{
                    builtin: "builtin";
                    project: "project";
                    user: "user";
                }>;
                source: z.ZodEnum<{
                    command: "command";
                    skill: "skill";
                }>;
                trigger: z.ZodEnum<{
                    "/": "/";
                }>;
            }, z.core.$strip>, z.ZodObject<{
                icon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                itemId: z.ZodString;
                kind: z.ZodLiteral<"plugin">;
                label: z.ZodString;
                pluginId: z.ZodString;
            }, z.core.$strip>], "kind">>;
            start: z.ZodNumber;
        }, z.core.$strip>>>;
        text: z.ZodString;
        type: z.ZodLiteral<"text">;
        visibility: z.ZodOptional<z.ZodEnum<{
            "agent-only": "agent-only";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"image">;
        url: z.ZodString;
        visibility: z.ZodOptional<z.ZodEnum<{
            "agent-only": "agent-only";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        path: z.ZodString;
        type: z.ZodLiteral<"localImage">;
        visibility: z.ZodOptional<z.ZodEnum<{
            "agent-only": "agent-only";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        mimeType: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        sizeBytes: z.ZodOptional<z.ZodNumber>;
        type: z.ZodLiteral<"localFile">;
        visibility: z.ZodOptional<z.ZodEnum<{
            "agent-only": "agent-only";
        }>>;
    }, z.core.$strip>], "type">>>>;
    request: z.ZodObject<{
        method: z.ZodEnum<{
            "thread/start": "thread/start";
            "turn/start": "turn/start";
        }>;
        params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>;
    requestId: z.ZodString;
    senderThreadId: z.ZodNullable<z.ZodString>;
    source: z.ZodEnum<{
        spawn: "spawn";
        tell: "tell";
    }>;
    systemMessageKind: z.ZodOptional<z.ZodEnum<{
        "child-completed": "child-completed";
        "child-failed": "child-failed";
        "child-interrupted": "child-interrupted";
        "child-needs-attention": "child-needs-attention";
        "child-outcome-batch": "child-outcome-batch";
        "ownership-assigned": "ownership-assigned";
        "ownership-removed": "ownership-removed";
        unlabeled: "unlabeled";
    }>>;
    systemMessageSubject: z.ZodOptional<z.ZodNullable<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"thread">;
        threadId: z.ZodString;
        threadName: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        count: z.ZodNumber;
        kind: z.ZodLiteral<"thread-batch">;
    }, z.core.$strip>], "kind">>>;
    target: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"thread-start">;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"new-turn">;
    }, z.core.$strip>, z.ZodObject<{
        expectedTurnId: z.ZodNullable<z.ZodString>;
        kind: z.ZodLiteral<"auto">;
    }, z.core.$strip>, z.ZodObject<{
        expectedTurnId: z.ZodNullable<z.ZodString>;
        kind: z.ZodLiteral<"steer">;
    }, z.core.$strip>], "kind">;
    threadId: z.ZodString;
    type: z.ZodLiteral<"client/turn/requested">;
}, z.core.$strip>, z.ZodObject<{
    message: z.ZodString;
    reason: z.ZodString;
    requestId: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"client/turn/rejected">;
}, z.core.$strip>, z.ZodObject<{
    direction: z.ZodLiteral<"outbound">;
    initiator: z.ZodEnum<{
        agent: "agent";
        system: "system";
        user: "user";
    }>;
    request: z.ZodObject<{
        method: z.ZodEnum<{
            "thread/start": "thread/start";
            "turn/start": "turn/start";
        }>;
        params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>;
    source: z.ZodEnum<{
        spawn: "spawn";
        tell: "tell";
    }>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"client/turn/start">;
}, z.core.$strip>, z.ZodObject<{
    code: z.ZodOptional<z.ZodString>;
    detail: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    reconnectAttempt: z.ZodOptional<z.ZodNumber>;
    reconnectTotal: z.ZodOptional<z.ZodNumber>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"system/error">;
}, z.core.$strip>, z.ZodObject<{
    text: z.ZodString;
    threadId: z.ZodString;
    toolCallId: z.ZodOptional<z.ZodString>;
    turnId: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"system/manager/user_message">;
}, z.core.$strip>, z.ZodObject<{
    reason: z.ZodEnum<{
        "host-daemon-restarted": "host-daemon-restarted";
        "manual-stop": "manual-stop";
        "provider-turn-idle": "provider-turn-idle";
    }>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"system/thread/interrupted">;
}, z.core.$strip>, z.ZodObject<{
    message: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>>;
    operation: z.ZodString;
    operationId: z.ZodString;
    status: z.ZodString;
    threadId: z.ZodString;
    type: z.ZodLiteral<"system/operation">;
}, z.core.$strip>, z.ZodObject<{
    interaction: z.ZodUnion<readonly [z.ZodObject<{
        id: z.ZodString;
        origin: z.ZodObject<{
            kind: z.ZodLiteral<"provider">;
            providerId: z.ZodString;
            providerRequestId: z.ZodString;
        }, z.core.$strip>;
        payload: z.ZodObject<{
            kind: z.ZodLiteral<"approval">;
            reason: z.ZodNullable<z.ZodString>;
            subject: z.ZodDiscriminatedUnion<[z.ZodObject<{
                actions: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                    command: z.ZodString;
                    name: z.ZodString;
                    path: z.ZodString;
                    type: z.ZodLiteral<"read">;
                }, z.core.$strip>, z.ZodObject<{
                    command: z.ZodString;
                    path: z.ZodNullable<z.ZodString>;
                    type: z.ZodLiteral<"listFiles">;
                }, z.core.$strip>, z.ZodObject<{
                    command: z.ZodString;
                    path: z.ZodNullable<z.ZodString>;
                    query: z.ZodNullable<z.ZodString>;
                    type: z.ZodLiteral<"search">;
                }, z.core.$strip>, z.ZodObject<{
                    command: z.ZodString;
                    type: z.ZodLiteral<"unknown">;
                }, z.core.$strip>], "type">>;
                command: z.ZodString;
                cwd: z.ZodNullable<z.ZodString>;
                itemId: z.ZodString;
                kind: z.ZodLiteral<"command">;
                sessionGrant: z.ZodNullable<z.ZodObject<{
                    fileSystem: z.ZodNullable<z.ZodObject<{
                        read: z.ZodArray<z.ZodString>;
                        write: z.ZodArray<z.ZodString>;
                    }, z.core.$strip>>;
                    network: z.ZodNullable<z.ZodObject<{
                        enabled: z.ZodNullable<z.ZodBoolean>;
                    }, z.core.$strip>>;
                }, z.core.$strict>>;
            }, z.core.$strip>, z.ZodObject<{
                itemId: z.ZodString;
                kind: z.ZodLiteral<"file_change">;
                sessionGrant: z.ZodNullable<z.ZodObject<{
                    fileSystem: z.ZodNullable<z.ZodObject<{
                        read: z.ZodArray<z.ZodString>;
                        write: z.ZodArray<z.ZodString>;
                    }, z.core.$strip>>;
                    network: z.ZodNullable<z.ZodObject<{
                        enabled: z.ZodNullable<z.ZodBoolean>;
                    }, z.core.$strip>>;
                }, z.core.$strict>>;
                writeScope: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                itemId: z.ZodString;
                kind: z.ZodLiteral<"permission_grant">;
                permissions: z.ZodObject<{
                    fileSystem: z.ZodNullable<z.ZodObject<{
                        read: z.ZodArray<z.ZodString>;
                        write: z.ZodArray<z.ZodString>;
                    }, z.core.$strip>>;
                    network: z.ZodNullable<z.ZodObject<{
                        enabled: z.ZodNullable<z.ZodBoolean>;
                    }, z.core.$strip>>;
                }, z.core.$strict>;
                toolName: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                itemId: z.ZodString;
                kind: z.ZodLiteral<"plan">;
                plan: z.ZodString;
                planFilePath: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                itemId: z.ZodString;
                kind: z.ZodLiteral<"tool_use">;
                presentation: z.ZodObject<{
                    detail: z.ZodOptional<z.ZodString>;
                    icon: z.ZodObject<{
                        glyph: z.ZodString;
                    }, z.core.$strip>;
                    label: z.ZodObject<{
                        completed: z.ZodString;
                        pending: z.ZodString;
                    }, z.core.$strip>;
                    suppress: z.ZodOptional<z.ZodBoolean>;
                    tint: z.ZodOptional<z.ZodObject<{
                        dark: z.ZodString;
                        light: z.ZodString;
                    }, z.core.$strip>>;
                    title: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>;
                tool: z.ZodString;
            }, z.core.$strip>], "kind">;
        }, z.core.$strip>;
        resolution: z.ZodNullable<z.ZodDiscriminatedUnion<[z.ZodObject<{
            decision: z.ZodLiteral<"allow_once">;
            grantedPermissions: z.ZodNullable<z.ZodObject<{
                fileSystem: z.ZodNullable<z.ZodObject<{
                    read: z.ZodArray<z.ZodString>;
                    write: z.ZodArray<z.ZodString>;
                }, z.core.$strip>>;
                network: z.ZodNullable<z.ZodObject<{
                    enabled: z.ZodNullable<z.ZodBoolean>;
                }, z.core.$strip>>;
            }, z.core.$strict>>;
        }, z.core.$strip>, z.ZodObject<{
            decision: z.ZodLiteral<"allow_for_session">;
            grantedPermissions: z.ZodNullable<z.ZodObject<{
                fileSystem: z.ZodNullable<z.ZodObject<{
                    read: z.ZodArray<z.ZodString>;
                    write: z.ZodArray<z.ZodString>;
                }, z.core.$strip>>;
                network: z.ZodNullable<z.ZodObject<{
                    enabled: z.ZodNullable<z.ZodBoolean>;
                }, z.core.$strip>>;
            }, z.core.$strict>>;
        }, z.core.$strip>, z.ZodObject<{
            decision: z.ZodLiteral<"deny">;
        }, z.core.$strip>], "decision">>;
        status: z.ZodEnum<{
            interrupted: "interrupted";
            pending: "pending";
            resolved: "resolved";
            resolving: "resolving";
        }>;
        statusReason: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        origin: z.ZodObject<{
            kind: z.ZodLiteral<"provider">;
            providerId: z.ZodString;
            providerRequestId: z.ZodString;
        }, z.core.$strip>;
        payload: z.ZodObject<{
            kind: z.ZodLiteral<"user_question">;
            questions: z.ZodArray<z.ZodObject<{
                allowFreeText: z.ZodBoolean;
                id: z.ZodString;
                multiSelect: z.ZodBoolean;
                options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    description: z.ZodOptional<z.ZodString>;
                    label: z.ZodString;
                    value: z.ZodString;
                }, z.core.$strip>>>;
                prompt: z.ZodString;
                shortLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        resolution: z.ZodNullable<z.ZodObject<{
            answers: z.ZodRecord<z.ZodString, z.ZodObject<{
                freeText: z.ZodOptional<z.ZodString>;
                selected: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            kind: z.ZodLiteral<"user_answer">;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            interrupted: "interrupted";
            pending: "pending";
            resolved: "resolved";
            resolving: "resolving";
        }>;
        statusReason: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        origin: z.ZodObject<{
            kind: z.ZodLiteral<"plugin">;
            pluginId: z.ZodString;
            rendererId: z.ZodString;
        }, z.core.$strip>;
        payload: z.ZodObject<{
            kind: z.ZodLiteral<"plugin">;
            title: z.ZodString;
        }, z.core.$strip>;
        resolution: z.ZodNullable<z.ZodObject<{
            kind: z.ZodLiteral<"plugin_submitted">;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            interrupted: "interrupted";
            pending: "pending";
            resolved: "resolved";
            resolving: "resolving";
        }>;
        statusReason: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        origin: z.ZodObject<{
            kind: z.ZodLiteral<"provider">;
            providerId: z.ZodString;
            providerRequestId: z.ZodString;
        }, z.core.$strip>;
        payload: z.ZodObject<{
            kind: z.ZodString & z.ZodType<`${string}/${string}`, string, z.core.$ZodTypeInternals<`${string}/${string}`, string>>;
            title: z.ZodString;
        }, z.core.$strip>;
        resolution: z.ZodNullable<z.ZodObject<{
            kind: z.ZodLiteral<"request_answer">;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            interrupted: "interrupted";
            pending: "pending";
            resolved: "resolved";
            resolving: "resolving";
        }>;
        statusReason: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>]>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"system/interaction/lifecycle">;
}, z.core.$strip>, z.ZodObject<{
    interactionId: z.ZodString;
    providerId: z.ZodString;
    providerRequestId: z.ZodString;
    resolution: z.ZodDefault<z.ZodNullable<z.ZodDiscriminatedUnion<[z.ZodObject<{
        decision: z.ZodLiteral<"allow_once">;
        grantedPermissions: z.ZodNullable<z.ZodObject<{
            fileSystem: z.ZodNullable<z.ZodObject<{
                read: z.ZodArray<z.ZodString>;
                write: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            network: z.ZodNullable<z.ZodObject<{
                enabled: z.ZodNullable<z.ZodBoolean>;
            }, z.core.$strip>>;
        }, z.core.$strict>>;
    }, z.core.$strip>, z.ZodObject<{
        decision: z.ZodLiteral<"allow_for_session">;
        grantedPermissions: z.ZodNullable<z.ZodObject<{
            fileSystem: z.ZodNullable<z.ZodObject<{
                read: z.ZodArray<z.ZodString>;
                write: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            network: z.ZodNullable<z.ZodObject<{
                enabled: z.ZodNullable<z.ZodBoolean>;
            }, z.core.$strip>>;
        }, z.core.$strict>>;
    }, z.core.$strip>, z.ZodObject<{
        decision: z.ZodLiteral<"deny">;
    }, z.core.$strip>], "decision">>>;
    status: z.ZodEnum<{
        interrupted: "interrupted";
        pending: "pending";
        resolved: "resolved";
        resolving: "resolving";
    }>;
    statusReason: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    subject: z.ZodObject<{
        itemId: z.ZodString;
        kind: z.ZodLiteral<"permission_grant">;
        permissions: z.ZodObject<{
            fileSystem: z.ZodNullable<z.ZodObject<{
                read: z.ZodArray<z.ZodString>;
                write: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            network: z.ZodNullable<z.ZodObject<{
                enabled: z.ZodNullable<z.ZodBoolean>;
            }, z.core.$strip>>;
        }, z.core.$strict>;
        toolName: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"system/permissionGrant/lifecycle">;
}, z.core.$strip>, z.ZodObject<{
    interactionId: z.ZodString;
    payload: z.ZodObject<{
        kind: z.ZodLiteral<"user_question">;
        questions: z.ZodArray<z.ZodObject<{
            allowFreeText: z.ZodBoolean;
            id: z.ZodString;
            multiSelect: z.ZodBoolean;
            options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                description: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
                value: z.ZodString;
            }, z.core.$strip>>>;
            prompt: z.ZodString;
            shortLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    providerId: z.ZodString;
    providerRequestId: z.ZodString;
    resolution: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        answers: z.ZodRecord<z.ZodString, z.ZodObject<{
            freeText: z.ZodOptional<z.ZodString>;
            selected: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        kind: z.ZodLiteral<"user_answer">;
    }, z.core.$strip>>>;
    status: z.ZodEnum<{
        interrupted: "interrupted";
        pending: "pending";
        resolved: "resolved";
        resolving: "resolving";
    }>;
    statusReason: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"system/userQuestion/lifecycle">;
}, z.core.$strip>, z.ZodObject<{
    entries: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        startedAt: z.ZodOptional<z.ZodNumber>;
        status: z.ZodOptional<z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            started: "started";
        }>>;
        text: z.ZodString;
        type: z.ZodEnum<{
            output: "output";
            step: "step";
        }>;
    }, z.core.$strip>>;
    environmentId: z.ZodString;
    provisioningId: z.ZodString;
    status: z.ZodEnum<{
        active: "active";
        cancelled: "cancelled";
        completed: "completed";
        failed: "failed";
    }>;
    threadId: z.ZodString;
    type: z.ZodLiteral<"system/thread-provisioning">;
}, z.core.$strip>, z.ZodObject<{
    activeTurnId: z.ZodString;
    activeTurnStartedAt: z.ZodNumber;
    elapsedMs: z.ZodNumber;
    firedAt: z.ZodNumber;
    lastActivityEventAt: z.ZodNumber;
    lastActivityEventSequence: z.ZodNumber;
    lastActivityEventType: z.ZodString;
    providerId: z.ZodString;
    providerThreadId: z.ZodNullable<z.ZodString>;
    reason: z.ZodLiteral<"provider-turn-idle">;
    threadId: z.ZodString;
    thresholdMs: z.ZodNumber;
    type: z.ZodLiteral<"system/provider-turn-watchdog">;
}, z.core.$strip>], "type">, z.ZodObject<{
    scope: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"thread">;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"turn">;
        turnId: z.ZodString;
    }, z.core.$strip>], "kind">;
}, z.core.$strip>>]>>;
type ThreadEvent = z.infer<typeof threadEventSchema>;

declare const promptInputSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    mentions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        end: z.ZodNumber;
        resource: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"thread">;
            label: z.ZodString;
            projectId: z.ZodOptional<z.ZodString>;
            threadId: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"project">;
            label: z.ZodString;
            projectId: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"section">;
            label: z.ZodString;
            sectionId: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            entryKind: z.ZodEnum<{
                directory: "directory";
                file: "file";
            }>;
            kind: z.ZodLiteral<"path">;
            label: z.ZodString;
            path: z.ZodString;
            source: z.ZodEnum<{
                "thread-storage": "thread-storage";
                workspace: "workspace";
            }>;
        }, z.core.$strip>, z.ZodObject<{
            argumentHint: z.ZodNullable<z.ZodString>;
            kind: z.ZodLiteral<"command">;
            label: z.ZodString;
            name: z.ZodString;
            origin: z.ZodEnum<{
                builtin: "builtin";
                project: "project";
                user: "user";
            }>;
            source: z.ZodEnum<{
                command: "command";
                skill: "skill";
            }>;
            trigger: z.ZodEnum<{
                "/": "/";
            }>;
        }, z.core.$strip>, z.ZodObject<{
            icon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            itemId: z.ZodString;
            kind: z.ZodLiteral<"plugin">;
            label: z.ZodString;
            pluginId: z.ZodString;
        }, z.core.$strip>], "kind">>;
        start: z.ZodNumber;
    }, z.core.$strip>>>;
    text: z.ZodString;
    type: z.ZodLiteral<"text">;
    visibility: z.ZodOptional<z.ZodEnum<{
        "agent-only": "agent-only";
    }>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"image">;
    url: z.ZodString;
    visibility: z.ZodOptional<z.ZodEnum<{
        "agent-only": "agent-only";
    }>>;
}, z.core.$strip>, z.ZodObject<{
    path: z.ZodString;
    type: z.ZodLiteral<"localImage">;
    visibility: z.ZodOptional<z.ZodEnum<{
        "agent-only": "agent-only";
    }>>;
}, z.core.$strip>, z.ZodObject<{
    mimeType: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    path: z.ZodString;
    sizeBytes: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"localFile">;
    visibility: z.ZodOptional<z.ZodEnum<{
        "agent-only": "agent-only";
    }>>;
}, z.core.$strip>], "type">;
type PromptInput = z.infer<typeof promptInputSchema>;

/**
 * The inclusive `[min, max]` range of `thread/delta` grammar versions a bridge
 * speaks. Distinct from the JSON-RPC `protocolVersion`: the envelope can stay
 * put while the delta vocabulary grows, and a bridge that speaks both v2 and
 * v3 says so here instead of forcing a daemon bump.
 */
declare const bridgeGrammarVersionsSchema: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
type BridgeGrammarVersions = z.infer<typeof bridgeGrammarVersionsSchema>;

declare const threadDeltaSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    clientRequestId: z.ZodString;
    kind: z.ZodLiteral<"input.accepted">;
    providerTurnId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"input.provider">;
    parentRef: z.ZodOptional<z.ZodString>;
    text: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"turn.open">;
    parentRef: z.ZodOptional<z.ZodString>;
    providerTurnId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    claimIfIdle: z.ZodOptional<z.ZodBoolean>;
    error: z.ZodOptional<z.ZodObject<{
        message: z.ZodString;
    }, z.core.$strip>>;
    kind: z.ZodLiteral<"turn.boundary">;
    providerCheckpointId: z.ZodOptional<z.ZodString>;
    providerTurnId: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
    }>;
}, z.core.$strip>, z.ZodObject<{
    attach: z.ZodOptional<z.ZodEnum<{
        currentOrLast: "currentOrLast";
        open: "open";
    }>>;
    item: z.ZodDiscriminatedUnion<[z.ZodObject<{
        aggregatedOutput: z.ZodOptional<z.ZodString>;
        command: z.ZodString;
        cwd: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        exitCode: z.ZodOptional<z.ZodNumber>;
        type: z.ZodLiteral<"command">;
    }, z.core.$strip>, z.ZodObject<{
        changes: z.ZodArray<z.ZodObject<{
            diff: z.ZodOptional<z.ZodString>;
            kind: z.ZodEnum<{
                add: "add";
                delete: "delete";
                update: "update";
            }>;
            movePath: z.ZodOptional<z.ZodString>;
            newText: z.ZodOptional<z.ZodString>;
            oldText: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"fileChange">;
    }, z.core.$strip>, z.ZodObject<{
        args: z.ZodOptional<z.ZodUnknown>;
        durationMs: z.ZodOptional<z.ZodNumber>;
        error: z.ZodOptional<z.ZodString>;
        result: z.ZodOptional<z.ZodUnknown>;
        server: z.ZodOptional<z.ZodString>;
        tool: z.ZodString;
        type: z.ZodLiteral<"tool">;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"compaction">;
    }, z.core.$strip>, z.ZodObject<{
        text: z.ZodString;
        type: z.ZodLiteral<"agentMessage">;
    }, z.core.$strip>, z.ZodObject<{
        content: z.ZodArray<z.ZodString>;
        summary: z.ZodArray<z.ZodString>;
        type: z.ZodLiteral<"reasoning">;
    }, z.core.$strip>, z.ZodObject<{
        text: z.ZodString;
        type: z.ZodLiteral<"plan">;
    }, z.core.$strip>, z.ZodObject<{
        queries: z.ZodArray<z.ZodString>;
        type: z.ZodLiteral<"webSearch">;
    }, z.core.$strip>, z.ZodObject<{
        pattern: z.ZodNullable<z.ZodString>;
        prompt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodLiteral<"webFetch">;
        url: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        path: z.ZodString;
        type: z.ZodLiteral<"imageView">;
    }, z.core.$strip>, z.ZodObject<{
        description: z.ZodString;
        error: z.ZodOptional<z.ZodString>;
        familyId: z.ZodString;
        outputFile: z.ZodOptional<z.ZodString>;
        skipTranscript: z.ZodBoolean;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        summary: z.ZodOptional<z.ZodString>;
        taskStatus: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            killed: "killed";
            paused: "paused";
            pending: "pending";
            running: "running";
            stopped: "stopped";
        }>;
        taskType: z.ZodString;
        type: z.ZodLiteral<"backgroundTask">;
        usage: z.ZodOptional<z.ZodObject<{
            durationMs: z.ZodNumber;
            toolUses: z.ZodNumber;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>>;
        workflow: z.ZodOptional<z.ZodObject<{
            agents: z.ZodArray<z.ZodObject<{
                agentType: z.ZodOptional<z.ZodString>;
                attempt: z.ZodNumber;
                cached: z.ZodBoolean;
                durationMs: z.ZodOptional<z.ZodNumber>;
                error: z.ZodOptional<z.ZodString>;
                index: z.ZodNumber;
                isolation: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
                lastProgressAt: z.ZodNumber;
                lastToolName: z.ZodOptional<z.ZodString>;
                lastToolSummary: z.ZodOptional<z.ZodString>;
                model: z.ZodString;
                phaseIndex: z.ZodOptional<z.ZodNumber>;
                phaseTitle: z.ZodOptional<z.ZodString>;
                promptPreview: z.ZodOptional<z.ZodString>;
                queuedAt: z.ZodOptional<z.ZodNumber>;
                resultPreview: z.ZodOptional<z.ZodString>;
                startedAt: z.ZodOptional<z.ZodNumber>;
                state: z.ZodEnum<{
                    done: "done";
                    failed: "failed";
                    queued: "queued";
                    running: "running";
                    skipped: "skipped";
                }>;
                tokens: z.ZodOptional<z.ZodNumber>;
                toolCalls: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            phases: z.ZodArray<z.ZodObject<{
                index: z.ZodNumber;
                kind: z.ZodOptional<z.ZodString>;
                title: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        workflowName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        cmd: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        type: z.ZodLiteral<"fileRead">;
    }, z.core.$strip>, z.ZodObject<{
        cmd: z.ZodOptional<z.ZodString>;
        mode: z.ZodEnum<{
            content: "content";
            list: "list";
            path: "path";
        }>;
        path: z.ZodOptional<z.ZodString>;
        query: z.ZodString;
        type: z.ZodLiteral<"search">;
    }, z.core.$strip>, z.ZodObject<{
        background: z.ZodBoolean;
        childRef: z.ZodString;
        label: z.ZodString;
        summary: z.ZodOptional<z.ZodString>;
        type: z.ZodLiteral<"delegation">;
    }, z.core.$strip>, z.ZodObject<{
        explanation: z.ZodOptional<z.ZodString>;
        steps: z.ZodArray<z.ZodObject<{
            status: z.ZodOptional<z.ZodEnum<{
                active: "active";
                completed: "completed";
                failed: "failed";
                pending: "pending";
            }>>;
            step: z.ZodString;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"planSteps">;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodString & z.ZodType<`${string}/${string}`, string, z.core.$ZodTypeInternals<`${string}/${string}`, string>>;
        payload: z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>;
        type: z.ZodLiteral<"extension">;
    }, z.core.$strip>], "type">;
    key: z.ZodObject<{
        channel: z.ZodOptional<z.ZodString>;
        parentRef: z.ZodOptional<z.ZodString>;
        providerItemId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    kind: z.ZodLiteral<"item.open">;
    noTurnFallback: z.ZodOptional<z.ZodObject<{
        raw: z.ZodObject<{
            id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            jsonrpc: z.ZodLiteral<"2.0">;
            method: z.ZodString;
            params: z.ZodOptional<z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>;
        }, z.core.$strip>;
        rawType: z.ZodString;
    }, z.core.$strip>>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    providerTurnId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    aggregatedOutput: z.ZodOptional<z.ZodString>;
    approvalStatus: z.ZodOptional<z.ZodLiteral<"denied">>;
    exitCode: z.ZodOptional<z.ZodNumber>;
    item: z.ZodDiscriminatedUnion<[z.ZodObject<{
        aggregatedOutput: z.ZodOptional<z.ZodString>;
        command: z.ZodString;
        cwd: z.ZodString;
        durationMs: z.ZodOptional<z.ZodNumber>;
        exitCode: z.ZodOptional<z.ZodNumber>;
        type: z.ZodLiteral<"command">;
    }, z.core.$strip>, z.ZodObject<{
        changes: z.ZodArray<z.ZodObject<{
            diff: z.ZodOptional<z.ZodString>;
            kind: z.ZodEnum<{
                add: "add";
                delete: "delete";
                update: "update";
            }>;
            movePath: z.ZodOptional<z.ZodString>;
            newText: z.ZodOptional<z.ZodString>;
            oldText: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"fileChange">;
    }, z.core.$strip>, z.ZodObject<{
        args: z.ZodOptional<z.ZodUnknown>;
        durationMs: z.ZodOptional<z.ZodNumber>;
        error: z.ZodOptional<z.ZodString>;
        result: z.ZodOptional<z.ZodUnknown>;
        server: z.ZodOptional<z.ZodString>;
        tool: z.ZodString;
        type: z.ZodLiteral<"tool">;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"compaction">;
    }, z.core.$strip>, z.ZodObject<{
        text: z.ZodString;
        type: z.ZodLiteral<"agentMessage">;
    }, z.core.$strip>, z.ZodObject<{
        content: z.ZodArray<z.ZodString>;
        summary: z.ZodArray<z.ZodString>;
        type: z.ZodLiteral<"reasoning">;
    }, z.core.$strip>, z.ZodObject<{
        text: z.ZodString;
        type: z.ZodLiteral<"plan">;
    }, z.core.$strip>, z.ZodObject<{
        queries: z.ZodArray<z.ZodString>;
        type: z.ZodLiteral<"webSearch">;
    }, z.core.$strip>, z.ZodObject<{
        pattern: z.ZodNullable<z.ZodString>;
        prompt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodLiteral<"webFetch">;
        url: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        path: z.ZodString;
        type: z.ZodLiteral<"imageView">;
    }, z.core.$strip>, z.ZodObject<{
        description: z.ZodString;
        error: z.ZodOptional<z.ZodString>;
        familyId: z.ZodString;
        outputFile: z.ZodOptional<z.ZodString>;
        skipTranscript: z.ZodBoolean;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        summary: z.ZodOptional<z.ZodString>;
        taskStatus: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            killed: "killed";
            paused: "paused";
            pending: "pending";
            running: "running";
            stopped: "stopped";
        }>;
        taskType: z.ZodString;
        type: z.ZodLiteral<"backgroundTask">;
        usage: z.ZodOptional<z.ZodObject<{
            durationMs: z.ZodNumber;
            toolUses: z.ZodNumber;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>>;
        workflow: z.ZodOptional<z.ZodObject<{
            agents: z.ZodArray<z.ZodObject<{
                agentType: z.ZodOptional<z.ZodString>;
                attempt: z.ZodNumber;
                cached: z.ZodBoolean;
                durationMs: z.ZodOptional<z.ZodNumber>;
                error: z.ZodOptional<z.ZodString>;
                index: z.ZodNumber;
                isolation: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
                lastProgressAt: z.ZodNumber;
                lastToolName: z.ZodOptional<z.ZodString>;
                lastToolSummary: z.ZodOptional<z.ZodString>;
                model: z.ZodString;
                phaseIndex: z.ZodOptional<z.ZodNumber>;
                phaseTitle: z.ZodOptional<z.ZodString>;
                promptPreview: z.ZodOptional<z.ZodString>;
                queuedAt: z.ZodOptional<z.ZodNumber>;
                resultPreview: z.ZodOptional<z.ZodString>;
                startedAt: z.ZodOptional<z.ZodNumber>;
                state: z.ZodEnum<{
                    done: "done";
                    failed: "failed";
                    queued: "queued";
                    running: "running";
                    skipped: "skipped";
                }>;
                tokens: z.ZodOptional<z.ZodNumber>;
                toolCalls: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            phases: z.ZodArray<z.ZodObject<{
                index: z.ZodNumber;
                kind: z.ZodOptional<z.ZodString>;
                title: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        workflowName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        cmd: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        type: z.ZodLiteral<"fileRead">;
    }, z.core.$strip>, z.ZodObject<{
        cmd: z.ZodOptional<z.ZodString>;
        mode: z.ZodEnum<{
            content: "content";
            list: "list";
            path: "path";
        }>;
        path: z.ZodOptional<z.ZodString>;
        query: z.ZodString;
        type: z.ZodLiteral<"search">;
    }, z.core.$strip>, z.ZodObject<{
        background: z.ZodBoolean;
        childRef: z.ZodString;
        label: z.ZodString;
        summary: z.ZodOptional<z.ZodString>;
        type: z.ZodLiteral<"delegation">;
    }, z.core.$strip>, z.ZodObject<{
        explanation: z.ZodOptional<z.ZodString>;
        steps: z.ZodArray<z.ZodObject<{
            status: z.ZodOptional<z.ZodEnum<{
                active: "active";
                completed: "completed";
                failed: "failed";
                pending: "pending";
            }>>;
            step: z.ZodString;
        }, z.core.$strip>>;
        type: z.ZodLiteral<"planSteps">;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodString & z.ZodType<`${string}/${string}`, string, z.core.$ZodTypeInternals<`${string}/${string}`, string>>;
        payload: z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>;
        type: z.ZodLiteral<"extension">;
    }, z.core.$strip>], "type">;
    key: z.ZodObject<{
        channel: z.ZodOptional<z.ZodString>;
        parentRef: z.ZodOptional<z.ZodString>;
        providerItemId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    kind: z.ZodLiteral<"item.close">;
    noTurnFallback: z.ZodOptional<z.ZodObject<{
        raw: z.ZodObject<{
            id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            jsonrpc: z.ZodLiteral<"2.0">;
            method: z.ZodString;
            params: z.ZodOptional<z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>;
        }, z.core.$strip>;
        rawType: z.ZodString;
    }, z.core.$strip>>;
    presentation: z.ZodOptional<z.ZodObject<{
        detail: z.ZodOptional<z.ZodString>;
        icon: z.ZodObject<{
            glyph: z.ZodString;
        }, z.core.$strip>;
        label: z.ZodObject<{
            completed: z.ZodString;
            pending: z.ZodString;
        }, z.core.$strip>;
        suppress: z.ZodOptional<z.ZodBoolean>;
        tint: z.ZodOptional<z.ZodObject<{
            dark: z.ZodString;
            light: z.ZodString;
        }, z.core.$strip>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    providerTurnId: z.ZodOptional<z.ZodString>;
    resultText: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        interrupted: "interrupted";
        pending: "pending";
    }>;
}, z.core.$strip>, z.ZodObject<{
    flush: z.ZodOptional<z.ZodBoolean>;
    key: z.ZodObject<{
        channel: z.ZodOptional<z.ZodString>;
        parentRef: z.ZodOptional<z.ZodString>;
        providerItemId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    kind: z.ZodLiteral<"item.progress">;
    message: z.ZodOptional<z.ZodString>;
    noTurnFallback: z.ZodOptional<z.ZodObject<{
        raw: z.ZodObject<{
            id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            jsonrpc: z.ZodLiteral<"2.0">;
            method: z.ZodString;
            params: z.ZodOptional<z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>;
        }, z.core.$strip>;
        rawType: z.ZodString;
    }, z.core.$strip>>;
    providerTurnId: z.ZodOptional<z.ZodString>;
    snapshot: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        description: z.ZodString;
        error: z.ZodOptional<z.ZodString>;
        familyId: z.ZodString;
        outputFile: z.ZodOptional<z.ZodString>;
        skipTranscript: z.ZodBoolean;
        status: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            interrupted: "interrupted";
            pending: "pending";
        }>;
        summary: z.ZodOptional<z.ZodString>;
        taskStatus: z.ZodEnum<{
            completed: "completed";
            failed: "failed";
            killed: "killed";
            paused: "paused";
            pending: "pending";
            running: "running";
            stopped: "stopped";
        }>;
        taskType: z.ZodString;
        type: z.ZodLiteral<"backgroundTask">;
        usage: z.ZodOptional<z.ZodObject<{
            durationMs: z.ZodNumber;
            toolUses: z.ZodNumber;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>>;
        workflow: z.ZodOptional<z.ZodObject<{
            agents: z.ZodArray<z.ZodObject<{
                agentType: z.ZodOptional<z.ZodString>;
                attempt: z.ZodNumber;
                cached: z.ZodBoolean;
                durationMs: z.ZodOptional<z.ZodNumber>;
                error: z.ZodOptional<z.ZodString>;
                index: z.ZodNumber;
                isolation: z.ZodOptional<z.ZodString>;
                label: z.ZodString;
                lastProgressAt: z.ZodNumber;
                lastToolName: z.ZodOptional<z.ZodString>;
                lastToolSummary: z.ZodOptional<z.ZodString>;
                model: z.ZodString;
                phaseIndex: z.ZodOptional<z.ZodNumber>;
                phaseTitle: z.ZodOptional<z.ZodString>;
                promptPreview: z.ZodOptional<z.ZodString>;
                queuedAt: z.ZodOptional<z.ZodNumber>;
                resultPreview: z.ZodOptional<z.ZodString>;
                startedAt: z.ZodOptional<z.ZodNumber>;
                state: z.ZodEnum<{
                    done: "done";
                    failed: "failed";
                    queued: "queued";
                    running: "running";
                    skipped: "skipped";
                }>;
                tokens: z.ZodOptional<z.ZodNumber>;
                toolCalls: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            phases: z.ZodArray<z.ZodObject<{
                index: z.ZodNumber;
                kind: z.ZodOptional<z.ZodString>;
                title: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        workflowName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        background: z.ZodBoolean;
        childRef: z.ZodString;
        label: z.ZodString;
        summary: z.ZodOptional<z.ZodString>;
        type: z.ZodLiteral<"delegation">;
    }, z.core.$strip>], "type">>;
}, z.core.$strip>, z.ZodObject<{
    channel: z.ZodEnum<{
        agentMessage: "agentMessage";
        plan: "plan";
        reasoningSummary: "reasoningSummary";
        reasoningText: "reasoningText";
    }>;
    key: z.ZodObject<{
        channel: z.ZodOptional<z.ZodString>;
        parentRef: z.ZodOptional<z.ZodString>;
        providerItemId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    kind: z.ZodLiteral<"item.textDelta">;
    noTurnFallback: z.ZodOptional<z.ZodObject<{
        raw: z.ZodObject<{
            id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            jsonrpc: z.ZodLiteral<"2.0">;
            method: z.ZodString;
            params: z.ZodOptional<z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>;
        }, z.core.$strip>;
        rawType: z.ZodString;
    }, z.core.$strip>>;
    providerTurnId: z.ZodOptional<z.ZodString>;
    text: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    channel: z.ZodEnum<{
        agentMessage: "agentMessage";
        plan: "plan";
        reasoningSummary: "reasoningSummary";
        reasoningText: "reasoningText";
    }>;
    key: z.ZodObject<{
        channel: z.ZodOptional<z.ZodString>;
        parentRef: z.ZodOptional<z.ZodString>;
        providerItemId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    kind: z.ZodLiteral<"item.textClose">;
    noTurnFallback: z.ZodOptional<z.ZodObject<{
        raw: z.ZodObject<{
            id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            jsonrpc: z.ZodLiteral<"2.0">;
            method: z.ZodString;
            params: z.ZodOptional<z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>;
        }, z.core.$strip>;
        rawType: z.ZodString;
    }, z.core.$strip>>;
    providerTurnId: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    channel: z.ZodEnum<{
        command: "command";
        fileChange: "fileChange";
    }>;
    key: z.ZodObject<{
        channel: z.ZodOptional<z.ZodString>;
        parentRef: z.ZodOptional<z.ZodString>;
        providerItemId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    kind: z.ZodLiteral<"item.outputDelta">;
    noTurnFallback: z.ZodOptional<z.ZodObject<{
        raw: z.ZodObject<{
            id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            jsonrpc: z.ZodLiteral<"2.0">;
            method: z.ZodString;
            params: z.ZodOptional<z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>;
        }, z.core.$strip>;
        rawType: z.ZodString;
    }, z.core.$strip>>;
    providerTurnId: z.ZodOptional<z.ZodString>;
    text: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    key: z.ZodObject<{
        channel: z.ZodOptional<z.ZodString>;
        parentRef: z.ZodOptional<z.ZodString>;
        providerItemId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    kind: z.ZodLiteral<"command.outputSnapshot">;
    noTurnFallback: z.ZodOptional<z.ZodObject<{
        raw: z.ZodObject<{
            id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            jsonrpc: z.ZodLiteral<"2.0">;
            method: z.ZodString;
            params: z.ZodOptional<z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>;
        }, z.core.$strip>;
        rawType: z.ZodString;
    }, z.core.$strip>>;
    text: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"usage">;
    last: z.ZodObject<{
        cachedInputTokens: z.ZodNumber;
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        reasoningOutputTokens: z.ZodNumber;
        totalTokens: z.ZodNumber;
    }, z.core.$strip>;
    modelContextWindow: z.ZodNullable<z.ZodNumber>;
    providerTurnId: z.ZodOptional<z.ZodString>;
    total: z.ZodObject<{
        cachedInputTokens: z.ZodNumber;
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        reasoningOutputTokens: z.ZodNumber;
        totalTokens: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    attach: z.ZodEnum<{
        currentOrLast: "currentOrLast";
        open: "open";
    }>;
    estimated: z.ZodBoolean;
    kind: z.ZodLiteral<"contextWindow">;
    providerTurnId: z.ZodOptional<z.ZodString>;
    size: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    used: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"context.compacted">;
    noTurnFallback: z.ZodOptional<z.ZodObject<{
        raw: z.ZodObject<{
            id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            jsonrpc: z.ZodLiteral<"2.0">;
            method: z.ZodString;
            params: z.ZodOptional<z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>;
        }, z.core.$strip>;
        rawType: z.ZodString;
    }, z.core.$strip>>;
    providerTurnId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"context.cleared">;
}, z.core.$strip>, z.ZodObject<{
    diff: z.ZodString;
    kind: z.ZodLiteral<"turn.diff">;
    providerTurnId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"thread.started">;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"thread.identity">;
    providerThreadId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"thread.name">;
    name: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    extensionKind: z.ZodString & z.ZodType<`${string}/${string}`, string, z.core.$ZodTypeInternals<`${string}/${string}`, string>>;
    kind: z.ZodLiteral<"extension.state">;
    payload: z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"provider.rateLimits">;
    rateLimits: z.ZodObject<{
        kind: z.ZodEnum<{
            "spend-control": "spend-control";
            "subscription-window": "subscription-window";
            credits: "credits";
            unknown: "unknown";
        }>;
        overageReason: z.ZodNullable<z.ZodString>;
        overageStatus: z.ZodNullable<z.ZodEnum<{
            allowed: "allowed";
            rejected: "rejected";
            unavailable: "unavailable";
            warning: "warning";
        }>>;
        providerId: z.ZodString;
        reachedReason: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            allowed: "allowed";
            blocked: "blocked";
            unknown: "unknown";
            warning: "warning";
        }>;
        windows: z.ZodArray<z.ZodObject<{
            label: z.ZodNullable<z.ZodString>;
            providerKey: z.ZodNullable<z.ZodString>;
            resetsAtMs: z.ZodNullable<z.ZodNumber>;
            status: z.ZodEnum<{
                allowed: "allowed";
                blocked: "blocked";
                unknown: "unknown";
                warning: "warning";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    category: z.ZodOptional<z.ZodEnum<{
        "active-turn-not-steerable": "active-turn-not-steerable";
        "bad-request": "bad-request";
        "budget-exceeded": "budget-exceeded";
        "connection-failed": "connection-failed";
        "context-window-exceeded": "context-window-exceeded";
        "max-output-tokens": "max-output-tokens";
        "max-turns": "max-turns";
        "rate-limit": "rate-limit";
        "stream-disconnected": "stream-disconnected";
        "structured-output-retries": "structured-output-retries";
        "thread-rollback-failed": "thread-rollback-failed";
        "too-many-failed-attempts": "too-many-failed-attempts";
        billing: "billing";
        internal: "internal";
        overloaded: "overloaded";
        policy: "policy";
        sandbox: "sandbox";
        unauthorized: "unauthorized";
        unknown: "unknown";
    }>>;
    detail: z.ZodOptional<z.ZodString>;
    errorInfo: z.ZodOptional<z.ZodObject<{
        category: z.ZodEnum<{
            "active-turn-not-steerable": "active-turn-not-steerable";
            "bad-request": "bad-request";
            "budget-exceeded": "budget-exceeded";
            "connection-failed": "connection-failed";
            "context-window-exceeded": "context-window-exceeded";
            "max-output-tokens": "max-output-tokens";
            "max-turns": "max-turns";
            "rate-limit": "rate-limit";
            "stream-disconnected": "stream-disconnected";
            "structured-output-retries": "structured-output-retries";
            "thread-rollback-failed": "thread-rollback-failed";
            "too-many-failed-attempts": "too-many-failed-attempts";
            billing: "billing";
            internal: "internal";
            overloaded: "overloaded";
            policy: "policy";
            sandbox: "sandbox";
            unauthorized: "unauthorized";
            unknown: "unknown";
        }>;
        httpStatusCode: z.ZodNullable<z.ZodNumber>;
        providerCode: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    kind: z.ZodLiteral<"provider.error">;
    message: z.ZodString;
    providerTurnId: z.ZodOptional<z.ZodString>;
    settlesTurn: z.ZodOptional<z.ZodBoolean>;
    threadScoped: z.ZodOptional<z.ZodBoolean>;
    willRetry: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    fallbackModel: z.ZodString;
    kind: z.ZodLiteral<"provider.modelFallback">;
    message: z.ZodString;
    originalModel: z.ZodString;
    reason: z.ZodEnum<{
        provider: "provider";
        refusal: "refusal";
    }>;
}, z.core.$strip>, z.ZodObject<{
    category: z.ZodOptional<z.ZodEnum<{
        "compaction-skipped": "compaction-skipped";
        config: "config";
        deprecation: "deprecation";
        general: "general";
    }>>;
    details: z.ZodOptional<z.ZodString>;
    kind: z.ZodLiteral<"provider.warning">;
    summary: z.ZodOptional<z.ZodString>;
    vouchedTurn: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"unhandled">;
    onlyIfNoTurn: z.ZodOptional<z.ZodBoolean>;
    parentRef: z.ZodOptional<z.ZodString>;
    providerTurnId: z.ZodOptional<z.ZodString>;
    raw: z.ZodObject<{
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        jsonrpc: z.ZodLiteral<"2.0">;
        method: z.ZodString;
        params: z.ZodOptional<z.ZodType<JsonValue, unknown, z.core.$ZodTypeInternals<JsonValue, unknown>>>;
    }, z.core.$strip>;
    rawType: z.ZodString;
    vouchedTurn: z.ZodBoolean;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"session.ended">;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"session.reset">;
}, z.core.$strip>], "kind">;
type ThreadDelta = z.infer<typeof threadDeltaSchema>;

/**
 * The `thread/delta` grammar range this assembler speaks, reported to every
 * bridge in the `initialize` params so the two sides negotiate a version
 * (see `negotiateGrammarVersion` in the protocol). `[3, 3]`: the v2 dialects
 * (`message.*`, `usage.turn`/`usage.exact`) are deleted, so a bridge whose
 * range lacks 3 — including one that predates `grammarVersions` and reads as
 * `[2, 2]` — is refused at the handshake with a legible error instead of
 * connecting to an assembler that would drop its every stream.
 */
declare const ASSEMBLER_GRAMMAR_VERSIONS: BridgeGrammarVersions;
interface DiffCumulativeTextArgs {
    nextText: string;
    previousText?: string;
}
interface DiffCumulativeTextResult {
    delta: string;
    nextText: string;
    reset: boolean;
}
interface CreateDeltaAssemblerOptions {
    /** Provider id stamped onto provider/unhandled events. */
    providerId: string;
    /**
     * Entropy prefix for minted turn/item ids. Defaults to fresh per-assembler
     * entropy so ids never collide across assembler (process) restarts; tests
     * inject a fixed prefix for determinism.
     */
    entropyPrefix?: string;
    /**
     * Minimum gap between emitted `item.progress` events per item key
     * (`flush: true` bypasses it; `item.close` always emits). 500ms default —
     * the cadence the claude bridge hand-rolled for background-task snapshots,
     * now the central policy for every provider's progress stream.
     */
    progressThrottleMs?: number;
    /**
     * Coalescing window for streamed-text events (assistant/reasoning/plan
     * deltas and command/fileChange output deltas) per stream. Within the
     * window consecutive deltas concatenate into one emitted event of the same
     * type; the buffer flushes trailing-edge with no timers — on the thread's
     * next traffic once the window elapsed, on stream close, and before ANY
     * non-batchable event for the thread (the ordering barrier: coalescing
     * never reorders text relative to item opens/closes, turn events, errors,
     * or other streams' flushes). The first delta of a fresh stream always
     * emits immediately, keeping time-to-first-token unchanged. 100ms default;
     * 0 disables batching (one event per delta).
     */
    textDeltaFlushMs?: number;
    /** Clock override for tests. */
    now?: () => number;
}
interface AssembleDeltasArgs {
    threadId: string;
    deltas: readonly ThreadDelta[];
}
interface DeltaAssembler {
    assemble(args: AssembleDeltasArgs): ThreadEvent[];
    /** bb item id minted for a provider item id (command-plane lookup). */
    getBbItemId(threadId: string, providerItemId: string): string | undefined;
    /** Provider item id behind a bb item id (reverse command-plane lookup). */
    getProviderItemId(threadId: string, bbItemId: string): string | undefined;
    /** bb turn id minted for a vouched provider turn id. */
    getBbTurnId(threadId: string, providerTurnId: string): string | undefined;
    /** Provider turn id behind a bb turn id (steer/interrupt reverse lookup). */
    getProviderTurnId(threadId: string, bbTurnId: string): string | undefined;
    getOpenTurnId(threadId: string): string | undefined;
}
declare function createDeltaAssembler(options: CreateDeltaAssemblerOptions): DeltaAssembler;

/**
 * Test-side view of the runtime's delta assembly: bridge tests capture raw
 * JSON-RPC output, and bridges emit `thread/delta` notifications rather than
 * finished `ThreadEvent`s. These helpers run captured notifications through
 * the real delta assembler — the exact translation the bridge protocol
 * adapter performs — so assertions keep working against canonical
 * `ThreadEvent`s.
 */

interface CapturedBridgeNotification {
    method?: string;
    params?: unknown;
}
interface BridgeDeltaEventCollector {
    assembler: DeltaAssembler;
    /** Canonical events for one captured notification (empty for non-deltas). */
    assembleMessage(message: CapturedBridgeNotification): ThreadEvent[];
}
declare function createBridgeDeltaEventCollector(providerId?: string): BridgeDeltaEventCollector;
/**
 * All canonical events an ordered capture of bridge notifications assembles
 * to. Builds a fresh assembler per call, so feed it the full capture (not an
 * incremental slice) for deterministic ids.
 */
declare function assembleCapturedThreadEvents(messages: readonly CapturedBridgeNotification[], providerId?: string): ThreadEvent[];
/**
 * Removed (SDK 0.4.16): the conformance kit assembles `thread/delta` itself.
 * A transport hands `runBridgeConformance` the raw captured messages
 * (`CapturedBridgeJsonRpcOutput.takeMessages`) and the run names its
 * `providerId`; this stub stays one release so a suite written against the
 * old transport shape fails with the replacement named, not a missing export.
 */
declare function toConformanceMessages(): never;

/**
 * Transport abstraction the conformance kit drives. Black-box at the message
 * level: lines in, JSON-RPC messages out. Two expected implementations — an
 * in-process bridge (`send` = the bridge's exported line handler,
 * `takeMessages` = the captured output's drain) and a spawned bridge binary
 * (stdin write + stdout readline). The kit never sees which: it assembles
 * the bridge's `thread/delta` notifications itself, through the runtime's
 * real delta assembler, so the transport hands over raw wire messages only.
 */
interface BridgeConformanceTransport {
    /** Deliver one raw line to the bridge. */
    send(line: string): void;
    /**
     * Every JSON-RPC message the bridge emitted since the last call, in order:
     * responses, notifications (`thread/delta` included) and bridge-initiated
     * requests, as parsed JSON.
     */
    takeMessages(): unknown[];
    close?(): Promise<void> | void;
}
/**
 * Retired. The kit once read its canonical events from a notification the
 * transport assembled under this method; it now assembles `thread/delta`
 * itself and reads nothing under this name. Kept because SDK 0.4.x published
 * it from `@get-bb/plugin-sdk/provider-bridge/testing`; removed at the next
 * major version.
 */
declare const CONFORMANCE_ASSEMBLED_EVENT_METHOD = "conformance/assembledEvent";
type ConformanceStatus = "fail" | "pass" | "skipped";
interface ConformanceCheckResult {
    /** Stable rule id, e.g. "rpc/unknown-method". */
    id: string;
    title: string;
    status: ConformanceStatus;
    /** Failure or skip explanation; empty on pass. */
    detail: string;
}
interface ConformanceReport {
    results: ConformanceCheckResult[];
    passed: boolean;
}

interface ConformanceSessionFixture {
    /** Workspace directory for the session under test. */
    cwd: string;
    /** Prompt expected to elicit at least one assistant-message item. */
    promptInput: PromptInput[];
    /**
     * A prompt this provider accepts and completes locally, without producing
     * any of the activity that opens a bb turn — Claude Code's `/clear` is the
     * canonical example (#1431). Opting in enables
     * `turn/settles-without-activity`.
     *
     * The kit cannot elicit this shape generically: only the bridge knows what
     * its provider handles as zero work. A fixture that omits it produces no
     * result for that rule rather than a skip, so bridges that have not opted in
     * keep a fully green report.
     */
    zeroWorkPromptInput?: PromptInput[];
    /**
     * A prompt that opens a turn and never settles it on its own, so the kit
     * can interrupt it. Opting in enables `session/threads-independent` and
     * `stop/interrupt-settles-before-result` (the kit names the turn to the
     * bridge through its own assembler's reverse map). A fixture that omits it
     * produces no result for those rules.
     */
    interruptiblePromptInput?: PromptInput[];
    /** Execution options for the session; the kit defaults to full mode. */
    options?: Record<string, unknown>;
    /**
     * The plugin's declared icons (`bb.branding.experimental_icons`): its
     * plugin id and the declared names. Opting in enables
     * `presentation/icon-namespaced-declared`, which fails when any item's
     * `presentation.icon.glyph` is a namespaced glyph (`"<pluginId>/<name>"`)
     * that names another plugin or an undeclared name — what the server
     * would refuse at ingest with `provider/unhandled`. A `server: "bb"` tool
     * row is not inspected: its presentation came from the plugin that
     * registered the tool, and the server checks it against that plugin. A
     * fixture that omits `icons` produces no result for the rule, like the
     * other opt-in rules, so a bridge whose plugin declares no icons keeps a
     * fully green report.
     */
    icons?: {
        pluginId: string;
        names: readonly string[];
    };
}

/**
 * Recorded-traffic conformance.
 *
 * The scripted scenarios in `scenarios.ts` drive a bridge with a fake
 * provider the kit authors wrote. This set drives it with what the provider
 * CLI really emitted: a committed recording (`recordings/<provider>/<cell>`),
 * replayed through the bridge by `testing/parity.ts`, checked with the same
 * grammar rules. A bridge passes when the replay reproduces a complete,
 * schema-valid, grammar-clean session for every recorded cell — so a
 * translation change that only the real dialect exercises fails conformance,
 * not just a golden.
 *
 * Pure over a replay's output, like `checkItemOpensBeforeDelta`: the caller
 * owns the bridge transport and the replay; this module owns the verdicts.
 */

/** The cells every bridge is expected to reproduce (the live-QA matrix core). */
declare const RECORDED_CONFORMANCE_CELLS: readonly ["turn-tools", "steer", "stop-interrupt", "approval-allow", "approval-deny", "user-question", "resume", "fork"];
type RecordedConformanceCell = (typeof RECORDED_CONFORMANCE_CELLS)[number];
interface RecordedCellReplay {
    provider: string;
    cell: string;
    /** Events the replayed bridge output assembled to, in order. */
    events: readonly ThreadEvent[];
    /**
     * Events the recording's own bridge output assembled to: the turn count the
     * replay must reach. A provider that legitimately refused a cell (an ACP
     * agent without `session/fork`) recorded no turns, and the replay must
     * reproduce that rather than invent one.
     */
    recordedEvents: readonly ThreadEvent[];
    /** Requests the harness had to answer for the bridge, or gates that timed out. */
    stalls: readonly string[];
}
/**
 * The verdicts for one replayed cell. Rule ids are `recorded/<cell>/<rule>`
 * so a report lists every cell and a regression names the one it broke.
 */
declare function checkRecordedCellReplay(replay: RecordedCellReplay): ConformanceCheckResult[];

interface RunBridgeConformanceOptions {
    transport: BridgeConformanceTransport;
    session: ConformanceSessionFixture;
    /**
     * The provider id the bridge's plugin registers. The kit assembles the
     * bridge's `thread/delta` stream through the runtime's real delta
     * assembler, and the canonical events it builds carry this id, as the
     * runtime's would.
     */
    providerId: string;
    /** Per-wait timeout. Conformant bridges answer fast; keep this tight. */
    timeoutMs?: number;
}
/**
 * Drive one bridge through the conformance scenarios: JSON-RPC hygiene, the
 * initialize handshake, then a shared session lifecycle (start → turn →
 * grammar checks → release stop → resume with its identity → id-uniqueness
 * → fork with its identity when the handshake declares fork → the opt-in
 * rules), released at the end the way the runtime releases a thread it
 * detaches. One transport for the whole run, mirroring a real bridge
 * lifetime.
 *
 * Against a conformant bridge every result passes. Against a bridge that is
 * not yet protocol-pure, the failures ARE the migration work list — run it
 * before migrating and pin the report, then make it shrink.
 */
declare function runBridgeConformance(options: RunBridgeConformanceOptions): Promise<ConformanceReport>;
/** Compact single-line-per-rule rendering for test snapshots and logs. */
declare function formatConformanceReport(report: ConformanceReport): string;

type BridgeJsonRpcId = string | number;
type BridgeJsonRpcLineHandler = (line: string) => void;
interface BridgeJsonRpcObject {
    [key: string]: JsonValue;
}
interface BridgeJsonRpcOutputMessage {
    jsonrpc: "2.0";
    id?: BridgeJsonRpcId;
    method?: string;
    params?: JsonValue;
    result?: JsonValue;
    error?: {
        code: number;
        message: string;
        data?: JsonValue;
    };
}
interface CapturedBridgeJsonRpcOutput {
    messages: BridgeJsonRpcOutputMessage[];
    /**
     * Every message since the last call: the conformance transport's drain
     * (`{ send: handleLine, takeMessages: output.takeMessages }`).
     */
    takeMessages(): BridgeJsonRpcOutputMessage[];
    restore(): void;
}
interface BridgeJsonRpcTestHarness {
    messages: BridgeJsonRpcOutputMessage[];
    /** Every message since the last call: the conformance transport's drain. */
    takeMessages(): BridgeJsonRpcOutputMessage[];
    flushWork(): Promise<void>;
    hasResponse(id: BridgeJsonRpcId): boolean;
    restore(): void;
    sendRequest(id: BridgeJsonRpcId, method: string, params: BridgeJsonRpcObject): void;
    waitForResponse(id: BridgeJsonRpcId): Promise<BridgeJsonRpcOutputMessage>;
}
/**
 * Capture everything a bridge writes to stdout as parsed JSON-RPC messages.
 * Patches `process.stdout.write` directly (no test-framework spy), so the
 * kit runs under any runner; `restore()` puts the original writer back.
 */
declare function captureBridgeJsonRpcOutput(): CapturedBridgeJsonRpcOutput;
declare function createBridgeJsonRpcTestHarness(handleLine: BridgeJsonRpcLineHandler): BridgeJsonRpcTestHarness;

/**
 * Dual-path calibration support.
 *
 * A calibration replays one scripted provider session through both the legacy
 * adapter and the canonical bridge, then diffs the two ThreadEvent streams.
 * Anything the diff reports is either a deliberate, documented protocol
 * difference (the bridge synthesizes item/started, announces thread/identity,
 * …) or a regression — there is no third category, which is what makes these
 * suites a graduation gate.
 *
 * Ids legitimately differ between the paths: the legacy adapter numbers from
 * its process-lifetime translator ("turn-1", "claude-assistant-2"), while a
 * canonical session mints per-session entropy ("bt3f9a2b1c-1-…") so ids stay
 * unique across resumes (#1224). Normalization interns them by first-seen
 * order instead of matching either scheme, so a stream that *reused* an id
 * still diffs.
 */
interface NormalizeCalibrationEventsOptions {
    /**
     * Ids the provider itself owns (tool call ids, checkpoints) are identical on
     * both paths and are left alone. Anything reaching the intern table is a
     * translator- or bridge-minted id.
     */
    internedIdFields?: readonly string[];
}
/**
 * Normalize one path's stream. Each stream gets its own interner, so the token
 * a given id receives depends only on the order ids first appear — identical
 * across paths when the streams agree, different the moment they do not.
 */
declare function normalizeCalibrationEvents(events: readonly ThreadEvent[], options?: NormalizeCalibrationEventsOptions): unknown[];
/** Compact `type` (+ item type) rendering for asserting a known-divergence list. */
declare function describeCalibrationEvents(events: readonly unknown[]): string[];

declare const BRIDGE_RECORDING_DIRECTIONS: readonly ["runtime→bridge", "bridge→runtime", "provider→bridge", "bridge→provider"];
type BridgeRecordingDirection = (typeof BRIDGE_RECORDING_DIRECTIONS)[number];
interface BridgeRecordingEntry {
    /** Wall-clock milliseconds when the line crossed. */
    ts: number;
    /**
     * The recorder's start time, identifying the bridge process that wrote the
     * entry. A thread can span several bridge processes (the runtime restarts a
     * bridge, or releases and later resumes the thread), each appending to the
     * same files with its own `seq`; `(run, seq)` orders entries exactly.
     */
    run: number;
    /** Process-wide monotonic counter across all four lanes. */
    seq: number;
    dir: BridgeRecordingDirection;
    /** The raw line, without its terminator. */
    line: string;
}

interface BridgeRecordingManifest {
    provider: string;
    cell: string;
    threadId: string | null;
    scope: "process" | "thread";
    cliVersion: string;
    recordedAt: string;
    description: string;
    note: string;
    bridgeRuns: number;
    lines: Partial<Record<BridgeRecordingDirection, number>>;
}
interface BridgeRecording {
    dir: string;
    manifest: BridgeRecordingManifest | null;
    /** Every lane merged back into wire order: by bridge process, then seq. */
    entries: BridgeRecordingEntry[];
}
/**
 * The file a bridge change re-records its side of the wire into
 * (`pnpm rerecord`): the `bridge→runtime` lane as THIS checkout's bridge
 * emits it for the recording's provider and runtime lanes. The recorded lane
 * itself is never rewritten — it is the recording, and a pre-migration
 * checkout paces its replay from it — so the current expectation lives
 * beside it. Absent until a bridge change first needs one.
 */
declare const CURRENT_BRIDGE_LANE_FILE = "bridge\u2192runtime.current.ndjson";
/**
 * The recording with its `bridge→runtime` lane replaced by the current
 * expectation when one exists: what the self-suite pins and compares.
 */
declare function withCurrentBridgeLane(recording: BridgeRecording): BridgeRecording;
declare function readBridgeRecording(dir: string): BridgeRecording;
interface RecordedCell {
    provider: string;
    cell: string;
    dir: string;
}
/**
 * Every `<provider>/<cell>` directory under a recordings root that holds at
 * least one lane, sorted for stable iteration.
 */
declare function listRecordedCells(root: string): RecordedCell[];

/** One stateful assembler: `thread/delta` notifications in, events out. */
interface ParityAssembler {
    assembleMessage(message: {
        method?: string;
        params?: unknown;
    }): ThreadEvent[];
}
type CreateParityAssembler = (providerId: string) => ParityAssembler;
/** Project canonical events into timeline rows (the server's projection). */
type ParityRowProjector = (args: {
    events: readonly ThreadEvent[];
    providerId: string;
}) => unknown[];
/** A bridge process, ready to spawn: the bootstrap, the module, its scope. */
interface ProviderBridgeLaunch {
    command: string;
    args: string[];
    cwd: string;
    /** Added to the harness's own environment for the bridge process. */
    env: Record<string, string>;
}
interface ResolveProviderBridgeLaunchOptions {
    /**
     * The bridge module: the file whose `experimental_providerBridge` export the
     * bootstrap runs. Absolute; a built artifact (`host.mjs`) or, with a
     * TypeScript loader among `nodeArgs`, the source file.
     */
    modulePath: string;
    /** The plugin the bridge belongs to (its data and temp directories). */
    pluginId: string;
    /** Working directory of the bridge process; defaults to the caller's. */
    cwd?: string;
    /**
     * The plugin data directory the bootstrap hands the bridge; defaults to a
     * fresh temp directory per launch.
     */
    dataDir?: string;
    /**
     * The provider-bridge bootstrap (`bridge-worker-entry`) that runs the
     * module; defaults to the kit's own — the source entry in a bb checkout,
     * the bundled one in the published SDK.
     */
    bootstrapPath?: string;
    /**
     * Node flags before the bootstrap. Defaults: in a bb checkout (source
     * bootstrap) `--conditions=source` plus the tsx loader; otherwise the tsx
     * loader for a TypeScript module and nothing for a built one.
     */
    nodeArgs?: string[];
}
/**
 * The process that runs one bridge module through the bootstrap — exactly the
 * shape the runtime spawns, so a replayed bridge sees the argv, stdin framing
 * and signal handling it gets in production.
 */
declare function resolveProviderBridgeLaunch(options: ResolveProviderBridgeLaunchOptions): ProviderBridgeLaunch;
type ReplayDialect = "claude-cli" | "json-rpc" | "pi-rpc";
/**
 * How a provider's bridge is pointed at the replay child. Codex reads its
 * app-server command from env, Claude its CLI path from env, pi its RPC
 * command from env (`pi-rpc`: JSON lines plus the extension channel on fds
 * 3/4), and an ACP bridge its agent command from the launch spec inside
 * `thread/start`. A bridge with no provider child (the echo example) needs no
 * profile at all.
 */
interface ReplayProviderProfile {
    /** The protocol the replay child speaks on its pipe. */
    dialect: ReplayDialect;
    /** Environment the bridge reads the child's command from. */
    env(args: {
        replayCommand: string[];
        wrapperPath: string;
        stateDir: string;
    }): Record<string, string>;
    /** Rewrite a recorded runtime request that carries the child's command. */
    rewriteRuntimeLine?(line: string, args: {
        replayCommand: string[];
    }): string;
    /**
     * Provider state a bridge reads outside its provider pipe, seeded before
     * the replay starts (the Claude SDK forks by copying the source session's
     * transcript from disk).
     */
    prepareState?(args: {
        recording: BridgeRecording;
        stateDir: string;
        workspaceDir: string;
    }): void;
}
/** A bridge that spawns no provider, or one whose child command is fixed. */
declare const DEFAULT_REPLAY_PROFILE: ReplayProviderProfile;
interface ReplayRecordingOptions {
    recordingDir: string;
    /** The provider the recording belongs to; keys the assembler's ids. */
    providerId: string;
    /** The bridge process to replay through (see `resolveProviderBridgeLaunch`). */
    bridge: ProviderBridgeLaunch;
    /** How the bridge reaches the replay child; `DEFAULT_REPLAY_PROFILE` when omitted. */
    profile?: ReplayProviderProfile;
    createAssembler: CreateParityAssembler;
    /**
     * The assembler that plans the replay's gates from the recorded
     * `bridge→runtime` lane; defaults to `createAssembler`. A re-recording run
     * on a checkout whose grammar no longer accepts the whole recorded lane
     * plans with the recording-time checkout's assembler instead.
     */
    createPlanAssembler?: CreateParityAssembler;
    /**
     * Plan the replay's gates from the cell's current bridge lane
     * (`bridge→runtime.current.ndjson`, see `withCurrentBridgeLane`) when one
     * exists, instead of the recorded lane. The leg whose bridge wrote that
     * lane parses all of it; the recording-time leg parses the recorded lane.
     */
    planFromCurrentLane?: boolean;
    /** Per-wait timeout for a gate or a response. */
    timeoutMs?: number;
    /**
     * The quiet period after which a request is sent even though the bridge
     * has emitted fewer lines than the recording had before it — a divergent
     * bridge pays this once per request instead of stalling. Only a plan from
     * the recorded lane can be short for that reason: a plan from the current
     * lane (`planFromCurrentLane`) was written by this very bridge, so a
     * shortfall there is latency, never divergence, and the request waits for
     * its events up to `timeoutMs` instead — a starved bridge (a loaded CI
     * runner) still has provider lines to read, and a request sent on quiet
     * alone lands before them, at a point the recording never had.
     */
    orderTimeoutMs?: number;
    /** Quiet period after the last request before the bridge is closed. */
    settleMs?: number;
    /**
     * Quiet period a request waits for once the gates are met. The replay child
     * plays every provider line before the request's cursor point a couple of
     * milliseconds apart, so a short silence means the bridge has emitted all
     * that the pre-request stream produces; without it a request the bridge
     * acknowledges at once (a steer) lands at a load-dependent point.
     */
    drainMs?: number;
    /** Mirror the bridge's stderr (and the replay child's logs) here. */
    onStderr?: (text: string) => void;
}
interface ParityGrammarViolation {
    rule: string;
    reason: string;
    eventType: string;
}
interface ParityRun {
    providerId: string;
    recordingDir: string;
    /** Raw `bridge→runtime` lines, in order. */
    lines: string[];
    /** When each line arrived, ms since the replay started (diagnostics). */
    lineTimes: number[];
    /**
     * For each line, the recorded `runtime→bridge` entry written last before
     * it arrived (null before any was sent) — where the line sits in the
     * recording's wire order, for a lane re-recorded through this bridge.
     */
    lineAfter: Array<{
        run: number;
        seq: number;
        ts: number;
    } | null>;
    /** Assembled events, minus the ones the grammar dropped (as the runtime does). */
    events: ThreadEvent[];
    grammarViolations: ParityGrammarViolation[];
    /** Gates that timed out or requests that were never answered. */
    stalls: string[];
    stderr: string;
    exitCode: number | null;
}
/** The id of the harness's own `initialize` request; never part of a recording. */
declare const PARITY_INITIALIZE_ID = "parity-initialize";
/**
 * Replay one recording through one bridge. Resolves when the bridge exits
 * after the last recorded runtime line has been sent and answered.
 */
declare function replayRecording(options: ReplayRecordingOptions): Promise<ParityRun>;
/**
 * The events the recorded `bridge→runtime` lane assembles to, without any
 * bridge in the loop: the recording's own view of what the bridge emitted.
 */
declare function assembleRecordedEvents(recording: BridgeRecording, createAssembler: CreateParityAssembler, providerId: string): {
    events: ThreadEvent[];
    grammarViolations: ParityGrammarViolation[];
    invalidDeltas: string[];
};
interface ParityAllowlistEntry {
    provider: string | "*";
    cell: string | "*";
    layer: "events" | "rows";
    /** A JSON pointer over the normalized list, with `*` and `**` wildcards. */
    path: string;
    pr: string;
    reason: string;
}
interface ParityLayerDiff {
    onlyInOld: unknown[];
    onlyInNew: unknown[];
}
interface ParityComparison {
    provider: string;
    cell: string;
    events: ParityLayerDiff;
    rows: ParityLayerDiff;
    /** Grammar drops, compared as `rule:eventType` multisets. */
    grammar: ParityLayerDiff;
    /** Allowlist entries that matched this cell but masked nothing. */
    staleAllowlist: ParityAllowlistEntry[];
    passed: boolean;
}
interface ParityInputs {
    events: readonly ThreadEvent[];
    rows: readonly unknown[];
    /** Events the grammar dropped; a regression when the lists differ. */
    grammarViolations?: readonly ParityGrammarViolation[];
}
declare function compareParity(oldRun: ParityInputs, newRun: ParityInputs, allowlist: readonly ParityAllowlistEntry[], scope: {
    provider: string;
    cell: string;
}): ParityComparison;
interface ReplayRecordedCellsOptions {
    /** The `<provider>/<cell>` tree to read (see `listRecordedCells`). */
    recordingsRoot: string;
    /** Which recorded providers this bridge serves (`acp` serves `acp-*`). */
    servesProvider: (providerId: string) => boolean;
    /** Cell names to replay; defaults to every cell of those providers. */
    cells?: readonly string[];
    /** The bridge process and replay profile for one cell's provider. */
    bridge: (cell: RecordedCell) => {
        launch: ProviderBridgeLaunch;
        profile?: ReplayProviderProfile;
    };
    createAssembler: CreateParityAssembler;
    timeoutMs?: number;
    onStderr?: (text: string) => void;
}

type RerecordCurrentBridgeLaneOptions = Omit<ReplayRecordingOptions, "planFromCurrentLane">;
interface RerecordCurrentBridgeLaneResult {
    /** The file written, or null when the replay stalled and nothing was. */
    file: string | null;
    /** Lines in the new lane (the harness's own handshake excluded). */
    lines: number;
    /** Events the replay assembled. */
    events: number;
    /** A stalled replay leaves the current lane untouched. */
    stalls: string[];
}
/**
 * Replay one recording through a bridge and write what the bridge emitted
 * as the recording's current bridge lane. The replay plans its gates from
 * the recorded lane (or `createPlanAssembler`'s view of it), never from a
 * previous current lane: the new lane must reproduce the recorded session,
 * not the last re-recording of it.
 */
declare function rerecordCurrentBridgeLane(options: RerecordCurrentBridgeLaneOptions): Promise<RerecordCurrentBridgeLaneResult>;

export { ASSEMBLER_GRAMMAR_VERSIONS, CONFORMANCE_ASSEMBLED_EVENT_METHOD, CURRENT_BRIDGE_LANE_FILE, DEFAULT_REPLAY_PROFILE, PARITY_INITIALIZE_ID, RECORDED_CONFORMANCE_CELLS, assembleCapturedThreadEvents as experimental_assembleCapturedThreadEvents, assembleRecordedEvents as experimental_assembleRecordedEvents, captureBridgeJsonRpcOutput as experimental_captureBridgeJsonRpcOutput, checkRecordedCellReplay as experimental_checkRecordedCellReplay, compareParity as experimental_compareParity, createBridgeDeltaEventCollector as experimental_createBridgeDeltaEventCollector, createBridgeJsonRpcTestHarness as experimental_createBridgeJsonRpcTestHarness, createDeltaAssembler as experimental_createDeltaAssembler, describeCalibrationEvents as experimental_describeCalibrationEvents, formatConformanceReport as experimental_formatConformanceReport, listRecordedCells as experimental_listRecordedCells, normalizeCalibrationEvents as experimental_normalizeCalibrationEvents, readBridgeRecording as experimental_readBridgeRecording, replayRecording as experimental_replayRecording, rerecordCurrentBridgeLane as experimental_rerecordCurrentBridgeLane, resolveProviderBridgeLaunch as experimental_resolveProviderBridgeLaunch, runBridgeConformance as experimental_runBridgeConformance, toConformanceMessages as experimental_toConformanceMessages, withCurrentBridgeLane as experimental_withCurrentBridgeLane };
export type { AssembleDeltasArgs, BridgeConformanceTransport, BridgeDeltaEventCollector, BridgeJsonRpcId, BridgeJsonRpcLineHandler, BridgeJsonRpcObject, BridgeJsonRpcOutputMessage, BridgeJsonRpcTestHarness, BridgeRecording, BridgeRecordingDirection, BridgeRecordingEntry, BridgeRecordingManifest, CapturedBridgeJsonRpcOutput, CapturedBridgeNotification, ConformanceCheckResult, ConformanceReport, ConformanceSessionFixture, CreateDeltaAssemblerOptions, CreateParityAssembler, DeltaAssembler, DiffCumulativeTextArgs, DiffCumulativeTextResult, NormalizeCalibrationEventsOptions, ParityAllowlistEntry, ParityAssembler, ParityComparison, ParityGrammarViolation, ParityInputs, ParityLayerDiff, ParityRowProjector, ParityRun, ProviderBridgeLaunch, RecordedCell, RecordedCellReplay, RecordedConformanceCell, ReplayDialect, ReplayProviderProfile, ReplayRecordedCellsOptions, ReplayRecordingOptions, RerecordCurrentBridgeLaneOptions, RerecordCurrentBridgeLaneResult, ResolveProviderBridgeLaunchOptions, RunBridgeConformanceOptions, ThreadEvent, ThreadEventBackgroundTaskItem, ThreadEventDelegationItem, ThreadEventExtensionItem, ThreadEventFileReadItem, ThreadEventItem, ThreadEventItemPresentation, ThreadEventItemPresentationIcon, ThreadEventItemPresentationLabel, ThreadEventItemPresentationTint, ThreadEventPlanStepsItem, ThreadEventSearchItem, ThreadEventWebFetchItem, ThreadEventWebSearchItem };
