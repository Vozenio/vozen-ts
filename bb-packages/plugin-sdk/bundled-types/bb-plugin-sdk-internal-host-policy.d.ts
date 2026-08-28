// Portable type declarations for `@get-bb/plugin-sdk`. Unpublished BB
// workspace contracts are flattened; public subpaths may reuse the
// package root without requiring any other @bb/* package.
//
// Confused by the API, or need a symbol that isn't here? Clone the BB repo
// and read the real source: https://github.com/get-bb/bb

import { z } from 'zod';

/**
 * Core `bb` CLI top-level command names (plus commander's built-in help).
 * Plugin CLI commands may not shadow these. Maintained by hand and checked
 * against the real Commander program by
 * apps/cli/src/__tests__/plugin-cli-proxy.test.ts.
 *
 * "automation" and "connect" are intentionally absent: builtin plugins own
 * those top-level commands and the CLI proxies them.
 */
declare const RESERVED_BB_CLI_COMMANDS: readonly string[];

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
interface PluginRpcMethodContract<InputSchema extends StandardSchemaV1 = StandardSchemaV1, OutputSchema extends StandardSchemaV1 = StandardSchemaV1> {
    readonly input: InputSchema;
    readonly output: OutputSchema;
}

/**
 * Declarative settings descriptors (`bb.settings.define`). Deliberately plain
 * data — not zod — so the host can render settings forms and the CLI can
 * parse values without executing plugin code.
 */
type PluginSettingDescriptor = {
    type: "string";
    label: string;
    description?: string;
    /** Stored in a 0600 file under <dataDir>/plugins/<id>/secrets/, never in the db or sent to the frontend. */
    secret?: true;
    /**
     * Render as a multi-line text field; for JSON or lists. Secrets cannot
     * be multi-line.
     */
    experimental_multiline?: boolean;
    default?: string;
} | {
    type: "boolean";
    label: string;
    description?: string;
    default?: boolean;
} | {
    type: "select";
    label: string;
    description?: string;
    options: string[];
    default?: string;
} | {
    type: "project";
    label: string;
    description?: string;
    default?: string;
};
type PluginSettingDescriptors = Record<string, PluginSettingDescriptor>;
type PluginSettingValue = string | boolean;
interface PluginCliOutputLimitError {
    code: "plugin_cli_output_too_large";
    message: string;
    maxBytes: number;
    stdoutBytes: number;
    stderrBytes: number;
    totalBytes: number;
}
/** Normalized host result returned by the plugin CLI HTTP/testing boundary. */
interface PluginCliExecutionResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    error?: PluginCliOutputLimitError;
}
/**
 * The row title of a plugin tool call while it is pending and once it
 * settled. Each label is capped at 80 characters and rendered as plain text.
 */
interface PluginAgentToolLabels {
    /** Label shown while the tool call is pending. */
    pending: string;
    /** Label shown after the tool call completes successfully. */
    completed: string;
}
/**
 * How calls to a native plugin tool read as a timeline row (grammar v3). Every
 * field is optional at registration: the server fills what the plugin leaves
 * out (a generic `Running <name>` / `Ran <name>` label; the plugin's branding
 * glyph, then `Toolbox`) and hands one complete presentation to the provider
 * bridge with the tool definition.
 */
interface PluginAgentToolPresentation {
    /** Row title while the call is pending and once it settled. */
    label?: PluginAgentToolLabels;
    /**
     * A named host glyph (`{ glyph: "Workflow" }`), or one of this plugin's
     * own declared icons by its namespaced glyph (`{ glyph: "<pluginId>/<name>" }`,
     * an entry of the manifest's `bb.branding.experimental_icons` map). A
     * namespaced glyph that names another plugin or an undeclared name rejects
     * the tool registration.
     */
    icon?: {
        glyph: string;
    };
    /** Low-value rows clients collapse by default (a question a dedicated
     * interaction row already shows, a bookkeeping call). */
    suppress?: boolean;
    /** Accent colour per theme; omitted rows use the neutral row tint. */
    tint?: {
        light: string;
        dark: string;
    };
}
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
type PluginMentionTrigger = "!" | "#" | "$" | "@" | "~";
/**
 * What a plugin's AI service does. `inference` answers bb's server-side helper
 * completions (thread titles, commit messages: a prompt and a JSON Schema in,
 * a structured value out); `voice` transcribes recorded speech.
 */
type PluginAiServiceKind = "inference" | "voice";
/**
 * An AI service a plugin offers from its `bb.host` entry, which implements
 * `experimental_aiServicesHostContract` (`@get-bb/plugin-sdk/ai-services`).
 * The user selects it with `BB_INFERENCE` / `BB_TRANSCRIPTION` set to
 * `<id>/<model>`; core calls the plugin's host entry on the primary host with
 * the `id` on every request, so one entry can serve several services.
 */
interface PluginAiServiceDeclaration {
    /** The `<serviceId>` segment of the user's setting; stable, lowercase. */
    readonly id: string;
    /** Shown beside the id wherever the setting's options are listed. */
    readonly displayName: string;
    /** Which kinds this service answers; a kind it lacks is not offered. */
    readonly kinds: readonly PluginAiServiceKind[];
}

/**
 * Built-in dynamic tool names plugins may not shadow. Maintained by hand —
 * kept in sync with the built-in tools in
 * apps/server/src/services/threads/thread-runtime-config.ts by
 * apps/server/test/services/plugins/plugin-agent-tools.test.ts.
 */
declare const RESERVED_AGENT_TOOL_NAMES: readonly string[];
/** JSON values ≤256KB; larger writes are rejected with a clear error. */
declare const KV_VALUE_MAX_BYTES: number;
declare const PLUGIN_HTTP_METHODS: ReadonlySet<string>;
declare const RPC_METHOD_PATTERN: RegExp;
declare const BACKGROUND_NAME_PATTERN: RegExp;
declare const CLI_COMMAND_NAME_PATTERN: RegExp;
declare const AGENT_TOOL_NAME_PATTERN: RegExp;
declare const PLUGIN_AGENT_STATIC_INSTRUCTIONS_MAX_CHARS = 4096;
/** Status labels ride on every tool-call event and share one timeline row. */
declare const PLUGIN_AGENT_STATUS_LABEL_MAX_CHARS = 80;
declare const PLUGIN_AGENT_SELECTION_MAX_IDS = 256;
declare const PLUGIN_AGENT_DYNAMIC_INSTRUCTIONS_MAX_CHARS = 4096;
declare const PLUGIN_AGENT_TOOL_PARAMETERS_MAX_BYTES: number;
declare const MENTION_PROVIDER_ID_PATTERN: RegExp;
declare const PROVIDER_ID_PATTERN: RegExp;
declare const PLUGIN_PROVIDER_BRIDGE_OPTIONS_MAX_BYTES: number;
declare const SETTING_KEY_PATTERN: RegExp;
/**
 * Validate freeform descriptors from plugin code and merge them into the
 * plugin's registered schema. Plugin source is not type-safe at runtime, so
 * both the production and fake hosts must enforce this boundary identically.
 */
declare function registerSettingDescriptors(target: PluginSettingDescriptors, added: Record<string, unknown>): PluginSettingDescriptors;
/** Validate a settings update. `null` means unset. */
declare function validateSettingsUpdate(descriptors: PluginSettingDescriptors, values: Record<string, unknown>): string[];
declare const PLUGIN_MENTION_TRIGGER_VALUES: readonly ["@", "#", "$", "!", "~"];
declare function isPluginMentionTrigger(value: unknown): value is PluginMentionTrigger;
declare function normalizeMentionProviderTriggers(providerId: string, triggers: unknown): readonly PluginMentionTrigger[];
declare const PLUGIN_PROVIDER_DISPLAY_NAME_MAX_CHARS = 80;
declare const PLUGIN_PROVIDER_PERMISSION_MODE_VALUES: readonly ["accept-edits", "auto", "full"];
declare const PLUGIN_PROVIDER_REASONING_LEVEL_VALUES: readonly ["none", "low", "medium", "high", "xhigh", "ultracode", "max", "ultra"];
declare const PLUGIN_PROVIDER_COMPOSER_ACTION_VALUES: readonly ["plan", "goal"];
/**
 * AI-service ids the server serves itself: `openai` transcription and the
 * builtin inference providers (pi-ai 0.84). A plugin cannot register one —
 * it would capture the user's prompts and audio. This list is the one source
 * for both the fake host and production (`isServerDirectAiServiceId`);
 * apps/server/test/services/plugins/plugin-ai-services.test.ts pins it to
 * pi-ai's provider registry, so a pi-ai bump must move it in the same change.
 */
declare const SERVER_DIRECT_AI_SERVICE_IDS: readonly string[];
/**
 * Validate one `bb.experimental_aiServices.register` declaration the same
 * way in the production host and the fake host. Throws on the first problem;
 * returns a normalized, frozen copy carrying only contract fields.
 */
declare function validatePluginAiServiceDeclaration(declaration: PluginAiServiceDeclaration): PluginAiServiceDeclaration;
/**
 * What an AI service binds to, decided at the
 * `bb.experimental_aiServices.register` call: the plugin's built `bb.host`
 * artifact, or — when the plugin declares an entry that failed to build —
 * nothing yet, with the build problem. An unbound service is staged so the
 * factory completes; the load then fails on that problem before the staged
 * registrations flush, so the service never goes live, while a provider the
 * same factory declared can still be retained as unavailable.
 */
type AiServiceHostBinding<THostArtifact> = {
    readonly artifact: THostArtifact;
    readonly problem: null;
} | {
    readonly artifact: null;
    readonly problem: string;
};
/**
 * The refusals a host makes at `bb.experimental_aiServices.register` before
 * it stages the declaration: a reserved server-direct id, and a plugin with
 * no `bb.host` entry for the service to run on. A plugin whose declared
 * entry failed to build is not refused here: the service is staged unbound,
 * carrying the build problem, so the load fails on that problem — the
 * actionable one — after the factory instead of at this call, and a
 * provider the same factory declares is listed as unavailable rather than
 * lost. Returns what the service binds to. The production host and the fake
 * host both call this, so they refuse identically;
 * apps/server/test/services/plugins/plugin-ai-services.test.ts pins the
 * messages.
 */
declare function assertAiServiceRegistrable<THostArtifact>(args: {
    id: string;
    /** The plugin's built `bb.host` artifact, or null when it has none. */
    hostArtifact: THostArtifact | null;
    /** Why the artifact is missing when the plugin declared an entry that failed to build. */
    hostArtifactProblem: string | null;
}): AiServiceHostBinding<THostArtifact>;
/** The collision a second registration of a live AI-service id raises. */
declare function aiServiceAlreadyRegisteredMessage(id: string): string;
/** The collision a second registration of a live provider id raises. */
declare function providerAlreadyRegisteredMessage(id: string): string;
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
declare function validatePluginProviderDeclaration(declaration: PluginProviderDeclaration): NormalizedPluginProviderDeclaration;
/**
 * Run a declaration's `deriveProviderOptions` hook for one
 * command and validate its result as a bounded, plain-JSON object — the same
 * rules as `experimental_bridgeOptions`, because the result rides the same
 * wire slot. Shared by the real host and the fake so a hook that works in
 * tests works in production.
 */
declare function deriveValidatedProviderOptions(args: {
    declaration: PluginProviderDeclaration;
    context: Parameters<NonNullable<PluginProviderDeclaration["deriveProviderOptions"]>>[0];
}): Readonly<Record<string, JsonValue>>;
declare function isStandardSchema(value: unknown): value is StandardSchemaV1;
declare function readRpcMethodContract(method: string, value: unknown): PluginRpcMethodContract;
/** Duck-typed zod detection: plugin sources may carry their own zod copy,
 * so instanceof is useless — anything with safeParse is treated as zod. */
declare function isZodSchemaLike(value: unknown): boolean;
/**
 * Reject recursive local references before a tool schema reaches a provider.
 * Some providers reject the complete tool list when any one schema contains a
 * recursive `$ref`, so this is a shared production/fake-host boundary rule.
 */
declare function assertNoRecursiveJsonSchemaReferences(schema: unknown, subject: string): void;
/**
 * Reject the fields a registration never reads. Renamed fields get the
 * message above; any other `experimental_` field is unknown (the same
 * rule configure() output follows in the plugin service). The production
 * host and the fake host both call this before parsing `presentation`, so
 * a registration built against an older SDK fails a plugin's own unit test
 * with the message bb would give it.
 */
declare function rejectStaleAgentToolFields(toolName: string, tool: object): void;
/**
 * The declared shape of `presentation`, copied field by field so
 * a plugin's object cannot smuggle prototypes or extra markup into the
 * persisted row. Labels share the status-label length cap. The production
 * host and the fake host both call this, so a presentation that registers
 * in a plugin unit test registers in bb, and one bb rejects is rejected
 * with the same message.
 */
declare function parsePluginAgentToolPresentation(toolName: string, value: unknown): PluginAgentToolPresentation | null;
/** Compact issue summary from a (possibly foreign-instance) zod error. */
declare function summarizeParseIssues(error: unknown): string;
declare function enforcePluginCliOutputLimit(result: Omit<PluginCliExecutionResult, "error">, jsonOutput: boolean): PluginCliExecutionResult;
/**
 * Adopt the value a plugin HTTP route handler returned.
 *
 * Plugin handlers can run in a different realm (jiti-loaded modules, bundled
 * fetch polyfills), so a valid `Response` from a handler can fail
 * `instanceof Response` in the host (#1661). Both the real host and the fake
 * host accept a structurally valid Response from any realm and re-wrap it
 * into a this-realm `Response`, so Hono always consumes a native object and a
 * malformed return still fails at the invoke boundary with a pointed error.
 *
 * The body streams through: a foreign `body` stream is piped chunk by chunk
 * with cancellation forwarded to the source, so no full-size buffer is made.
 */
declare function adoptHttpRouteResponse(value: unknown): Response;
/**
 * The one rule for a namespaced glyph (`"<pluginId>/<name>"`) wherever a
 * plugin may reference its own declared icons — a tool presentation at
 * `bb.agents.registerTool`, a provider icon at `bb.providers.register`, and a
 * row presentation at ingest: the plugin id must be the emitting plugin's
 * and the name must be in its `bb.branding.experimental_icons` map. The
 * server and the fake plugin host apply it from here, so a registration the
 * fake accepts is one the server accepts.
 *
 * Returns the reason a glyph is refused, always naming the glyph and the
 * plugin, or null when the glyph is acceptable. A host glyph (no `/`) is
 * never refused here: whether the client can draw it is the client's call.
 */
declare function undeclaredIconProblem(pluginId: string, declaredIconNames: ReadonlySet<string>, glyph: string): string | null;
/** `bb.providers.register` refusal for an icon {@link undeclaredIconProblem} rejects. */
declare function providerIconRefusalMessage(providerId: string, problem: string): string;
/** `bb.agents.registerTool` refusal for a glyph {@link undeclaredIconProblem} rejects. */
declare function agentToolIconRefusalMessage(toolName: string, problem: string): string;
/**
 * `bb.providers.register` refusal for a plugin whose manifest declares no
 * `bb.host` entry: a declaration is metadata, and the bridge it runs on is
 * that entry.
 */
declare function providerWithoutBridgeMessage(providerId: string): string;

export { AGENT_TOOL_NAME_PATTERN, BACKGROUND_NAME_PATTERN, CLI_COMMAND_NAME_PATTERN, KV_VALUE_MAX_BYTES, MENTION_PROVIDER_ID_PATTERN, PLUGIN_AGENT_DYNAMIC_INSTRUCTIONS_MAX_CHARS, PLUGIN_AGENT_SELECTION_MAX_IDS, PLUGIN_AGENT_STATIC_INSTRUCTIONS_MAX_CHARS, PLUGIN_AGENT_STATUS_LABEL_MAX_CHARS, PLUGIN_AGENT_TOOL_PARAMETERS_MAX_BYTES, PLUGIN_HTTP_METHODS, PLUGIN_MENTION_TRIGGER_VALUES, PLUGIN_PROVIDER_BRIDGE_OPTIONS_MAX_BYTES, PLUGIN_PROVIDER_COMPOSER_ACTION_VALUES, PLUGIN_PROVIDER_DISPLAY_NAME_MAX_CHARS, PLUGIN_PROVIDER_PERMISSION_MODE_VALUES, PLUGIN_PROVIDER_REASONING_LEVEL_VALUES, PROVIDER_ID_PATTERN, RESERVED_AGENT_TOOL_NAMES, RESERVED_BB_CLI_COMMANDS, RPC_METHOD_PATTERN, SERVER_DIRECT_AI_SERVICE_IDS, SETTING_KEY_PATTERN, adoptHttpRouteResponse, agentToolIconRefusalMessage, aiServiceAlreadyRegisteredMessage, assertAiServiceRegistrable, assertNoRecursiveJsonSchemaReferences, deriveValidatedProviderOptions, enforcePluginCliOutputLimit, isPluginMentionTrigger, isStandardSchema, isZodSchemaLike, normalizeMentionProviderTriggers, parsePluginAgentToolPresentation, providerAlreadyRegisteredMessage, providerIconRefusalMessage, providerWithoutBridgeMessage, readRpcMethodContract, registerSettingDescriptors, rejectStaleAgentToolFields, summarizeParseIssues, undeclaredIconProblem, validatePluginAiServiceDeclaration, validatePluginProviderDeclaration, validateSettingsUpdate };
export type { AiServiceHostBinding, NormalizedPluginProviderDeclaration };
