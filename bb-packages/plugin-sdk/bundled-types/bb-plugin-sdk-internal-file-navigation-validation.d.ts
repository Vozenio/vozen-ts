// Portable type declarations for `@get-bb/plugin-sdk`. Unpublished BB
// workspace contracts are flattened; public subpaths may reuse the
// package root without requiring any other @bb/* package.
//
// Confused by the API, or need a symbol that isn't here? Clone the BB repo
// and read the real source: https://github.com/get-bb/bb

/** A live file whose identity is complete without ambient route context. */
type ExperimentalLiveFileTarget = {
    kind: "workspace";
    environmentId: string;
    path: string;
} | {
    kind: "host";
    hostId: string;
    path: string;
} | {
    kind: "thread-storage";
    threadId: string;
    path: string;
};
/** One-based location to reveal after a live file opens. */
type ExperimentalFileLocation = {
    kind: "line";
    line: number;
    column: number | null;
} | {
    kind: "range";
    startLine: number;
    endLine: number;
};
/** Options shared by BB's preview and preferred-external file intents. */
interface ExperimentalFileOpenOptions {
    target: ExperimentalLiveFileTarget;
    location: ExperimentalFileLocation | null;
}

declare function normalizeExperimentalLiveFileTarget(value: unknown): ExperimentalLiveFileTarget | null;
declare function normalizeExperimentalFileLocation(value: unknown): ExperimentalFileLocation | null | undefined;
declare function normalizeExperimentalFileOpenOptions(value: unknown): ExperimentalFileOpenOptions | null;

export { normalizeExperimentalFileLocation, normalizeExperimentalFileOpenOptions, normalizeExperimentalLiveFileTarget };
