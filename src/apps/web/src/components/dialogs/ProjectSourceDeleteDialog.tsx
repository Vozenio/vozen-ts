import "@/lib/i18n/promptbox";
import { useTranslation } from "react-i18next";
import {
  ConfirmDeleteDialog,
  ConfirmDeleteDialogContent,
} from "./ConfirmDeleteDialog";

export interface ProjectSourceDeleteDialogTarget {
  id: string;
  label: string;
}

interface ProjectSourceDeleteDialogProps {
  target: ProjectSourceDeleteDialogTarget | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (sourceId: string) => void;
}

export function ProjectSourceDeleteDialog({
  target,
  pending,
  onOpenChange,
  onDelete,
}: ProjectSourceDeleteDialogProps) {
  return (
    <ConfirmDeleteDialog open={target !== null} onOpenChange={onOpenChange}>
      {target ? (
        <ProjectSourceDeleteDialogContent
          target={target}
          pending={pending}
          onDelete={onDelete}
        />
      ) : null}
    </ConfirmDeleteDialog>
  );
}

interface ProjectSourceDeleteDialogContentProps {
  target: ProjectSourceDeleteDialogTarget;
  pending: boolean;
  onDelete: (sourceId: string) => void;
}

export function ProjectSourceDeleteDialogContent({
  target,
  pending,
  onDelete,
}: ProjectSourceDeleteDialogContentProps) {
  const { t } = useTranslation();
  return (
    <ConfirmDeleteDialogContent
      title={t("dialogs.projectSourceDelete.title")}
      description={t("dialogs.projectSourceDelete.description", {
        label: target.label,
      })}
      confirmLabel={t("dialogs.projectSourceDelete.confirmLabel")}
      pending={pending}
      onConfirm={() => onDelete(target.id)}
    />
  );
}
