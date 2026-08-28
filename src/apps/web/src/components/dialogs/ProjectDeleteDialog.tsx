import "@/lib/i18n/promptbox";
import { useTranslation } from "react-i18next";
import {
  ConfirmDeleteDialog,
  ConfirmDeleteDialogContent,
} from "./ConfirmDeleteDialog";

export interface ProjectDeleteDialogTarget {
  id: string;
  name: string;
}

interface ProjectDeleteDialogProps {
  target: ProjectDeleteDialogTarget | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (projectId: string) => void;
}

export function ProjectDeleteDialog({
  target,
  pending,
  onOpenChange,
  onDelete,
}: ProjectDeleteDialogProps) {
  return (
    <ConfirmDeleteDialog open={target !== null} onOpenChange={onOpenChange}>
      {target ? (
        <ProjectDeleteDialogContent
          target={target}
          pending={pending}
          onDelete={onDelete}
        />
      ) : null}
    </ConfirmDeleteDialog>
  );
}

interface ProjectDeleteDialogContentProps {
  target: ProjectDeleteDialogTarget;
  pending: boolean;
  onDelete: (projectId: string) => void;
}

export function ProjectDeleteDialogContent({
  target,
  pending,
  onDelete,
}: ProjectDeleteDialogContentProps) {
  const { t } = useTranslation();
  return (
    <ConfirmDeleteDialogContent
      title={t("dialogs.projectDelete.title")}
      description={t("dialogs.projectDelete.description", {
        name: target.name,
      })}
      confirmLabel={t("dialogs.projectDelete.confirmLabel")}
      pending={pending}
      onConfirm={() => onDelete(target.id)}
    />
  );
}
