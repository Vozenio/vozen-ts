import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

interface ArchivedThreadToastTitleProps {
  archivedThreadCount: number;
  onOpenThread: () => void;
  threadTitle: string;
}

function formatArchivedChildThreadSuffix(
  childThreadCount: number,
  t: TFunction,
): string {
  if (childThreadCount <= 0) {
    return "";
  }
  return childThreadCount === 1
    ? t("thread.archivedToast.childSuffixOne", " and 1 child thread")
    : t(
        "thread.archivedToast.childSuffixOther",
        ` and ${childThreadCount} child threads`,
        { count: childThreadCount },
      );
}

/**
 * Rendered inside the Sonner toaster, which mounts outside the router —
 * navigation must come from the caller via onOpenThread rather than a <Link>.
 */
export function ArchivedThreadToastTitle({
  archivedThreadCount,
  onOpenThread,
  threadTitle,
}: ArchivedThreadToastTitleProps) {
  const { t } = useTranslation();
  return (
    <>
      <span className="inline-flex min-w-0 max-w-full items-baseline gap-1 overflow-hidden whitespace-nowrap">
        <span className="shrink-0">
          {t("thread.archivedToast.label", "Archived")}
        </span>{" "}
        <button
          type="button"
          className="min-w-0 truncate underline underline-offset-2"
          title={threadTitle}
          onClick={onOpenThread}
        >
          {threadTitle}
        </button>
      </span>
      {formatArchivedChildThreadSuffix(archivedThreadCount - 1, t)}
    </>
  );
}
