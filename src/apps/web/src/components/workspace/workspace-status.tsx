import type { ReactNode } from "react";
import i18next from "i18next";
import { assertNever } from "@bb/core-ui";
import type { WorkspaceStatus } from "@bb/domain";
import type { WorkspaceResolutionFailure } from "@bb/host-daemon-contract";
import { BbHttpError } from "@bb/sdk/browser";
import { describeLifecycleError } from "@/lib/lifecycle-errors";

export interface ThreadGitStatusDisplay {
  label:
    | "Unknown"
    | "Up to date"
    | "Clean"
    | "Ahead"
    | "Behind"
    | "Diverged"
    | "Dirty"
    | "Untracked";
  summary: string;
  summaryContent: ReactNode;
}

interface GetGitStatusDisplayOptions {
  error?: unknown;
  mergeBaseBranch?: string;
  showBranchComparison?: boolean;
  workspaceUnavailable?: WorkspaceResolutionFailure;
  workspaceDeleted?: boolean;
}

function formatComparisonSummary(
  status: WorkspaceStatus,
  mergeBaseBranch?: string,
): string | null {
  const aheadCount = status.mergeBase?.aheadCount ?? 0;
  const behindCount = status.mergeBase?.behindCount ?? 0;
  if (aheadCount === 0 && behindCount === 0) {
    return null;
  }

  if (aheadCount > 0 && behindCount > 0) {
    return mergeBaseBranch
      ? i18next.t(
          "workspace.status.aheadBehindRelativeTo",
          "{{aheadCount}} ahead, {{behindCount}} behind relative to {{branch}}",
          { aheadCount, behindCount, branch: mergeBaseBranch },
        )
      : i18next.t(
          "workspace.status.aheadBehind",
          "{{aheadCount}} ahead, {{behindCount}} behind",
          { aheadCount, behindCount },
        );
  }

  if (aheadCount > 0) {
    return mergeBaseBranch
      ? i18next.t("workspace.status.aheadOf", "{{aheadCount}} ahead of {{branch}}", {
          aheadCount,
          branch: mergeBaseBranch,
        })
      : i18next.t("workspace.status.ahead", "{{aheadCount}} ahead", {
          aheadCount,
        });
  }

  return mergeBaseBranch
    ? i18next.t("workspace.status.behindOf", "{{behindCount}} behind {{branch}}", {
        behindCount,
        branch: mergeBaseBranch,
      })
    : i18next.t("workspace.status.behind", "{{behindCount}} behind", {
        behindCount,
      });
}

function plainDisplay(
  label: ThreadGitStatusDisplay["label"],
  summary: string,
): ThreadGitStatusDisplay {
  return { label, summary, summaryContent: summary };
}

/**
 * Builds the one-line status pill rendered in the info tab and the git-action
 * dialog. The summary intentionally omits working-tree file/diff aggregates —
 * those are surfaced by `ChangedFilesRow` (info tab) and the dialog's own
 * Changed files row, so echoing them here would just duplicate the same numbers.
 * The summary only carries the merge-base comparison (ahead/behind) or a
 * fallback sentence when there is no comparison to show.
 */
export function getGitStatusDisplay(
  status: WorkspaceStatus | undefined,
  options?: GetGitStatusDisplayOptions,
): ThreadGitStatusDisplay {
  if (!status) {
    const lifecycleErrorDescription =
      options?.error === undefined
        ? null
        : describeLifecycleError({
            error: options.error,
            operation: "load_git_status",
          });
    if (lifecycleErrorDescription) {
      return plainDisplay("Unknown", lifecycleErrorDescription.body);
    }

    if (options?.workspaceUnavailable) {
      if (options.workspaceUnavailable.code === "path_not_found") {
        return plainDisplay(
          "Unknown",
          i18next.t("workspace.status.workspaceNotFound", "Workspace not found."),
        );
      }
      return plainDisplay("Unknown", options.workspaceUnavailable.message);
    }

    const isPathNotFound =
      options?.error instanceof BbHttpError &&
      options.error.code === "path_not_found";
    if (options?.workspaceDeleted || isPathNotFound) {
      return plainDisplay(
        "Unknown",
        i18next.t("workspace.status.workspaceNotFound", "Workspace not found."),
      );
    }
    return plainDisplay(
      "Unknown",
      i18next.t(
        "workspace.status.workspaceStatusUnavailable",
        "Workspace status unavailable.",
      ),
    );
  }

  const resolvedMergeBaseBranch =
    options?.mergeBaseBranch ?? status.mergeBase?.mergeBaseBranch;
  const comparisonSummary = options?.showBranchComparison
    ? formatComparisonSummary(status, resolvedMergeBaseBranch)
    : null;

  switch (status.workingTree.state) {
    case "clean": {
      if (
        (status.mergeBase?.aheadCount ?? 0) > 0 &&
        (status.mergeBase?.behindCount ?? 0) > 0
      ) {
        return plainDisplay(
          "Diverged",
          comparisonSummary ??
          i18next.t("workspace.status.branchDiverged", "Branch has diverged."),
        );
      }
      if ((status.mergeBase?.aheadCount ?? 0) > 0) {
        return plainDisplay(
          "Ahead",
          comparisonSummary ??
          i18next.t(
            "workspace.status.localCommitsPendingMerge",
            "Local commits pending merge.",
          ),
        );
      }
      if ((status.mergeBase?.behindCount ?? 0) > 0) {
        return plainDisplay(
          "Behind",
          comparisonSummary ??
          i18next.t(
            "workspace.status.branchBehindMergeBase",
            "Branch is behind its merge base.",
          ),
        );
      }
      return plainDisplay(
        options?.showBranchComparison ? "Up to date" : "Clean",
        resolvedMergeBaseBranch
          ? i18next.t(
              "workspace.status.noLocalChangesRelativeTo",
              "No local changes relative to {{branch}}.",
              { branch: resolvedMergeBaseBranch },
            )
          : i18next.t("workspace.status.noLocalChanges", "No local changes."),
      );
    }
    case "untracked":
      return plainDisplay("Untracked", comparisonSummary ?? "");
    case "dirty_uncommitted":
      return plainDisplay("Dirty", comparisonSummary ?? "");
    case "committed_unmerged":
      if (
        (status.mergeBase?.aheadCount ?? 0) > 0 &&
        (status.mergeBase?.behindCount ?? 0) > 0
      ) {
        return plainDisplay(
          "Diverged",
          comparisonSummary ??
          i18next.t("workspace.status.branchDiverged", "Branch has diverged."),
        );
      }
      if ((status.mergeBase?.behindCount ?? 0) > 0) {
        return plainDisplay(
          "Behind",
          comparisonSummary ??
          i18next.t(
            "workspace.status.branchBehindMergeBase",
            "Branch is behind its merge base.",
          ),
        );
      }
      return plainDisplay(
        "Ahead",
        comparisonSummary ??
          i18next.t(
            "workspace.status.localCommitsPendingMerge",
            "Local commits pending merge.",
          ),
      );
    case "dirty_and_committed_unmerged":
      return plainDisplay("Dirty", comparisonSummary ?? "");
    default:
      return assertNever(status.workingTree.state);
  }
}
