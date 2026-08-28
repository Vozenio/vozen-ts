import "@/lib/i18n/promptbox";
import type { Thread } from "@bb/domain";
import { useTranslation } from "react-i18next";
import {
  ConfirmDeleteDialog,
  ConfirmDeleteDialogContent,
} from "./ConfirmDeleteDialog";

export interface ThreadDeleteDialogTarget {
  thread: Thread;
  /** Present iff the thread has one or more non-deleted children. */
  childThreadCount?: number;
}

interface ThreadDeleteDialogProps {
  target: ThreadDeleteDialogTarget | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (target: ThreadDeleteDialogTarget) => void;
}

export function ThreadDeleteDialog({
  target,
  pending,
  onOpenChange,
  onDelete,
}: ThreadDeleteDialogProps) {
  return (
    <ConfirmDeleteDialog open={target !== null} onOpenChange={onOpenChange}>
      {target ? (
        <ThreadDeleteDialogContent
          target={target}
          pending={pending}
          onOpenChange={onOpenChange}
          onDelete={onDelete}
        />
      ) : null}
    </ConfirmDeleteDialog>
  );
}

interface ThreadDeleteDialogContentProps {
  target: ThreadDeleteDialogTarget;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (target: ThreadDeleteDialogTarget) => void;
}

export function ThreadDeleteDialogContent({
  target,
  pending,
  onOpenChange,
  onDelete,
}: ThreadDeleteDialogContentProps) {
  const { t } = useTranslation();
  const label = t("dialogs.common.entity.thread");
  const sentences = [
    target.childThreadCount
      ? t("dialogs.threadDelete.childWarning")
      : null,
    t("dialogs.threadDelete.cannotUndo"),
  ].filter((part): part is string => part !== null);

  return (
    <ConfirmDeleteDialogContent
      title={t("dialogs.threadDelete.title", { entity: label })}
      description={sentences.join(" ")}
      confirmLabel={t("dialogs.threadDelete.confirmLabel", { entity: label })}
      pending={pending}
      onConfirm={() => onDelete(target)}
      onCancel={() => onOpenChange(false)}
    />
  );
}
