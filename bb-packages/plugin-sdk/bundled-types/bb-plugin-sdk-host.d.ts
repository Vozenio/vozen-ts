// Portable type declarations for `@get-bb/plugin-sdk`. Unpublished BB
// workspace contracts are flattened; public subpaths may reuse the
// package root without requiring any other @bb/* package.
//
// Confused by the API, or need a symbol that isn't here? Clone the BB repo
// and read the real source: https://github.com/get-bb/bb

import { z } from 'zod';

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
type StandardSchemaV1InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["input"];
type StandardSchemaV1InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["output"];
interface PluginRpcMethodContract<InputSchema extends StandardSchemaV1 = StandardSchemaV1, OutputSchema extends StandardSchemaV1 = StandardSchemaV1> {
    readonly input: InputSchema;
    readonly output: OutputSchema;
}
type PluginRpcContract = Readonly<Record<string, PluginRpcMethodContract>>;

interface ExperimentalHostSignalContract<PayloadSchema extends StandardSchemaV1 = StandardSchemaV1> {
    readonly payload: PayloadSchema;
}
type ExperimentalHostSignals = Readonly<Record<string, ExperimentalHostSignalContract>>;
interface ExperimentalHostPaths {
    /** Persistent directory scoped to this plugin on this daemon. */
    readonly dataDir: string;
    /** Temporary directory scoped to this worker process. */
    readonly tempDir: string;
}
type ExperimentalHostWatchChangeType = "create" | "delete" | "update";
interface ExperimentalHostWatchChange {
    readonly path: string;
    readonly type: ExperimentalHostWatchChangeType;
}
type ExperimentalHostWatchEvent = {
    readonly kind: "changed";
    readonly changes: readonly ExperimentalHostWatchChange[];
} | {
    readonly kind: "rescan-required";
} | {
    readonly kind: "watch-error";
    readonly message: string;
};
interface ExperimentalHostWatchOptions {
    /** Absolute directory observed by the daemon's native watcher service. */
    readonly rootPath: string;
    /** Root-relative ignore entries using the native watcher syntax. */
    readonly ignoredPaths?: readonly string[];
    /** Quiet period before one coalesced delivery. Defaults to 75 ms. */
    readonly debounceMs?: number;
    /** Maximum time changes may wait. Defaults to 500 ms. */
    readonly maxWaitMs?: number;
}
interface ExperimentalHostWatchSubscription {
    dispose(): Promise<void>;
}
interface ExperimentalHostWorkerLease {
    /** Release this worker-retention lease. Safe to call more than once. */
    dispose(): Promise<void>;
}
type ExperimentalHostWatchListener = (event: ExperimentalHostWatchEvent) => void | Promise<void>;
interface ExperimentalHostRpcContext<Signals extends ExperimentalHostSignals = {}> {
    /** Aborted when this request is cancelled or its worker is disposed. */
    readonly signal: AbortSignal;
    /** Aborted once for the lifetime of this worker process. */
    readonly lifecycle: {
        readonly signal: AbortSignal;
    };
    readonly experimental_paths: ExperimentalHostPaths;
    /** Publish a validated, ephemeral event to this plugin's server entry. */
    experimental_emitSignal<SignalName extends keyof Signals & string>(signal: SignalName, payload: StandardSchemaV1InferInput<Signals[SignalName]["payload"]>): Promise<void>;
    /** Observe raw filesystem changes through the daemon's native watcher. */
    experimental_watch(options: ExperimentalHostWatchOptions, listener: ExperimentalHostWatchListener): Promise<ExperimentalHostWatchSubscription>;
    /**
     * Keep this worker alive after the current call finishes. Active calls and
     * filesystem watches already retain it; use this only for other background
     * work. The daemon may stop an unretained worker after an idle period.
     */
    experimental_retainWorker(): ExperimentalHostWorkerLease;
}
type ExperimentalHostRpcHandlers<Contract extends PluginRpcContract, Signals extends ExperimentalHostSignals = {}> = {
    [MethodName in keyof Contract]: (input: StandardSchemaV1InferOutput<Contract[MethodName]["input"]>, context: ExperimentalHostRpcContext<Signals>) => StandardSchemaV1InferInput<Contract[MethodName]["output"]> | Promise<StandardSchemaV1InferInput<Contract[MethodName]["output"]>>;
};
interface ExperimentalHostEntry<Contract extends PluginRpcContract = PluginRpcContract, Signals extends ExperimentalHostSignals = {}> {
    readonly experimental_apiVersion: 1;
    readonly contract: Contract;
    readonly experimental_signals?: Signals;
    readonly handlers: ExperimentalHostRpcHandlers<Contract, Signals>;
    readonly dispose?: () => void | Promise<void>;
}
/** Define the single host executable exported by `bb.host`. */
declare function experimental_defineHostEntry<const Contract extends PluginRpcContract, const Signals extends ExperimentalHostSignals = {}>(args: {
    contract: Contract;
    experimental_signals?: Signals;
    handlers: ExperimentalHostRpcHandlers<Contract, Signals>;
    dispose?: () => void | Promise<void>;
}): ExperimentalHostEntry<Contract, Signals>;

/** The input form a resolver writes: the options optional, filled per side by the normalizer. */
declare const providerResolvedNativeRootInputSchema: z.ZodObject<{
    ancestors: z.ZodOptional<z.ZodBoolean>;
    fallbackName: z.ZodOptional<z.ZodString>;
    namePrefix: z.ZodOptional<z.ZodString>;
    origin: z.ZodEnum<{
        project: "project";
        user: "user";
    }>;
    path: z.ZodString;
    recursive: z.ZodOptional<z.ZodBoolean>;
    shape: z.ZodOptional<z.ZodEnum<{
        "command-file": "command-file";
        "skill-file": "skill-file";
        commands: "commands";
        skill: "skill";
        skills: "skills";
    }>>;
    skipIfManifest: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
type ProviderResolvedNativeRootInput = z.input<typeof providerResolvedNativeRootInputSchema>;
declare const providerResolvedNativeRootsSchema: z.ZodObject<{
    commands: z.ZodArray<z.ZodObject<{
        ancestors: z.ZodBoolean;
        fallbackName: z.ZodOptional<z.ZodString>;
        namePrefix: z.ZodString;
        origin: z.ZodEnum<{
            project: "project";
            user: "user";
        }>;
        path: z.ZodString;
        recursive: z.ZodBoolean;
        shape: z.ZodEnum<{
            "command-file": "command-file";
            "skill-file": "skill-file";
            commands: "commands";
            skill: "skill";
            skills: "skills";
        }>;
        skipIfManifest: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    skills: z.ZodArray<z.ZodObject<{
        ancestors: z.ZodBoolean;
        fallbackName: z.ZodOptional<z.ZodString>;
        namePrefix: z.ZodString;
        origin: z.ZodEnum<{
            project: "project";
            user: "user";
        }>;
        path: z.ZodString;
        recursive: z.ZodBoolean;
        shape: z.ZodEnum<{
            "command-file": "command-file";
            "skill-file": "skill-file";
            commands: "commands";
            skill: "skill";
            skills: "skills";
        }>;
        skipIfManifest: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
type ProviderResolvedNativeRoots = z.infer<typeof providerResolvedNativeRootsSchema>;

/**
 * The host RPC a provider plugin implements when its declaration sets
 * `experimental_resolvesNativeRoots`. Core calls `resolveNativeRoots` on the
 * workspace host each time it lists a provider's commands or skills (cached
 * briefly per host and workspace) and scans the returned roots beside the
 * declared ones. The plugin answers from the host's own files — a moved
 * config directory, installed vendor plugins, config-file skill entries —
 * and decides each root's origin: a project-scoped vendor plugin is
 * `project`, a home-directory entry is `user`.
 *
 * Paths are host-absolute without dot segments. A root's `shape` says how the
 * daemon reads it; the defaults (`skills` for the skills side, `commands` for
 * the commands side) are filled by the contract. A thrown error or a
 * malformed answer is logged by core and yields no resolved roots for that
 * listing; it never fails the listing. A side longer than
 * `PROVIDER_RESOLVED_NATIVE_ROOTS_MAX` is cut to the cap, not refused.
 *
 * The contract validates the whole answer at once, so one root the contract
 * refuses (a vendor plugin whose name cannot be a name prefix, say) would
 * cost the user every other root. A resolver runs its answer through
 * `experimental_filterResolvedNativeRoots` before it returns: each root is
 * judged on its own, a refused one is dropped with a warning, and the rest
 * stand.
 */

declare const experimental_nativeRootsResolveInputSchema: z.ZodObject<{
    cwd: z.ZodNullable<z.ZodString>;
    providerId: z.ZodString;
}, z.core.$strict>;
type ExperimentalNativeRootsResolveInput = z.infer<typeof experimental_nativeRootsResolveInputSchema>;
type ResolvedRootSide = keyof ProviderResolvedNativeRoots;
/** What a resolver returns: the normalized roots, defaults filled per side, each side cut to the cap. */
declare const experimental_nativeRootsResolveOutputSchema: z.ZodPipe<z.ZodPipe<z.ZodObject<{
    commands: z.ZodOptional<z.ZodArray<z.ZodObject<{
        ancestors: z.ZodOptional<z.ZodBoolean>;
        fallbackName: z.ZodOptional<z.ZodString>;
        namePrefix: z.ZodOptional<z.ZodString>;
        origin: z.ZodEnum<{
            project: "project";
            user: "user";
        }>;
        path: z.ZodString;
        recursive: z.ZodOptional<z.ZodBoolean>;
        shape: z.ZodOptional<z.ZodEnum<{
            "command-file": "command-file";
            "skill-file": "skill-file";
            commands: "commands";
            skill: "skill";
            skills: "skills";
        }>>;
        skipIfManifest: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
    skills: z.ZodOptional<z.ZodArray<z.ZodObject<{
        ancestors: z.ZodOptional<z.ZodBoolean>;
        fallbackName: z.ZodOptional<z.ZodString>;
        namePrefix: z.ZodOptional<z.ZodString>;
        origin: z.ZodEnum<{
            project: "project";
            user: "user";
        }>;
        path: z.ZodString;
        recursive: z.ZodOptional<z.ZodBoolean>;
        shape: z.ZodOptional<z.ZodEnum<{
            "command-file": "command-file";
            "skill-file": "skill-file";
            commands: "commands";
            skill: "skill";
            skills: "skills";
        }>>;
        skipIfManifest: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
}, z.core.$strict>, z.ZodTransform<{
    skills: {
        path: string;
        origin: "project" | "user";
        recursive: boolean;
        ancestors: boolean;
        namePrefix: string;
        shape: "command-file" | "commands" | "skill" | "skill-file" | "skills";
        fallbackName?: string | undefined;
        skipIfManifest?: string | undefined;
    }[];
    commands: {
        path: string;
        origin: "project" | "user";
        recursive: boolean;
        ancestors: boolean;
        namePrefix: string;
        shape: "command-file" | "commands" | "skill" | "skill-file" | "skills";
        fallbackName?: string | undefined;
        skipIfManifest?: string | undefined;
    }[];
}, {
    skills?: {
        path: string;
        origin: "project" | "user";
        recursive?: boolean | undefined;
        ancestors?: boolean | undefined;
        namePrefix?: string | undefined;
        shape?: "command-file" | "commands" | "skill" | "skill-file" | "skills" | undefined;
        fallbackName?: string | undefined;
        skipIfManifest?: string | undefined;
    }[] | undefined;
    commands?: {
        path: string;
        origin: "project" | "user";
        recursive?: boolean | undefined;
        ancestors?: boolean | undefined;
        namePrefix?: string | undefined;
        shape?: "command-file" | "commands" | "skill" | "skill-file" | "skills" | undefined;
        fallbackName?: string | undefined;
        skipIfManifest?: string | undefined;
    }[] | undefined;
}>>, z.ZodObject<{
    commands: z.ZodArray<z.ZodObject<{
        ancestors: z.ZodBoolean;
        fallbackName: z.ZodOptional<z.ZodString>;
        namePrefix: z.ZodString;
        origin: z.ZodEnum<{
            project: "project";
            user: "user";
        }>;
        path: z.ZodString;
        recursive: z.ZodBoolean;
        shape: z.ZodEnum<{
            "command-file": "command-file";
            "skill-file": "skill-file";
            commands: "commands";
            skill: "skill";
            skills: "skills";
        }>;
        skipIfManifest: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    skills: z.ZodArray<z.ZodObject<{
        ancestors: z.ZodBoolean;
        fallbackName: z.ZodOptional<z.ZodString>;
        namePrefix: z.ZodString;
        origin: z.ZodEnum<{
            project: "project";
            user: "user";
        }>;
        path: z.ZodString;
        recursive: z.ZodBoolean;
        shape: z.ZodEnum<{
            "command-file": "command-file";
            "skill-file": "skill-file";
            commands: "commands";
            skill: "skill";
            skills: "skills";
        }>;
        skipIfManifest: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>>;
type ExperimentalNativeRootsResolveOutput = ProviderResolvedNativeRoots;
/** The input form a handler writes (options optional). */
type ExperimentalNativeRootsResolveAnswer = z.input<typeof experimental_nativeRootsResolveOutputSchema>;
/** One root `experimental_filterResolvedNativeRoots` refused, and why. */
interface ExperimentalDroppedNativeRoot {
    side: ResolvedRootSide;
    path: string;
    reason: string;
}
interface ExperimentalFilteredNativeRoots<Skill extends ProviderResolvedNativeRootInput, Command extends ProviderResolvedNativeRootInput> {
    /** The roots that passed, each side cut to the cap, in the order given. */
    answer: {
        skills: Skill[];
        commands: Command[];
    };
    dropped: ExperimentalDroppedNativeRoot[];
    /** How many roots the cap cut from each side. */
    truncated: {
        skills: number;
        commands: number;
    };
}
/**
 * Judge each root of an answer on its own against the contract, drop the
 * ones it refuses, and cut each side to `PROVIDER_RESOLVED_NATIVE_ROOTS_MAX`
 * (the first roots stay). `warn` is called once per dropped root and once
 * per cut side, with the path and the reason — once for the worker's
 * lifetime per (side, path, reason), so a persistent bad root does not flood
 * the host diagnostics. A resolver calls this on its
 * answer before it returns, so one odd vendor plugin cannot void the listing.
 * The reason lists the field-level issues when any field is malformed; the
 * cross-field rules are judged only on a root whose fields all parse.
 */
declare function experimental_filterResolvedNativeRoots<Skill extends ProviderResolvedNativeRootInput, Command extends ProviderResolvedNativeRootInput>(answer: {
    readonly skills?: readonly Skill[];
    readonly commands?: readonly Command[];
}, options: {
    warn: (message: string) => void;
    /** Warned (side, path, reason) keys; defaults to a set that lives as long as the worker. */
    warned?: Set<string>;
}): ExperimentalFilteredNativeRoots<Skill, Command>;
declare const experimental_nativeRootsHostContract: {
    readonly resolveNativeRoots: {
        readonly input: z.ZodObject<{
            cwd: z.ZodNullable<z.ZodString>;
            providerId: z.ZodString;
        }, z.core.$strict>;
        readonly output: z.ZodPipe<z.ZodPipe<z.ZodObject<{
            commands: z.ZodOptional<z.ZodArray<z.ZodObject<{
                ancestors: z.ZodOptional<z.ZodBoolean>;
                fallbackName: z.ZodOptional<z.ZodString>;
                namePrefix: z.ZodOptional<z.ZodString>;
                origin: z.ZodEnum<{
                    project: "project";
                    user: "user";
                }>;
                path: z.ZodString;
                recursive: z.ZodOptional<z.ZodBoolean>;
                shape: z.ZodOptional<z.ZodEnum<{
                    "command-file": "command-file";
                    "skill-file": "skill-file";
                    commands: "commands";
                    skill: "skill";
                    skills: "skills";
                }>>;
                skipIfManifest: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>>;
            skills: z.ZodOptional<z.ZodArray<z.ZodObject<{
                ancestors: z.ZodOptional<z.ZodBoolean>;
                fallbackName: z.ZodOptional<z.ZodString>;
                namePrefix: z.ZodOptional<z.ZodString>;
                origin: z.ZodEnum<{
                    project: "project";
                    user: "user";
                }>;
                path: z.ZodString;
                recursive: z.ZodOptional<z.ZodBoolean>;
                shape: z.ZodOptional<z.ZodEnum<{
                    "command-file": "command-file";
                    "skill-file": "skill-file";
                    commands: "commands";
                    skill: "skill";
                    skills: "skills";
                }>>;
                skipIfManifest: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>>;
        }, z.core.$strict>, z.ZodTransform<{
            skills: {
                path: string;
                origin: "project" | "user";
                recursive: boolean;
                ancestors: boolean;
                namePrefix: string;
                shape: "command-file" | "commands" | "skill" | "skill-file" | "skills";
                fallbackName?: string | undefined;
                skipIfManifest?: string | undefined;
            }[];
            commands: {
                path: string;
                origin: "project" | "user";
                recursive: boolean;
                ancestors: boolean;
                namePrefix: string;
                shape: "command-file" | "commands" | "skill" | "skill-file" | "skills";
                fallbackName?: string | undefined;
                skipIfManifest?: string | undefined;
            }[];
        }, {
            skills?: {
                path: string;
                origin: "project" | "user";
                recursive?: boolean | undefined;
                ancestors?: boolean | undefined;
                namePrefix?: string | undefined;
                shape?: "command-file" | "commands" | "skill" | "skill-file" | "skills" | undefined;
                fallbackName?: string | undefined;
                skipIfManifest?: string | undefined;
            }[] | undefined;
            commands?: {
                path: string;
                origin: "project" | "user";
                recursive?: boolean | undefined;
                ancestors?: boolean | undefined;
                namePrefix?: string | undefined;
                shape?: "command-file" | "commands" | "skill" | "skill-file" | "skills" | undefined;
                fallbackName?: string | undefined;
                skipIfManifest?: string | undefined;
            }[] | undefined;
        }>>, z.ZodObject<{
            commands: z.ZodArray<z.ZodObject<{
                ancestors: z.ZodBoolean;
                fallbackName: z.ZodOptional<z.ZodString>;
                namePrefix: z.ZodString;
                origin: z.ZodEnum<{
                    project: "project";
                    user: "user";
                }>;
                path: z.ZodString;
                recursive: z.ZodBoolean;
                shape: z.ZodEnum<{
                    "command-file": "command-file";
                    "skill-file": "skill-file";
                    commands: "commands";
                    skill: "skill";
                    skills: "skills";
                }>;
                skipIfManifest: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>;
            skills: z.ZodArray<z.ZodObject<{
                ancestors: z.ZodBoolean;
                fallbackName: z.ZodOptional<z.ZodString>;
                namePrefix: z.ZodString;
                origin: z.ZodEnum<{
                    project: "project";
                    user: "user";
                }>;
                path: z.ZodString;
                recursive: z.ZodBoolean;
                shape: z.ZodEnum<{
                    "command-file": "command-file";
                    "skill-file": "skill-file";
                    commands: "commands";
                    skill: "skill";
                    skills: "skills";
                }>;
                skipIfManifest: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>;
        }, z.core.$strict>>;
    };
};
type ExperimentalNativeRootsHostContract = typeof experimental_nativeRootsHostContract;

/** One root of a `resolveNativeRoots` answer, in the form a handler writes. */
type ResolvedRoot = NonNullable<ExperimentalNativeRootsResolveAnswer["skills"]>[number];
type ResolvedRootOrigin = "project" | "user";
/** The two sides of a `resolveNativeRoots` answer, each path once per side. */
interface ExperimentalVendorPluginRoots {
    skills: ResolvedRoot[];
    commands: ResolvedRoot[];
}
/** One installed vendor plugin in the Claude plugin layout. */
interface ExperimentalVendorPlugin {
    /** The plugin's root directory (the one holding its manifest), host-absolute. */
    rootPath: string;
    /**
     * The plugin's name: every root is prefixed `<name>:`, and a root
     * `SKILL.md` is named after it when the file's frontmatter names none. A
     * name that cannot be a name prefix costs the plugin its own roots at
     * `experimental_filterResolvedNativeRoots`, not the rest of the answer.
     */
    name: string;
    /** `user` for a personal install, `project` for one the workspace holds. */
    origin: ResolvedRootOrigin;
    /**
     * The manifest's `skills` entries, relative to the root, in the manifest's
     * own form (one path or a list). An absolute or escaping entry is ignored.
     */
    skills?: string | readonly string[];
    /** The manifest's `commands` entries, in the same form. */
    commands?: string | readonly string[];
}
interface ExperimentalVendorPluginRootsArgs {
    /** The plugins in answer order; the first to claim a path keeps it. */
    plugins: readonly ExperimentalVendorPlugin[];
    /**
     * The plugin layout. `claude` lists the conventional roots — the root
     * `SKILL.md`, `skills/` and `commands/` — and then the manifest's entries,
     * each directory read flat: a manifest directory that holds `SKILL.md`
     * itself is one skill. `grok` lists the manifest's entries only, each
     * directory read recursively.
     */
    layout: "claude" | "grok";
}
interface ExperimentalClaudePluginRootsArgs {
    /**
     * The workspace, or null when bb lists without one: project- and
     * local-scoped installs and the project skills directory's plugins count
     * only for the workspace that holds them.
     */
    cwd: string | null;
    /** The host user's home directory. */
    homeDir: string;
    /** The host environment; only `CLAUDE_CONFIG_DIR` is read. */
    env: Readonly<Record<string, string | undefined>>;
}
interface ExperimentalClaudePluginRoots extends ExperimentalVendorPluginRoots {
    /**
     * The Claude config directory the registry was read from:
     * `CLAUDE_CONFIG_DIR` (absolute, `~`-relative, or relative to the home
     * directory), else `~/.claude`. A resolver that also lists the directory's
     * own `skills` and `commands` takes it from here, so both agree.
     */
    claudeDir: string;
}
/**
 * The skill and command roots of the given plugins, in the given order, each
 * prefixed with its plugin's name. In the `claude` layout a plugin
 * contributes its root `SKILL.md` (named after the plugin when the file's
 * frontmatter has no name), `skills/`, `commands/`, then the manifest's
 * `skills` and `commands` entries; in the `grok` layout the manifest's
 * entries only, each directory recursive. A missing component is skipped; a
 * path answered twice is kept for the first plugin that named it.
 */
declare function experimental_resolveVendorPluginRoots(args: ExperimentalVendorPluginRootsArgs): Promise<ExperimentalVendorPluginRoots>;
/**
 * The roots of every enabled Claude plugin on this host, for one workspace.
 * Claude Code records installs in `<claudeDir>/plugins/installed_plugins.json`
 * and switches them in its settings (`enabledPlugins`: user, then the
 * workspace's `settings.json`, then `settings.local.json`; a manifest's
 * `defaultEnabled` decides an unlisted plugin). A `managed` or `user` install
 * is a user root; a `project` or `local` install counts only when the
 * workspace contains it, and is then a project root. An install whose
 * directory is gone is read from the plugin's cache directory. Plugins
 * dropped into the project and user `skills` directories follow. Each
 * plugin's roots come from `experimental_resolveVendorPluginRoots`
 * (`claude` layout), prefixed `<plugin>:`.
 */
declare function experimental_resolveClaudePluginRoots(args: ExperimentalClaudePluginRootsArgs): Promise<ExperimentalClaudePluginRoots>;

export { experimental_defineHostEntry, experimental_filterResolvedNativeRoots, experimental_nativeRootsHostContract, experimental_nativeRootsResolveInputSchema, experimental_nativeRootsResolveOutputSchema, experimental_resolveClaudePluginRoots, experimental_resolveVendorPluginRoots };
export type { ExperimentalClaudePluginRoots, ExperimentalClaudePluginRootsArgs, ExperimentalDroppedNativeRoot, ExperimentalFilteredNativeRoots, ExperimentalHostEntry, ExperimentalHostPaths, ExperimentalHostRpcContext, ExperimentalHostRpcHandlers, ExperimentalHostSignalContract, ExperimentalHostSignals, ExperimentalHostWatchChange, ExperimentalHostWatchChangeType, ExperimentalHostWatchEvent, ExperimentalHostWatchListener, ExperimentalHostWatchOptions, ExperimentalHostWatchSubscription, ExperimentalHostWorkerLease, ExperimentalNativeRootsHostContract, ExperimentalNativeRootsResolveAnswer, ExperimentalNativeRootsResolveInput, ExperimentalNativeRootsResolveOutput, ExperimentalVendorPlugin, ExperimentalVendorPluginRoots, ExperimentalVendorPluginRootsArgs };
