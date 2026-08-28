import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { WorkspaceStatus } from "@bb/domain";
import { DiffStatsTally } from "@/components/ui/diff-stats-tally.js";
import { EmptyState } from "@bb/shared-ui/empty-state";
import { FilePathLink } from "@/components/ui/file-path-link.js";
import { TruncatedList } from "@/components/ui/truncated-list.js";
import { cn } from "@bb/shared-ui/lib/utils";
import { formatWorkspaceFileStatus } from "@/components/workspace/workspace-change-summary";

export type WorkspaceChangedFile =
  WorkspaceStatus["workingTree"]["files"][number];

type WorkspaceChangedFileClickHandler = (file: WorkspaceChangedFile) => void;

interface WorkspaceChangesListProps {
  files: readonly WorkspaceChangedFile[];
  className?: string;
  onFileClick?: WorkspaceChangedFileClickHandler;
  /**
   * When set, the list caps at `limit` files behind a "Show N more" / "Show
   * less" toggle (like the Commits list) instead of the default scrollable
   * box. `className` is ignored in this mode — the rollup sizes to content.
   */
  limit?: number;
}

interface WorkspaceChangesListItemProps {
  file: WorkspaceChangedFile;
  onFileClick?: WorkspaceChangedFileClickHandler;
}

const WORKSPACE_CHANGE_ROW_CLASS =
  "grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-x-3";

/**
 * Upper bound on rows the scrollable (non-`limit`) mode renders. Workspace
 * status carries every changed path, and a stray untracked build directory
 * can produce tens of thousands of files. Rendering all of them makes every
 * layout on the page cost hundreds of milliseconds, so the list shows the
 * leading slice and reports how many rows it left out.
 */
export const WORKSPACE_CHANGES_LIST_MAX_ROWS = 200;

function formatHiddenFileCount(count: number, t: TFunction): string {
  const localizedCount = count.toLocaleString();
  return count === 1
    ? t("thread.workspaceChanges.hiddenCountOne", {
        defaultValue: `${localizedCount} more file not shown`,
        count: localizedCount,
      })
    : t("thread.workspaceChanges.hiddenCountOther", {
        defaultValue: `${localizedCount} more files not shown`,
        count: localizedCount,
      });
}

function fileKey(file: WorkspaceChangedFile): string {
  return `${file.status}:${file.path}`;
}

function WorkspaceChangesListItem({
  file,
  onFileClick,
}: WorkspaceChangesListItemProps) {
  const { t } = useTranslation();
  const rowContent = (
    <>
      <span className="text-xs leading-5 text-muted-foreground opacity-70">
        {formatWorkspaceFileStatus(file.status)}
      </span>
      <FilePathLink
        path={file.path}
        className={cn(
          "opacity-70",
          onFileClick ? "group-hover:underline" : undefined,
        )}
      />
      {file.insertions !== null && file.deletions !== null ? (
        <DiffStatsTally
          insertions={file.insertions}
          deletions={file.deletions}
          hideZero
          className="text-xs leading-5"
        />
      ) : null}
    </>
  );

  if (!onFileClick) {
    return <div className={WORKSPACE_CHANGE_ROW_CLASS}>{rowContent}</div>;
  }

  return (
    <button
      type="button"
      className={cn(
        WORKSPACE_CHANGE_ROW_CLASS,
        "group w-full rounded px-1 text-left transition-colors hover:bg-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      aria-label={t(
        "thread.workspaceChanges.openFileAriaLabel",
        `Open ${file.path}`,
        { path: file.path },
      )}
      onClick={() => onFileClick(file)}
    >
      {rowContent}
    </button>
  );
}

export function WorkspaceChangesList({
  files,
  className = "max-h-32",
  onFileClick,
  limit,
}: WorkspaceChangesListProps) {
  const { t } = useTranslation();
  if (!files || files.length === 0) {
    return (
      <EmptyState
        message={t("thread.workspaceChanges.empty", "No changed files detected.")}
      />
    );
  }

  if (limit !== undefined) {
    return (
      <TruncatedList
        items={files}
        getKey={fileKey}
        limit={limit}
        renderItem={(file) => (
          <WorkspaceChangesListItem file={file} onFileClick={onFileClick} />
        )}
      />
    );
  }

  const visibleFiles =
    files.length > WORKSPACE_CHANGES_LIST_MAX_ROWS
      ? files.slice(0, WORKSPACE_CHANGES_LIST_MAX_ROWS)
      : files;
  const hiddenFileCount = files.length - visibleFiles.length;

  return (
    <ul className={cn("space-y-1 overflow-auto", className)}>
      {visibleFiles.map((file) => (
        <li key={fileKey(file)}>
          <WorkspaceChangesListItem file={file} onFileClick={onFileClick} />
        </li>
      ))}
      {hiddenFileCount > 0 ? (
        <li className="px-1 text-xs leading-5 text-muted-foreground">
          {formatHiddenFileCount(hiddenFileCount, t)}
        </li>
      ) : null}
    </ul>
  );
}
