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

declare const reasoningLevelSchema: z.ZodEnum<{
    high: "high";
    low: "low";
    max: "max";
    medium: "medium";
    none: "none";
    ultra: "ultra";
    ultracode: "ultracode";
    xhigh: "xhigh";
}>;
type ReasoningLevel = z.infer<typeof reasoningLevelSchema>;
declare const serviceTierSchema: z.ZodEnum<{
    default: "default";
    fast: "fast";
}>;
type ServiceTier = z.infer<typeof serviceTierSchema>;

declare const availableModelSchema: z.ZodObject<{
    defaultReasoningEffort: z.ZodEnum<{
        high: "high";
        low: "low";
        max: "max";
        medium: "medium";
        none: "none";
        ultra: "ultra";
        ultracode: "ultracode";
        xhigh: "xhigh";
    }>;
    description: z.ZodString;
    displayName: z.ZodString;
    id: z.ZodString;
    isDefault: z.ZodBoolean;
    model: z.ZodString;
    routeProviderId: z.ZodOptional<z.ZodString>;
    supportedReasoningEfforts: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        reasoningEffort: z.ZodEnum<{
            high: "high";
            low: "low";
            max: "max";
            medium: "medium";
            none: "none";
            ultra: "ultra";
            ultracode: "ultracode";
            xhigh: "xhigh";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
type AvailableModel = z.infer<typeof availableModelSchema>;

/**
 * Declarative presentation a bridge attaches to an item at `item.open` (and
 * re-states on `item.close`, whose item is the full terminal shape). The
 * assembler persists it on the canonical item so the row renders after the
 * plugin is uninstalled or upgraded, and so mobile renders every kind without
 * plugin code. The same schema as the persisted field
 * (`threadEventItemPresentationSchema` in @bb/domain) — one vocabulary, no
 * translation.
 *
 * Optional in grammar v3 while rows persisted before bridges stamped it are
 * upgraded at read time; it becomes required together with the
 * `legacy-tool-item-backfill` migration that stamps those rows and retires
 * that adapter.
 */
declare const deltaPresentationSchema: z.ZodObject<{
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
type DeltaPresentation = z.infer<typeof deltaPresentationSchema>;
declare const deltaItemShapeSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
type DeltaItemShape = z.infer<typeof deltaItemShapeSchema>;

/** Where this bridge process may keep files, scoped to the owning plugin. */
interface ProviderBridgeContext {
    /** The plugin that ships this bridge. */
    pluginId: string;
    /** Persistent, per-plugin, survives daemon restarts and plugin updates. */
    dataDir: string;
    /** This process only; removed when it exits. */
    tempDir: string;
}
interface ProviderBridgeDefinition {
    /** One decoded stdin line of the Provider Bridge Protocol. */
    handleLine: (line: string) => void;
    /**
     * Called once before the first line is read, with the process's
     * plugin-scoped directories. Omit it when the bridge keeps no files.
     */
    start?: (context: ProviderBridgeContext) => void;
    /** Stdin closed: the runtime is gone and the bridge must shut down. */
    onClose?: () => void;
    onSigterm?: () => void;
    onSigint?: () => void;
}
interface ProviderBridgeEntry extends ProviderBridgeDefinition {
    /** Bumped when the bootstrap↔bridge contract changes incompatibly. */
    experimental_apiVersion: 1;
}

declare const providerUsageResultSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    supported: z.ZodLiteral<false>;
}, z.core.$loose>, z.ZodObject<{
    supported: z.ZodLiteral<true>;
    usage: z.ZodDiscriminatedUnion<[z.ZodObject<{
        accountEmail: z.ZodNullable<z.ZodString>;
        planLabel: z.ZodNullable<z.ZodString>;
        status: z.ZodLiteral<"ok">;
        windows: z.ZodArray<z.ZodObject<{
            cost: z.ZodOptional<z.ZodObject<{
                limitUsdCents: z.ZodNumber;
                usedUsdCents: z.ZodNumber;
            }, z.core.$strip>>;
            label: z.ZodString;
            resetsAt: z.ZodNullable<z.ZodString>;
            usedPercent: z.ZodNumber;
        }, z.core.$loose>>;
    }, z.core.$loose>, z.ZodObject<{
        status: z.ZodLiteral<"not_installed">;
    }, z.core.$loose>, z.ZodObject<{
        status: z.ZodLiteral<"unauthenticated">;
    }, z.core.$loose>, z.ZodObject<{
        status: z.ZodLiteral<"expired">;
    }, z.core.$loose>, z.ZodObject<{
        accountEmail: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        message: z.ZodString;
        planLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        status: z.ZodLiteral<"error">;
    }, z.core.$loose>], "status">;
}, z.core.$loose>], "supported">;
type ProviderUsageResult = z.infer<typeof providerUsageResultSchema>;

declare const experimental_providerBridge: ProviderBridgeEntry;

/**
 * What an agent's own dialect knows about keeping it healthy: how a user
 * signs in, whether bb can install it, and where its account and usage live.
 * ACP standardizes none of it, so a generic bridge can only report whether
 * the executable exists — everything richer belongs to the agent, and is
 * therefore the dialect's (see `dialect.ts`), never a bb provider id's.
 */
interface AcpMaintenanceDialect {
    /** The shell command that signs the user in. */
    loginCommand: string;
    /** How bb installs or updates the agent, when it can. */
    installer(): {
        command: string;
        args: string[];
        displayCommand: string;
    };
    /** The signed-in account, or null when the agent is not signed in. */
    readAccount(): Promise<{
        email: string | null;
    } | null>;
    /** The agent's usage windows, for the usage surfaces. */
    readUsage(): Promise<ProviderUsageResult>;
}

/**
 * Zod schemas for the subset of the Agent Client Protocol (ACP) that BB
 * consumes — https://agentclientprotocol.com. The bridge validates agent
 * traffic with these before forwarding, and the adapter re-validates the
 * `update` payloads it translates into thread events.
 */

declare const acpToolKindSchema: z.ZodEnum<{
    delete: "delete";
    edit: "edit";
    execute: "execute";
    fetch: "fetch";
    move: "move";
    other: "other";
    read: "read";
    search: "search";
    switch_mode: "switch_mode";
    think: "think";
}>;
type AcpToolKind = z.infer<typeof acpToolKindSchema>;
declare const acpToolCallStatusSchema: z.ZodEnum<{
    cancelled: "cancelled";
    completed: "completed";
    failed: "failed";
    in_progress: "in_progress";
    pending: "pending";
}>;
type AcpToolCallStatus = z.infer<typeof acpToolCallStatusSchema>;
declare const acpToolCallContentSchema: z.ZodUnion<readonly [z.ZodObject<{
    content: z.ZodUnion<readonly [z.ZodObject<{
        text: z.ZodString;
        type: z.ZodLiteral<"text">;
    }, z.core.$loose>, z.ZodObject<{
        type: z.ZodString;
    }, z.core.$loose>]>;
    type: z.ZodLiteral<"content">;
}, z.core.$loose>, z.ZodObject<{
    newText: z.ZodString;
    oldText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    path: z.ZodString;
    type: z.ZodLiteral<"diff">;
}, z.core.$loose>, z.ZodObject<{
    terminalId: z.ZodString;
    type: z.ZodLiteral<"terminal">;
}, z.core.$loose>]>;
type AcpToolCallContent = z.infer<typeof acpToolCallContentSchema>;
declare const acpToolCallUpdateEventSchema: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodObject<{
    content: z.ZodOptional<z.ZodPipe<z.ZodArray<z.ZodUnknown>, z.ZodTransform<({
        [x: string]: unknown;
        type: "content";
        content: {
            [x: string]: unknown;
            type: "text";
            text: string;
        } | {
            [x: string]: unknown;
            type: string;
        };
    } | {
        [x: string]: unknown;
        type: "diff";
        path: string;
        newText: string;
        oldText?: string | null | undefined;
    } | {
        [x: string]: unknown;
        type: "terminal";
        terminalId: string;
    })[], unknown[]>>>;
    kind: z.ZodOptional<z.ZodEnum<{
        delete: "delete";
        edit: "edit";
        execute: "execute";
        fetch: "fetch";
        move: "move";
        other: "other";
        read: "read";
        search: "search";
        switch_mode: "switch_mode";
        think: "think";
    }>>;
    locations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        line: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        path: z.ZodString;
    }, z.core.$loose>>>;
    name: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>, z.ZodTransform<string | undefined, string | null>>>;
    rawInput: z.ZodOptional<z.ZodUnknown>;
    rawKind: z.ZodOptional<z.ZodString>;
    rawOutput: z.ZodOptional<z.ZodUnknown>;
    sessionUpdate: z.ZodEnum<{
        tool_call: "tool_call";
        tool_call_update: "tool_call_update";
    }>;
    status: z.ZodOptional<z.ZodEnum<{
        cancelled: "cancelled";
        completed: "completed";
        failed: "failed";
        in_progress: "in_progress";
        pending: "pending";
    }>>;
    title: z.ZodOptional<z.ZodString>;
    toolCallId: z.ZodString;
}, z.core.$loose>>;
type AcpToolCallUpdateEvent = z.infer<typeof acpToolCallUpdateEventSchema>;

/**
 * ACP tool call → grammar v3 item shape + presentation.
 *
 * An ACP agent describes a tool call with a native kind enum and a human
 * title. The kind maps straight onto the core kinds: `execute` → `command`,
 * `edit`/`delete` → `fileChange`, `read` → `fileRead`, `search` → `search`,
 * `fetch` → `webFetch`, `think` → `reasoning`; everything else — `other`,
 * `move`, an agent that sent no kind — is a generic `tool` whose `tool` slot
 * names the kind. The title is never a tool name: it rides
 * `presentation.title`.
 *
 * A core shape has required fields the agent does not always fill (Cursor's
 * `read` and `fetch` calls carry an empty `rawInput` and no `locations`). A
 * kind whose shape cannot be built honestly stays a generic `tool` that
 * presents as its kind ("Reading file" with the agent's title), so a row is
 * never a `fileRead` without a path or a `webFetch` without a URL.
 *
 * The command / file-change decision is `tool-call-operation.ts`'s, which the
 * permission mapping shares, so an approval row and its timeline item never
 * disagree (#1803).
 */

/** A tool call's item shape plus the presentation that rides its lifecycle. */
interface AcpClassifiedToolCall {
    item: DeltaItemShape;
    presentation: DeltaPresentation;
}

/**
 * Per-agent dialects: the vendor side channels of an ACP agent.
 *
 * The ACP wire schema (`wire.ts`) parses only the protocol. What an agent
 * puts beside the protocol is a dialect: grok stamps `_meta["x.ai/tool"]` on
 * every tool event, Cursor reports its sub-agents through a vendor JSON-RPC
 * request (`cursor/task`) that the protocol has no place for. A dialect is a
 * small, per-agent module that reads those channels and answers the few
 * questions the shared translator asks. The shared schema never learns a
 * vendor key, and a dialect never changes what a protocol field means.
 *
 * Version 1 of the protocol has no sub-agent concept at all (`session/fork`
 * is unstable and unrelated), so every delegation an ACP agent reports is
 * vendor-specific and belongs here rather than in the classifier.
 *
 * The dialect is selected per session from the agent's launch command. An
 * agent with no dialect of its own gets the generic one, which answers
 * nothing and leaves every decision to the protocol fields.
 */

/**
 * The programmatic identity of a tool call, when the agent reports one
 * outside the protocol's unstable `name` field: the tool's own name and, for
 * an agent that sends the `kind` late (grok puts it on the first update, a
 * few milliseconds after the `tool_call`), the kind at open, so the opened
 * shape and the closed shape agree.
 */
interface AcpToolIdentity {
    name?: string;
    kind?: AcpToolKind;
}
/** What a dialect learned about a sub-agent the agent launched. */
interface AcpDelegationReport {
    /** The tool call the delegation belongs to. */
    toolCallId: string;
    /** The child's provider-native id. */
    childRef: string;
    /** The row headline: what the sub-agent was asked to do. */
    label: string;
    /** A sub-agent type or model the row can name, when the agent says. */
    detail?: string;
}
interface AcpDialect {
    /** Stable id, for logs and tests. */
    readonly id: string;
    /**
     * The tool identity a tool_call / tool_call_update carries in the agent's
     * side channel, if any. The translator fills an absent protocol `name` and
     * `kind` from it; a protocol value always wins over the dialect's.
     */
    toolIdentity?(event: AcpToolCallUpdateEvent): AcpToolIdentity | undefined;
    /**
     * The agent's own classification of a tool call, when its side channel
     * says something the protocol fields cannot. Returning `undefined` leaves
     * the shared classifier in charge — which is the normal answer.
     */
    classifyToolCall?(event: AcpToolCallUpdateEvent): AcpClassifiedToolCall | undefined;
    /**
     * A vendor JSON-RPC request the agent sends to the client. A dialect that
     * answers one returns the JSON-RPC result to reply with (`{}` is a valid
     * acknowledgement) and, optionally, what the request reported. A request
     * no dialect claims stays an unsupported method.
     */
    handleClientRequest?(method: string, params: unknown): AcpClientRequestOutcome | undefined;
    /**
     * How bb keeps this agent healthy: sign-in, installation, account and
     * usage. ACP standardizes none of it, so an agent without one reports only
     * whether its executable exists.
     */
    maintenance?: AcpMaintenanceDialect;
}
interface AcpClientRequestOutcome {
    /** The JSON-RPC result the bridge replies with. */
    result: Record<string, unknown>;
    /** A sub-agent the request reported, if it reported one. */
    delegation?: AcpDelegationReport;
}

/**
 * What one installed ACP agent can actually do (Q21).
 *
 * A provider declaration states its capabilities before any agent has spoken,
 * so bb declared one answer for every ACP agent and got them wrong: the ACP
 * tier offered `session/fork` for five agents, of which the two bb has since
 * read the wire for support none of it. A declaration above what the agent
 * answers is not a missing feature — the bridge refuses the fork only after
 * bb created the fork thread, so the thread dies on start (get-bb/bb#1833).
 *
 * The agent already reports the truth: `initialize` returns
 * `agentCapabilities`. This probe asks it. It runs on the host, because the
 * agent is a host-local executable, and it is deliberately cheap and
 * disposable: spawn, initialize, read the reply, kill. It never starts a
 * session and never prompts.
 */

interface AcpAgentProbeRequest {
    command: string;
    args: readonly string[];
    /** Extra environment the agent's launch spec asks for. */
    env?: Record<string, string>;
    /** Where to run the probe; the agent may refuse to start without one. */
    cwd: string;
    timeoutMs?: number;
}
/** What the agent said about itself, or why bb could not ask. */
type AcpAgentProbe = {
    reachable: true;
    /** The agent implements the unstable `session/fork`. */
    fork: boolean;
} | {
    reachable: false;
    reason: string;
};
/**
 * Ask one agent what it supports. Never throws: an agent that is missing,
 * broken, or too slow is a `reachable: false` answer with the reason, which
 * the caller reports as "bb could not verify this agent" rather than as a
 * capability.
 */
declare function probeAcpAgent(request: AcpAgentProbeRequest): Promise<AcpAgentProbe>;
declare const acpAgentProbeSchema: z.ZodType<AcpAgentProbe>;

declare const acpLaunchSpecSchema: z.ZodObject<{
    args: z.ZodArray<z.ZodString>;
    command: z.ZodString;
    cwd: z.ZodOptional<z.ZodString>;
    displayName: z.ZodString;
    env: z.ZodRecord<z.ZodString, z.ZodString>;
    modelCli: z.ZodOptional<z.ZodPipe<z.ZodObject<{
        listArgs: z.ZodArray<z.ZodString>;
        primaryModels: z.ZodArray<z.ZodString>;
        selectFlag: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodTransform<{
        listArgs: string[];
        primaryModels: string[];
        selectFlag?: string | undefined;
    } | undefined, {
        listArgs: string[];
        primaryModels: string[];
        selectFlag?: string | undefined;
    }>>>;
    nativeReasoning: z.ZodOptional<z.ZodObject<{
        configId: z.ZodString;
        defaultLevel: z.ZodOptional<z.ZodEnum<{
            high: "high";
            low: "low";
            max: "max";
            medium: "medium";
            none: "none";
            ultra: "ultra";
            ultracode: "ultracode";
            xhigh: "xhigh";
        }>>;
        levelValues: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
            high: "high";
            low: "low";
            max: "max";
            medium: "medium";
            none: "none";
            ultra: "ultra";
            ultracode: "ultracode";
            xhigh: "xhigh";
        }> & z.core.$partial, z.ZodString>>;
        supportedLevels: z.ZodArray<z.ZodEnum<{
            high: "high";
            low: "low";
            max: "max";
            medium: "medium";
            none: "none";
            ultra: "ultra";
            ultracode: "ultracode";
            xhigh: "xhigh";
        }>>;
    }, z.core.$strict>>;
    nativeSkillRoots: z.ZodOptional<z.ZodObject<{
        project: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            ancestors: z.ZodOptional<z.ZodBoolean>;
            namePrefix: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            recursive: z.ZodOptional<z.ZodBoolean>;
            skipIfManifest: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>]>>>;
        user: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            ancestors: z.ZodOptional<z.ZodBoolean>;
            namePrefix: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            recursive: z.ZodOptional<z.ZodBoolean>;
            skipIfManifest: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>]>>>;
    }, z.core.$strict>>;
    permissionCli: z.ZodOptional<z.ZodObject<{
        full: z.ZodOptional<z.ZodArray<z.ZodString>>;
        insertAfterArgs: z.ZodOptional<z.ZodNumber>;
        readonly: z.ZodOptional<z.ZodArray<z.ZodString>>;
        workspaceWrite: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    reasoningCli: z.ZodOptional<z.ZodObject<{
        defaultLevel: z.ZodOptional<z.ZodEnum<{
            high: "high";
            low: "low";
            max: "max";
            medium: "medium";
            none: "none";
            ultra: "ultra";
            ultracode: "ultracode";
            xhigh: "xhigh";
        }>>;
        flag: z.ZodString;
        levelValues: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
            high: "high";
            low: "low";
            max: "max";
            medium: "medium";
            none: "none";
            ultra: "ultra";
            ultracode: "ultracode";
            xhigh: "xhigh";
        }> & z.core.$partial, z.ZodString>>;
        supportedLevels: z.ZodArray<z.ZodEnum<{
            high: "high";
            low: "low";
            max: "max";
            medium: "medium";
            none: "none";
            ultra: "ultra";
            ultracode: "ultracode";
            xhigh: "xhigh";
        }>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
type AcpLaunchSpec = z.infer<typeof acpLaunchSpecSchema>;

/**
 * Agent CLI model catalog.
 *
 * Cursor's `cursor-agent --list-models` prints one
 * `id - Display Name` line per model,
 * OpenCode's `opencode models` prints one bare id per line, and Grok's
 * `grok models` prints a bulleted list. These ids can encode reasoning effort:
 * `gpt-5.3-codex-low`, bare `gpt-5.3-codex` for medium, `gpt-5.5-extra-high`
 * as an alternate xhigh spelling, with an optional `-fast` service tail after
 * the effort token (`gpt-5.3-codex-low-fast`). This module groups those raw
 * variants into bb model families so the picker offers one clean entry per
 * family with selectable reasoning efforts, and resolves a (family, effort,
 * serviceTier) selection back to the exact raw id at session launch — by table
 * lookup, never string synthesis, because effort spellings vary per family.
 *
 * The `-fast` tail is a service tier, not a separate model: both the normal
 * and fast raw ids for a given effort collapse into one family, and the bb
 * "Fast mode" toggle (serviceTier) selects between them at launch.
 *
 * Cursor's "thinking" marker (appearing as an infix `…-thinking-medium` or a
 * suffix `…-medium-thinking` / `…-thinking`) is folded into the reasoning
 * ladder too: thinking variants keep their effort, and the model's
 * non-thinking variants collapse onto a single "none" (thinking-off) level at
 * the bottom of the ladder. So one "Opus 4.8" entry offers None, Low … Max
 * instead of separate "Opus 4.8" and "Opus 4.8 Thinking" rows. An explicit
 * `-none` effort id (e.g. `gpt-5.5-none`) is the same "none" level.
 *
 * Display names are stripped of noise the picker renders elsewhere or doesn't
 * need — the per-model effort word and "Thinking" marker (reasoning has its
 * own control), the redundant `1M` context tag, the `(NO ZDR)` data-retention
 * marker, and Cursor's own `(default)`/`(current)` annotations.
 */

interface AgentModelCatalog {
    models: AvailableModel[];
    /**
     * Exact raw agent id for the family identified by its default-variant id
     * (`AvailableModel.id`) at the given effort and service tier. Picks the
     * `-fast` id when `serviceTier` is "fast" and the family has one, otherwise
     * the normal id. `reasoningLevel` omitted falls back to the family's default
     * effort. Returns undefined when the family or requested effort is unknown.
     */
    resolveVariant(args: {
        model: string;
        reasoningLevel?: ReasoningLevel;
        serviceTier?: ServiceTier;
    }): string | undefined;
}

/**
 * `@get-bb/plugin-sdk/provider-bridge/acp` — the published ACP bridge kit.
 *
 * The Agent Client Protocol (https://agentclientprotocol.com) is one wire
 * protocol spoken by many agents, so bb runs all of them through one generic
 * bridge: the agent to launch arrives per command in the provider options,
 * and nothing in the bridge is bb-first-party. A plugin that wants to add an
 * ACP agent re-exports the bridge from its `bb.host` artifact and registers
 * its providers as any other plugin does:
 *
 * ```ts
 * // host.ts (the plugin's `bb.host` entry)
 * export { experimental_acpProviderBridge as experimental_providerBridge }
 *   from "@get-bb/plugin-sdk/provider-bridge/acp";
 *
 * // server.ts
 * bb.providers.register({
 *   id: "amp",
 *   displayName: "Amp",
 *   experimental_bridgeOptions: {
 *     acpLaunchSpec: { displayName: "Amp", command: "amp", args: ["acp"], env: {} },
 *     acpDialect: "generic",
 *   },
 *   // …the rest of the declaration
 * })
 * ```
 *
 * **Dialects.** Version 1 of the protocol has no sub-agent concept and
 * standardizes nothing about `rawInput`, so what most distinguishes one
 * agent from another lives beside the protocol: grok stamps
 * `_meta["x.ai/tool"]` on every tool event, Cursor reports sub-agents
 * through a vendor `cursor/task` request. A dialect is a small module that
 * reads those channels; the bridge ships `generic`, `cursor` and `grok`,
 * named by id in the registration's bridge options (`acpDialect`). The
 * dialect registry itself is not public yet: no plugin has needed to supply
 * one, and its shape (process-global, unversioned hooks) is still open — see
 * docs/api_to_audit.md.
 *
 * Curated by hand — named exports only, never `export *`. Value exports
 * carry the `experimental_` prefix every new plugin API member ships with
 * (see docs/api_to_audit.md); types are unprefixed. Exports no plugin
 * consumes are not published: the surface grows with a consumer, not ahead
 * of one.
 */

/**
 * @deprecated The bridge reads the parsed `AcpLaunchSpec` directly; the
 * profile it used to derive from the spec carried the same fields under
 * other names, and nothing outside the bridge produced or consumed it. Kept
 * as an alias because 0.4.x published the name; scheduled for removal at the
 * next major (docs/api_to_audit.md).
 */
type AcpAgentProfile = AcpLaunchSpec;

export { acpAgentProbeSchema as experimental_acpAgentProbeSchema, acpLaunchSpecSchema as experimental_acpLaunchSpecSchema, experimental_providerBridge as experimental_acpProviderBridge, probeAcpAgent as experimental_probeAcpAgent };
export type { AgentModelCatalog as AcpAgentModelCatalog, AcpAgentProbe, AcpAgentProbeRequest, AcpAgentProfile, AcpClassifiedToolCall, AcpClientRequestOutcome, AcpDelegationReport, AcpDialect, AcpLaunchSpec, AcpToolCallContent, AcpToolCallStatus, AcpToolCallUpdateEvent, AcpToolIdentity, AcpToolKind };
