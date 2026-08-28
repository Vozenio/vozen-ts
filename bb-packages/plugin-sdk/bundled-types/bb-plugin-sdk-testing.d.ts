// Portable type declarations for `@get-bb/plugin-sdk`. Unpublished BB
// workspace contracts are flattened; public subpaths may reuse the
// package root without requiring any other @bb/* package.
//
// Confused by the API, or need a symbol that isn't here? Clone the BB repo
// and read the real source: https://github.com/get-bb/bb

import { z } from 'zod';
import { BbPluginApi, PluginSettingValue as PluginSettingValue$1, PluginSharedPortTunnelIdentity, PluginAgentToolPresentation, PluginAgentToolContext, PluginAgentToolResult, PluginCliCommandInfo, PluginCliContext, PluginCliResult, PluginHttpAuthMode, PluginHttpHandler, PluginMentionTrigger, PluginMentionSearchContext, PluginMentionItem, JsonValue as JsonValue$1, PluginCliExecutionResult, PluginThreadEventName, PluginThreadEventPayloads, PluginAgentConfigurationContext, PluginSettingDescriptors, PluginAgentConfiguration, PluginAiServiceDeclaration, PluginInteractionRequest } from '@get-bb/plugin-sdk';

/** Input-form entry: a path, or a path with options. */
declare const providerNativeRootInputSchema: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    ancestors: z.ZodOptional<z.ZodBoolean>;
    namePrefix: z.ZodOptional<z.ZodString>;
    path: z.ZodString;
    recursive: z.ZodOptional<z.ZodBoolean>;
    skipIfManifest: z.ZodOptional<z.ZodString>;
}, z.core.$strict>]>;
/**
 * One provider-native root as a plugin declares it: a path, or a path with
 * options. `recursive`: the agent scans nested skill directories. `ancestors`
 * (project roots only): scan the same relative directory in every ancestor of
 * the workspace up to the repository root. `namePrefix`: prepended to every
 * name under the root, a vendor plugin's `plugin-name:`; a prefixed root is
 * listed as a plugin root. `skipIfManifest`: a vendor-plugin marker file to
 * skip by.
 */
type ProviderNativeRootInput = z.infer<typeof providerNativeRootInputSchema>;
/**
 * Normalized roots: relative to the host home (`user`) or to the workspace
 * (`project`). The daemon parses this off the wire; the server produces it
 * from a declaration.
 */
declare const providerNativeRootsSchema: z.ZodObject<{
    project: z.ZodArray<z.ZodObject<{
        ancestors: z.ZodBoolean;
        namePrefix: z.ZodString;
        path: z.ZodString;
        recursive: z.ZodBoolean;
        skipIfManifest: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    user: z.ZodArray<z.ZodObject<{
        ancestors: z.ZodBoolean;
        namePrefix: z.ZodString;
        path: z.ZodString;
        recursive: z.ZodBoolean;
        skipIfManifest: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
type ProviderNativeRoots = z.infer<typeof providerNativeRootsSchema>;
/**
 * Provider-native roots as a plugin's frozen declaration holds them: relative
 * to the target host's home (`user`) or to the workspace (`project`). Paths
 * are relative without dot segments, unique per side, at most 32 per side. A
 * root only one host can name — a moved config directory, a settings entry —
 * is the resolver's answer (`resolveNativeRoots`), never a declared root.
 */
interface ProviderNativeRootsInputLike {
    readonly user?: readonly ProviderNativeRootInput[];
    readonly project?: readonly ProviderNativeRootInput[];
}

/**
 * How completely a provider can clone one of its sessions — the single
 * vocabulary shared by the provider declaration
 * (`bb.providers.register`), the server→daemon
 * `bridgeLaunch`, and the bridge's `initialize` handshake.
 *
 * - `"none"`: sessions cannot be cloned at all.
 * - `"tip"`: only the current end of a session can be cloned (ACP
 *   `session/fork`), so thread fork works but edit-past-message rewind
 *   cannot.
 * - `"checkpoint"`: a session can be recreated at an earlier point, which is
 *   what edit-past-message rewind needs.
 *
 * The values are ordered least to most capable: a declaration is a ceiling
 * the handshake may narrow but never widen.
 */
declare const PROVIDER_FORK_VALUES: readonly ["none", "tip", "checkpoint"];
type ProviderFork = (typeof PROVIDER_FORK_VALUES)[number];

/**
 * A value that survives a JSON round trip without coercion or data loss.
 *
 * Host boundaries still validate values at runtime because TypeScript cannot
 * exclude non-finite numbers and plugin bundles can bypass static types.
 */
type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};

/**
 * The validator-neutral subset of Standard Schema v1 used by plugin RPC.
 * Zod 4 schemas implement this interface directly; other validators can do
 * the same without becoming part of BB's public protocol.
 */
interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly "~standard": {
        readonly version: 1;
        readonly vendor: string;
        readonly validate: (value: unknown) => StandardSchemaV1Result<Output> | Promise<StandardSchemaV1Result<Output>>;
        readonly types?: {
            readonly input: Input;
            readonly output: Output;
        };
    };
}
type StandardSchemaV1Result<Output> = {
    readonly value: Output;
    readonly issues?: undefined;
} | {
    readonly issues: readonly StandardSchemaV1Issue[];
};
interface StandardSchemaV1Issue {
    readonly message: string;
    readonly path?: PropertyKey | readonly (PropertyKey | {
        readonly key: PropertyKey;
    })[];
}

type PluginSettingValue = string | boolean;
/**
 * Permission modes a provider can run a session in — BB's own permission
 * vocabulary, ordered least ("accept-edits") to most ("full") privileged.
 */
type PluginProviderPermissionMode = "accept-edits" | "auto" | "full";
/**
 * Coarse reasoning-effort ladder entries, ordered lowest to highest. The
 * declared ladder is a fallback only: precise per-model reasoning sets come
 * from the provider's model list at runtime.
 */
type PluginProviderReasoningLevel = "high" | "low" | "max" | "medium" | "none" | "ultra" | "ultracode" | "xhigh";
/**
 * Composer actions a provider supports, by name only. The skills
 * slash-command typeahead is universal — BB injects skills into every
 * provider — so it is implicit and never declared, and the composer owns the
 * trigger syntax (`/plan `, `/goal `) rather than each declaration repeating
 * it.
 */
type PluginProviderComposerAction = "goal" | "plan";
/**
 * Pre-session capability facts about a provider. A capability earns a field
 * here only when it passes BOTH tests: (1) a consumer outside the provider's
 * own plugin needs the fact, and (2) the fact is needed before / without a
 * live session (picker rendering, route gating, cross-plugin tool
 * composition — including with the host offline). Every boolean is a
 * provider-native fact — the provider implements the feature; the flag only
 * tells external consumers it exists. Session-behavior facts remain handshake
 * capabilities reported by the running bridge. Sessionless maintenance
 * methods are declared here so callers can decide whether to probe without
 * starting the bridge first.
 */
interface PluginProviderCapabilities {
    /** The provider accepts a fast/priority service-tier choice — shows the
     * service-tier toggle in the picker. */
    supportsServiceTier: boolean;
    /** The provider ships its own native ask-user-question tool — the
     * ask-user-question plugin skips registering its duplicate. */
    supportsNativeUserQuestion: boolean;
    /**
     * How completely the provider can clone a session: `"none"` (not at all),
     * `"tip"` (only the current end, so thread fork works but edit-past-message
     * rewind cannot), or `"checkpoint"` (recreate the session at an earlier
     * point, which rewind needs). Gates the fork and edit-past-message
     * affordances. The bridge reports the same fact at `initialize`, where it
     * may narrow this declaration but never widen it.
     */
    fork: ProviderFork;
    /** The provider accepts an explicit context-compaction request — gates the
     * compact affordance. */
    supportsManualCompaction: boolean;
    /** The provider keeps its own thread archive, so BB mirrors archive and
     * unarchive onto it instead of tracking the state only in bb's own rows. */
    supportsThreadArchive: boolean;
    /** The provider stores a thread name of its own, so BB forwards renames to
     * it. */
    supportsThreadRename: boolean;
    /** Permission modes the provider can actually run in. Non-empty, no
     * duplicates. */
    permissionModes: readonly PluginProviderPermissionMode[];
    /** The provider's coarse fallback reasoning ladder (see
     * {@link PluginProviderReasoningLevel}). Non-empty, no duplicates. */
    reasoningLevels: readonly PluginProviderReasoningLevel[];
}
/**
 * Provider copy core surfaces render from per-provider tables today (usage
 * banners, sign-in hints, the mobile picker, the agent guide). Declared once
 * here so no core surface keys copy on a provider id. Mirrors
 * `ProviderStrings` in `@bb/domain`, which is the client projection.
 */
interface PluginProviderStrings {
    /** How to sign in on the host ("Run `claude` on the machine to sign in."). */
    signInHint: string;
    /** Shown when a session's credentials expired. */
    expiredHint: string;
    /** Where to install the agent. */
    installUrl: string;
    /** Brand prefix stripped from model display names ("Claude "). */
    brandPrefix?: string;
    /** Plan-mode banner copy for providers that declare the `plan` action. */
    planModeCopy?: string;
    /** Per-theme tint for the provider icon. */
    iconTint?: {
        light: string;
        dark: string;
    };
}
/**
 * One selectable option for a picker — a service tier or a reasoning level.
 * `id` is the wire value the bridge receives; `label` is what the picker
 * shows. Declared lists are the cold-cache fallback; `model/list` is precise
 * per model.
 */
interface PluginProviderOptionDescriptor {
    id: string;
    label: string;
    description?: string;
}
/**
 * Payload schemas for one extension kind this provider emits, keyed by the
 * kind's local name (the server prefixes the plugin id to form the
 * namespaced `"<pluginId>/<name>"`). `item` validates `item.open` payloads
 * with `type: "extension"`, `state` validates `extension.state` payloads;
 * each is optional so a kind can be item-only or state-only. Schemas are
 * Standard Schema v1 validators (zod 4 schemas qualify).
 */
interface PluginProviderExtensionKindDeclaration {
    item?: StandardSchemaV1;
    state?: StandardSchemaV1;
}
/**
 * Per-command context handed to
 * {@link PluginProviderDeclaration.deriveProviderOptions}. The
 * server builds one for every session and turn command it dispatches on a
 * thread of this provider.
 */
interface PluginProviderOptionsContext {
    threadId: string;
    projectId: string;
    /** The resolved model id for this command. */
    model: string;
    /** BB's permission mode for this command (already clamped to the host). */
    permissionMode: PluginProviderPermissionMode;
    /**
     * `"plan"` when the prompt entered plan mode through this provider's
     * declared `plan` composer action. Absent for an ordinary prompt — plan
     * mode is a BB prompt mode, so the bridge maps it onto whatever the agent
     * calls it natively.
     */
    promptMode?: "plan";
    /**
     * This plugin's own settings values (`bb.settings.define`), read at call
     * time. Secret settings are omitted — provider options ride the daemon
     * wire and are persisted with the session, so a secret must never be
     * derived into them.
     */
    settings: Readonly<Record<string, PluginSettingValue | undefined>>;
}
/** See {@link PluginProviderDeclaration.models}. */
type PluginProviderModelCatalogScope = "host" | "workspace";
/**
 * One cold-cache fallback model. The provider's live `model/list` result is
 * the only real model source; this list stands in only while no probe has
 * completed, or when a probe fails transiently, so the picker is not empty.
 * `id` is the wire model id the bridge receives.
 */
interface PluginProviderFallbackModel {
    id: string;
    /** Picker display name ("Opus 5 (1M)"). */
    displayName: string;
    description: string;
    /** Reasoning levels this model supports, lowest to highest. Non-empty. */
    supportedReasoningEfforts: readonly {
        reasoningEffort: PluginProviderReasoningLevel;
        description: string;
    }[];
    /** Must be one of `supportedReasoningEfforts`. */
    defaultReasoningEffort: PluginProviderReasoningLevel;
    /** Exactly one entry in the list is the default. */
    isDefault: boolean;
}
/**
 * Which sessionless maintenance requests a provider bridge implements. The
 * server skips the requests a provider does not declare, and clients omit
 * the matching surfaces, without starting the bridge first.
 */
interface PluginProviderMaintenance {
    /** `provider/health`: host-local readiness, never a network health check. */
    health?: boolean;
    /** `provider/usage`: subscription usage windows. False means usage settings
     * omit the provider. A shared bridge that declares true may still report
     * usage unavailable for one provider id or return no windows. */
    usage?: boolean;
    /** `provider/installation/status` and `provider/installation/run`:
     * host-local installation management. */
    installation?: boolean;
}
/** Provider-native roots as a plugin declares them, one list per side. */
type PluginProviderNativeRoots = ProviderNativeRootsInputLike;
/**
 * One provider this plugin contributes to BB's provider registry.
 *
 * Ids are stable public identifiers — thread rows and routes reference them —
 * and are collision-rejected: a declaration whose id matches another plugin's
 * live registration is refused; the first registration wins and no id is
 * reserved ahead of time. Registrations are replaced wholesale on plugin
 * reload, like every other plugin surface.
 *
 * A declaration owns the provider's static metadata and bridge options. The
 * executable implementation is the plugin's own provider bridge: the
 * `experimental_providerBridge` export of the `bb.host` artifact the manifest
 * names (`PROVIDER_BRIDGE_EXPORT_NAME` in the bridge kit), built into the
 * artifact BB ships to hosts. Declaring a provider in a plugin with no
 * `bb.host` entry is refused, because the picker entry would exist and no
 * turn on it could ever run; a `bb.host` entry whose artifact failed to
 * build still stages the declaration so the provider is listed as
 * unavailable.
 */
interface PluginProviderDeclaration {
    /** Stable provider id: 2–64 characters of lowercase letters, digits, and
     * "-", starting with a letter or digit. Existing ids must never change —
     * threads persist them. */
    id: string;
    /** Picker display name: 1–80 characters, non-blank. */
    displayName: string;
    /**
     * Optional grouping key (same grammar as `id`) for providers that share a
     * family — the ACP agents, for example — so clients can group them without
     * parsing a prefix out of the id. Grouping only: no policy keys on it.
     */
    family?: string;
    /**
     * Optional picker icon: a named host glyph (`"Zap"`) or a plugin-relative
     * path starting with `"./"` (`"./icons/agent.svg"`) — the two forms
     * `bb.branding.icon` takes — or, unlike `bb.branding.icon`, one of this
     * plugin's declared icons by its namespaced glyph (`"<pluginId>/<name>"`,
     * an entry of the manifest's `bb.branding.experimental_icons` map; the
     * plugin id must be this plugin's and the name must be declared, else the
     * plugin fails to load). Paths follow the manifest entry-path escape rules
     * — no leading "/", no ".." segments, no backslashes.
     */
    icon?: string;
    /**
     * Provider-owned static options passed opaquely to this plugin's bridge on
     * every sessionless and session request. Core validates that the value is
     * JSON, but does not interpret its keys. This is intended for immutable
     * launch metadata shared by every host (for example an ACP command spec),
     * not user or machine configuration.
     */
    experimental_bridgeOptions?: Readonly<Record<string, JsonValue>>;
    /**
     * Whether the provider is always listed or only listed on hosts where its
     * bridge reports it installed. Defaults to `"always"`.
     */
    experimental_visibility?: "always" | "installed";
    /**
     * The sessionless maintenance requests the provider's bridge implements
     * (docs/provider-plugin-api.md §1). Each defaults to false when omitted.
     */
    maintenance?: PluginProviderMaintenance;
    /** Pre-session capability facts (see the declaration tests on
     * {@link PluginProviderCapabilities}). */
    capabilities: PluginProviderCapabilities;
    /** Composer actions this provider supports. No duplicates; may be empty
     * (the universal skills typeahead is implicit). */
    composerActions: readonly PluginProviderComposerAction[];
    /** Provider copy for core surfaces ({@link PluginProviderStrings}). */
    strings?: PluginProviderStrings;
    /** Service tiers this provider accepts, as picker options. Non-empty when
     * present, unique ids. The coarse `capabilities.supportsServiceTier` stays
     * until WS2a stabilizes. */
    serviceTiers?: readonly PluginProviderOptionDescriptor[];
    /** Reasoning levels as picker options with labels, beside the coarse
     * `capabilities.reasoningLevels` ladder (ids only). Non-empty when present,
     * unique ids. WS2a merges the two. */
    reasoningLevels?: readonly PluginProviderOptionDescriptor[];
    /** Extension kinds this provider's bridge may emit, keyed by local name
     * (`[a-z0-9-]+`). The server validates extension payloads against these
     * schemas at ingest and persists a `provider/unhandled` on a miss. */
    extensionKinds?: Readonly<Record<string, PluginProviderExtensionKindDeclaration>>;
    /**
     * Cold-cache fallback models ({@link PluginProviderFallbackModel}). The
     * server offers them only while a model probe has not completed or failed
     * transiently; the live `model/list` result always replaces them. Ids must
     * be unique and exactly one entry must be the default.
     */
    models?: {
        /**
         * Optional: a provider that only declares a catalog `scope` needs no
         * fallback list, and an omitted list reads as no fallbacks at all.
         */
        fallback?: readonly PluginProviderFallbackModel[];
        /**
         * How far one `model/list` answer travels. `"host"` means the catalog is
         * the same everywhere on a machine — the bridge answers from account or
         * agent state and ignores the workspace path — so bb probes once per host
         * and reuses the answer for every environment on it. `"workspace"` (the
         * default) means project configuration can change the answer, so bb
         * probes per workspace and sends the path.
         *
         * Declaring `"host"` wrongly is a stale catalog in a workspace that
         * configured its own models; declaring `"workspace"` wrongly costs a
         * redundant probe. The default is therefore the safe one.
         */
        scope?: PluginProviderModelCatalogScope;
    };
    /**
     * Daemon environment variables this provider's bridge may read. Provider
     * processes are spawned with every inherited `BB_*` variable stripped, so a
     * bridge that honors an operator override (a CLI path, say) names it here
     * and the daemon forwards exactly those variables. Names are
     * `[A-Z_][A-Z0-9_]*`, at most 32.
     */
    env?: {
        passthrough: readonly string[];
    };
    /**
     * Directories this provider's agent reads its own skills from, relative to
     * the target host's home directory (`user`) or to the workspace
     * (`project`). An agent with skills of its own — an ACP agent pointed at
     * `.cursor/skills`, say — names them here so bb can list them beside its
     * own; core never guesses a provider's skill layout. Paths are relative
     * and may not contain dot segments; each side holds at most 32 roots. One
     * declaration is global, so a directory only one host can name (an agent's
     * settings-configured skills directory, say) is not declared here but
     * resolved on that host (`experimental_resolvesNativeRoots`).
     */
    experimental_nativeSkillRoots?: PluginProviderNativeRoots;
    /**
     * Directories this provider's agent reads its own slash commands from —
     * flat directories of `*.md` prompt files (`.claude/commands`, say) — in
     * the same two-sided shape as `experimental_nativeSkillRoots`. bb offers
     * them in the composer beside the agent's skills.
     */
    experimental_nativeCommandRoots?: PluginProviderNativeRoots;
    /**
     * This plugin's `bb.host` entry implements
     * `experimental_nativeRootsHostContract` (`@get-bb/plugin-sdk/host`): core
     * calls `resolveNativeRoots({ cwd })` on the workspace host when it lists
     * commands or skills, and scans what comes back beside the declared roots.
     * This is where a provider's host-only knowledge goes — a config-moved
     * directory, an installed vendor plugin, a config-file entry — including
     * project-scoped entries, which a global declaration cannot carry.
     */
    experimental_resolvesNativeRoots?: boolean;
    /**
     * Derive this provider's opaque per-command options. Called synchronously
     * by the server for every session and turn command on a thread of this
     * provider, with the command's {@link PluginProviderOptionsContext}; the
     * returned JSON object reaches this plugin's bridge as
     * `options.providerOptions`, merged over `experimental_bridgeOptions`. Core
     * never interprets its keys — this is where a provider's own knobs (memory,
     * native subagents, a native plan flag) travel instead of on the shared
     * execution contract. A throw fails the command with the plugin named, so
     * a buggy hook cannot silently run a turn with default knobs. Must be fast:
     * it sits on the turn-submit path.
     */
    deriveProviderOptions?: (context: PluginProviderOptionsContext) => Readonly<Record<string, JsonValue>>;
}

/**
 * Validate one `bb.providers.register` declaration. Plugin
 * sources are untyped at runtime, so every field is checked; the production
 * host and the fake host both call this, so they accept and reject provider
 * declarations identically. Throws a descriptive error on the first problem;
 * returns a normalized, deeply frozen copy carrying only contract fields.
 */
/**
 * A declaration that has been through {@link validatePluginProviderDeclaration}.
 *
 * The validator fills the defaults it owns, so a consumer reads one explicit
 * value rather than re-deciding what an absent field means. Only the fields
 * the validator GUARANTEES are narrowed here; everything else keeps the
 * author-facing shape.
 */
type NormalizedPluginProviderDeclaration = Omit<PluginProviderDeclaration, "experimental_nativeCommandRoots" | "experimental_nativeSkillRoots" | "experimental_resolvesNativeRoots"> & {
    readonly experimental_nativeSkillRoots?: ProviderNativeRoots;
    readonly experimental_nativeCommandRoots?: ProviderNativeRoots;
    readonly experimental_resolvesNativeRoots: boolean;
    readonly maintenance: {
        readonly health: boolean;
        readonly usage: boolean;
        readonly installation: boolean;
    };
    readonly models: {
        readonly fallback?: readonly PluginProviderFallbackModel[];
        readonly scope: PluginProviderModelCatalogScope;
    };
};

type BbSdk = BbPluginApi["sdk"];
/**
 * Recordable `bb.sdk` stand-in for {@link createFakePluginHost}. Every call
 * through the fake is recorded (post plugin-attribution defaulting, so
 * assertions see what the server would receive); calls without a stubbed
 * implementation throw with a message naming the exact path to stub.
 */
/** One recorded `bb.sdk` call. `path` is dot-joined, e.g. "threads.spawn". */
interface FakeSdkCall {
    path: string;
    args: unknown[];
}
/**
 * A stub keeps the real method's parameter types but may return anything —
 * tests usually only build the fields the plugin reads, not the full wire
 * response.
 */
type LooseStub<F> = F extends (...args: infer A) => unknown ? (...args: A) => unknown : never;
/**
 * Stub implementations keyed like `BbSdk`: an object per area with a subset
 * of its methods, or a function for the root-level members (`on`).
 */
type FakeSdkOverrideTree<T> = {
    [K in keyof T]?: T[K] extends (...args: never[]) => unknown ? LooseStub<T[K]> : FakeSdkOverrideTree<T[K]>;
};
type FakeSdkOverrides = FakeSdkOverrideTree<BbSdk>;
interface FakeSdkHarness {
    /** Every `bb.sdk` call in order, including ones whose stub threw. */
    readonly calls: FakeSdkCall[];
    /** Argument lists of the calls to one dot-joined path. */
    callsTo(path: string): unknown[][];
    /** Add or replace one method's implementation after creation. */
    stub(path: string, implementation: (...args: never[]) => unknown): void;
}
declare function createFakeSdk(options: {
    pluginId: string;
    overrides?: FakeSdkOverrides;
}): {
    sdk: BbSdk;
    harness: FakeSdkHarness;
};

/**
 * `createFakePluginHost` — an in-process stand-in for the BB server's plugin
 * runtime (apps/server/src/services/plugins/plugin-api.ts), for unit-testing
 * a plugin's `server.ts` without a server. `bb` satisfies {@link BbPluginApi};
 * `harness` drives and inspects it.
 *
 * Faithful where a plugin can observe it: registration name validation and
 * error messages, the kv 256KB cap, append-only database migrations, settings
 * read/update semantics (including onChange), schema-validated rpc/cli
 * invocation shapes (strict JSON boundaries, exit-code normalization), `threads.spawn`
 * attribution, atomic reload, and dispose order (services aborted, hooks LIFO,
 * database closed, stale handles throw). New tests can keep host inputs,
 * assertions, and shutdown explicit through `harness.behavior`,
 * `harness.inspection`, and `harness.lifecycle`; direct members remain aliases.
 *
 * Deliberately different from the real host:
 * - storage is process-local: kv in a Map, `storage.database()` one shared
 *   better-sqlite3 handle in a temp directory (same data across calls, like
 *   the host's shared file), secret settings alongside plain values (no files).
 * - `bb.sdk` is always bound (no listen gate) and every unstubbed method
 *   throws instead of hitting a server.
 * - http auth modes are recorded but not enforced — signature checks and
 *   token handling inside handlers still run.
 * - background services/schedules never run on timers; `harness.runService`
 *   and `harness.runSchedule` invoke them deterministically.
 */
/** Same shape (and name) the real host throws for stale API handles. */
declare class PluginContextStaleError extends Error {
    constructor(pluginId: string);
}
type FakeLogLevel = "debug" | "error" | "info" | "warn";
interface FakeLogEntry {
    level: FakeLogLevel;
    message: string;
}
interface FakeHttpRouteRecord {
    method: string;
    path: string;
    auth: PluginHttpAuthMode;
    handler: PluginHttpHandler;
}
interface FakeScheduleRecord {
    name: string;
    cron: string;
    fn: () => void | Promise<void>;
}
interface FakeServiceRecord {
    name: string;
    start: (signal: AbortSignal) => void | Promise<void>;
}
interface FakeCliRecord {
    name: string;
    summary: string;
    commands: PluginCliCommandInfo[];
    run: (argv: string[], ctx: PluginCliContext) => PluginCliResult | Promise<PluginCliResult>;
}
interface FakeAgentToolRecord {
    name: string;
    description: string;
    instructions: string | null;
    /**
     * The plugin's declared row presentation, null when it declared none.
     * Parsed by the shared `parsePluginAgentToolPresentation`, so the record
     * holds exactly what the production host stores and a presentation bb
     * rejects is rejected here with the same message.
     */
    presentation: PluginAgentToolPresentation | null;
    /** JSON-schema object the host would send providers. */
    inputSchema: unknown;
    parse(input: unknown): {
        ok: true;
        value: unknown;
    } | {
        ok: false;
        error: string;
    };
    execute(params: unknown, ctx: PluginAgentToolContext): PluginAgentToolResult | Promise<PluginAgentToolResult>;
}
interface FakeMentionProviderRecord {
    id: string;
    label: string;
    triggers: readonly PluginMentionTrigger[];
    search: (ctx: PluginMentionSearchContext) => PluginMentionItem[] | Promise<PluginMentionItem[]>;
    resolve: (itemId: string) => {
        context: string;
    } | Promise<{
        context: string;
    }>;
}
interface FakeRealtimeSignal {
    channel: string;
    /** JSON-round-tripped, like the WS broadcast; `undefined` → `null`. */
    payload: unknown;
}
interface ExperimentalFakeHostRpcCall {
    method: string;
    input: unknown;
    hostId: string;
    signal?: AbortSignal;
}
/** Everything the plugin registered, exposed raw for assertions. */
interface FakePluginRegistrations {
    settingsDescriptors: PluginSettingDescriptors;
    httpRoutes: FakeHttpRouteRecord[];
    rpcMethods: string[];
    services: FakeServiceRecord[];
    schedules: FakeScheduleRecord[];
    cli: FakeCliRecord | null;
    agentTools: FakeAgentToolRecord[];
    /** Provider from bb.agents.configure, or null when none registered. */
    agentConfigurationProvider: ((context: PluginAgentConfigurationContext) => PluginAgentConfiguration) | null;
    /** Provider from contributeInstructions, or null when none registered. */
    instructionProvider: ((ctx: {
        threadId: string;
        projectId: string;
    }) => string | null) | null;
    threadEventHandlers: Record<PluginThreadEventName, number>;
    mentionProviders: FakeMentionProviderRecord[];
    /** Live provider registrations from `bb.providers.register`
     * (normalized declarations, registration order; dispose removes). */
    providerRegistrations: NormalizedPluginProviderDeclaration[];
    /** Live AI-service registrations from `experimental_aiServices.register`
     * (normalized declarations, registration order; dispose removes). */
    aiServiceRegistrations: PluginAiServiceDeclaration[];
}
/** Read-only state for assertions after a plugin registers or handles work. */
interface FakePluginInspectionState {
    readonly pluginId: string;
    /** Every `bb.log` line, in order. */
    readonly logEntries: FakeLogEntry[];
    /** Every `bb.realtime.publish`, payload normalized like the wire. */
    readonly realtimeSignals: FakeRealtimeSignal[];
    /** Every `bb.status.needsConfiguration` message, in order. */
    readonly needsConfigurationMessages: string[];
    /** Recorded `bb.sdk` calls + stub control. */
    readonly sdk: FakeSdkHarness;
    readonly registrations: FakePluginRegistrations;
    readonly sharedPortDeclarations: Array<{
        hostId: string;
        ports: number[];
    }>;
    /** Calls made through bb.hosts.experimental_client, after input validation. */
    readonly experimental_hostRpcCalls: readonly ExperimentalFakeHostRpcCall[];
    readonly pendingInteractions: readonly (PluginInteractionRequest & {
        id: string;
    })[];
}
/** Deterministic inputs that stand in for behavior normally driven by BB. */
interface FakePluginBehaviorDrivers {
    /** Deliver an unexpected host-worker exit to every registered client. */
    experimental_emitHostWorkerExit(hostId: string): Promise<void>;
    /** Deliver a host signal through its registered payload schema. */
    experimental_emitHostSignal(hostId: string, signal: string, payload: unknown): Promise<void>;
    submitInteraction(id: string, value: JsonValue$1): void;
    cancelInteraction(id: string): void;
    /**
     * Apply a settings update the way the host's settings save does:
     * validate against the declared descriptors (`null` unsets), store, and
     * fire `onChange` listeners when effective values changed. Throws on
     * unknown keys or wrong value types.
     */
    setSettings(values: Record<string, PluginSettingValue$1 | null>): Promise<void>;
    /**
     * Invoke a registered rpc method with host semantics: input/output schemas,
     * strict JSON result normalization, and structured failure codes. Rejects
     * with the same message/code/issues the frontend client surfaces.
     */
    callRpc(method: string, input?: unknown): Promise<unknown>;
    /**
     * Invoke the plugin's CLI command with host semantics: the result's
     * exitCode must be a number, stdout/stderr default to "", and a throwing
     * run() becomes `{ exitCode: 1, stderr: "bb <name> failed: …" }`.
     */
    runCli(argv: string[], ctx?: PluginCliContext): Promise<PluginCliExecutionResult>;
    /**
     * Dispatch a request to a registered `bb.http` route (exact method+path
     * match, like the host's V1 router) through a real Hono context. Auth
     * modes are not enforced. A throwing handler yields the host's 500
     * `{ ok: false, error: "plugin route failed: …" }` response.
     */
    fetchHttp(method: string, path: string, init?: RequestInit): Promise<Response>;
    /**
     * Start a registered background service once, deterministically. `done`
     * settles when `start` returns; abort `controller` to signal shutdown.
     * A thrown NeedsConfigurationError (matched by name, like the host) is
     * recorded via needsConfiguration and resolves `done`; other errors
     * reject it.
     */
    runService(name: string): {
        controller: AbortController;
        done: Promise<void>;
    };
    /** Run a registered schedule's function once (no timers, no cron sweep). */
    runSchedule(name: string): Promise<void>;
    /**
     * Deliver a thread lifecycle event to every `bb.events.on` handler. Handlers run
     * sequentially; errors are caught and logged like the host's
     * fire-and-forget dispatch, and returned for assertions.
     */
    emitThreadEvent<E extends PluginThreadEventName>(event: E, payload: PluginThreadEventPayloads[E]): Promise<{
        errors: unknown[];
    }>;
    /**
     * Call a registered agent tool the way a provider tool-call would:
     * arguments go through the tool's parse step (zod-validated for zod
     * registrations; a parse failure throws), then execute. `ctx` fields
     * default to "thread-test"/"project-test" and a fresh signal.
     */
    callAgentTool(name: string, input: unknown, ctx?: Partial<PluginAgentToolContext>): Promise<PluginAgentToolResult>;
    /** Evaluate `bb.agents.configure` with production validation/fail-closed
     * semantics. With no callback, every registered tool/declared test skill is
     * selected. Callback failures are logged and return empty selections. */
    resolveAgentConfiguration(context: PluginAgentConfigurationContext): Promise<{
        tools: FakeAgentToolRecord[];
        skills: string[];
        instructions: string | null;
    }>;
}
/** Reload/shutdown controls, kept separate from behavior and inspection. */
interface FakePluginLifecycleControls {
    /**
     * Load a replacement against the same persisted settings, kv, and database.
     * The current host remains live when the factory throws; on success its
     * services/hooks are disposed and the returned host becomes current.
     */
    reload(factory: (bb: BbPluginApi) => void | Promise<void>): Promise<FakePluginHost>;
    /**
     * Dispose like a host reload/disable: abort services started via
     * runService, run onDispose hooks LIFO (isolated), close database handles,
     * then poison the `bb` handle (further use throws
     * PluginContextStaleError). Idempotent.
     */
    dispose(): Promise<void>;
}
/**
 * Complete fake-host harness. Direct members are retained for compatibility;
 * the named views make intent explicit in new tests.
 */
interface FakePluginHarness extends FakePluginInspectionState, FakePluginBehaviorDrivers, FakePluginLifecycleControls {
    readonly behavior: FakePluginBehaviorDrivers;
    readonly inspection: FakePluginInspectionState;
    readonly lifecycle: FakePluginLifecycleControls;
}
interface CreateFakePluginHostOptions {
    /** Defaults to "test-plugin". */
    pluginId?: string;
    /**
     * Value served by `bb.server.loopbackBaseUrl` (always bound here, like
     * `bb.sdk`). Defaults to "http://127.0.0.1:38886".
     */
    loopbackBaseUrl?: string;
    /**
     * Value served by `bb.server.experimental_dataDir`. Defaults to
     * "/tmp/bb-fake-data-dir".
     */
    dataDir?: string;
    /**
     * Pre-seeded stored settings values (as if saved before this load) —
     * including secret ones, which the fake keeps in memory instead of
     * files. Values with the wrong type for their descriptor fall back to
     * the descriptor default on read, like the host.
     */
    settings?: Record<string, PluginSettingValue$1>;
    /** Initial `bb.sdk` stubs; extend later via `harness.sdk.stub`. */
    sdk?: FakeSdkOverrides;
    /** Static manifest skill ids available to configure() in this fake host. */
    agentSkillIds?: readonly string[];
    /** Read-only identities returned by bb.hosts.ensureSharedPortTunnel. */
    sharedPortTunnelIdentities?: Record<string, PluginSharedPortTunnelIdentity>;
    /**
     * Whether the plugin's manifest declares a `bb.host` entry. Production
     * refuses `bb.providers.register` (the provider would have no bridge to
     * run on) and `experimental_aiServices.register` (the service would have
     * nothing to run on) without one; the fake applies the same rules.
     * Defaults to true.
     */
    experimental_hostEntry?: boolean;
    /**
     * The icon names the plugin's manifest declares under
     * `bb.branding.experimental_icons`. Production refuses a provider `icon`
     * or a tool `presentation.icon.glyph` that is a namespaced glyph
     * (`"<pluginId>/<name>"`) naming another plugin or a name not declared
     * there; the fake applies the same rule against this list. Defaults to
     * none declared, so every namespaced glyph is refused until the test
     * names the icons the manifest would.
     */
    experimental_declaredIconNames?: readonly string[];
    /** Deterministic stand-in for the targeted daemon host entry. */
    experimental_callHostRpc?: (call: ExperimentalFakeHostRpcCall) => unknown | Promise<unknown>;
}
interface FakePluginHost {
    bb: BbPluginApi;
    harness: FakePluginHarness;
}
declare function createFakePluginHost(options?: CreateFakePluginHostOptions): FakePluginHost;

type ThreadResponse = PluginThreadEventPayloads["thread.created"]["thread"];
/**
 * A complete, deterministic `ThreadResponse` for thread lifecycle event
 * payloads (`harness.emitThreadEvent`). Defaults are the minimal idle
 * thread; override the fields the test cares about. If the contract grows a
 * required field, this builder fails typecheck — update the default here.
 */
declare function makeThreadResponse(overrides?: Partial<ThreadResponse>): ThreadResponse;

interface PublicSdkOnlyScanOptions {
    /**
     * Public packages the plugin depends on beyond the SDK (a config-file
     * parser, say), matched against the whole specifier. Plugin code and tests
     * alike may import them.
     */
    allow?: readonly RegExp[];
}
interface PublicSdkOnlyViolation {
    /** The importing file, relative to the package root. */
    file: string;
    /** The import specifier, or the argument text of a dynamic one. */
    specifier: string;
    reason: "dynamic-specifier" | "outside-allowlist" | "outside-package" | "private-package";
}
interface PublicSdkOnlyScan {
    /** Every source file scanned, relative to the package root, in walk order. */
    files: string[];
    violations: PublicSdkOnlyViolation[];
    /** `@bb/*` names in the package.json dependencies and devDependencies. */
    privateDependencies: string[];
}
/**
 * Scan a plugin package for imports outside the public SDK. `packageRoot`
 * is the directory holding its package.json; every `.ts`/`.tsx`/`.js`
 * file below it except `node_modules` and `dist` is read.
 */
declare function scanPublicSdkOnly(packageRoot: string, options?: PublicSdkOnlyScanOptions): PublicSdkOnlyScan;

export { PluginContextStaleError, createFakePluginHost, createFakeSdk, scanPublicSdkOnly as experimental_scanPublicSdkOnly, makeThreadResponse };
export type { CreateFakePluginHostOptions, FakeAgentToolRecord, FakeCliRecord, FakeHttpRouteRecord, FakeLogEntry, FakeLogLevel, FakeMentionProviderRecord, FakePluginBehaviorDrivers, FakePluginHarness, FakePluginHost, FakePluginInspectionState, FakePluginLifecycleControls, FakePluginRegistrations, FakeRealtimeSignal, FakeScheduleRecord, FakeSdkCall, FakeSdkHarness, FakeSdkOverrides, FakeServiceRecord, PublicSdkOnlyScan, PublicSdkOnlyScanOptions, PublicSdkOnlyViolation };
