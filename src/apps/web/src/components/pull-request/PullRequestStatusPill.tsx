import i18next from "i18next";
import type { PullRequestState, ThreadPullRequest } from "@bb/domain";
import { Icon, type IconName } from "@bb/shared-ui/icon";
import { cn } from "@bb/shared-ui/lib/utils";
import { getPullRequestGithubCheckStatus } from "@/lib/pull-request-display";
import { GithubFaviconIcon } from "./GithubFaviconIcon";

function pullRequestStatusIcon(
  state: PullRequestState,
): { icon: IconName; className: string; title: string } {
  switch (state) {
    case "open":
      return {
        icon: "GitPullRequestArrow",
        className: "text-success",
        title: i18next.t("pullRequest.statusPill.open", "Open Pull Request"),
      };
    case "closed":
      return {
        icon: "GitPullRequestClosed",
        className: "text-destructive",
        title: i18next.t(
          "pullRequest.statusPill.closed",
          "Closed Pull Request",
        ),
      };
    case "merged":
      return {
        icon: "GitMerge",
        className: "text-pr-merged",
        title: i18next.t(
          "pullRequest.statusPill.merged",
          "Merged Pull Request",
        ),
      };
    case "draft":
      return {
        icon: "GitPullRequestDraft",
        className: "text-muted-foreground",
        title: i18next.t(
          "pullRequest.statusPill.draft",
          "Draft Pull Request",
        ),
      };
  }
}

const CHECKED_PULL_REQUEST_STATUS_MIN_WIDTH_CLASS = "min-w-9";
const SINGLE_PULL_REQUEST_STATUS_MIN_WIDTH_CLASS = "min-w-4";

export function PullRequestStateIcon({
  state,
  className,
}: {
  state: PullRequestState;
  className?: string;
}) {
  const statusIcon = pullRequestStatusIcon(state);
  return (
    <Icon
      name={statusIcon.icon}
      className={cn("size-4 shrink-0", statusIcon.className, className)}
      aria-hidden="true"
    />
  );
}

export function PullRequestGithubCheckIcon({
  pullRequest,
  className,
}: {
  pullRequest: ThreadPullRequest;
  className?: string;
}) {
  const status = getPullRequestGithubCheckStatus(pullRequest);
  if (status === null) {
    return null;
  }
  return <GithubFaviconIcon status={status} className={className} />;
}

export function PullRequestStatusPill({
  pullRequest,
  className,
}: {
  pullRequest: ThreadPullRequest;
  className?: string;
}) {
  const hasCheckIcon = getPullRequestGithubCheckStatus(pullRequest) !== null;
  return (
    <span
      title={pullRequestStatusIcon(pullRequest.state).title}
      className={cn(
        "flex h-5 shrink-0 cursor-pointer items-center gap-1",
        hasCheckIcon
          ? CHECKED_PULL_REQUEST_STATUS_MIN_WIDTH_CLASS
          : SINGLE_PULL_REQUEST_STATUS_MIN_WIDTH_CLASS,
        className,
      )}
    >
      <PullRequestStateIcon state={pullRequest.state} />
      <PullRequestGithubCheckIcon pullRequest={pullRequest} />
    </span>
  );
}
