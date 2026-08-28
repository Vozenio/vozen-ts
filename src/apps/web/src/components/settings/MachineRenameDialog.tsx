import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Host } from "@bb/domain";
import { Button } from "@bb/shared-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bb/shared-ui/dialog";
import { Input } from "@bb/shared-ui/input";
import { useRenameDialogAutoFocus } from "@/components/dialogs/useRenameDialogAutoFocus.js";

/** Server-side limit from `updateHostRequestSchema`. */
const HOST_NAME_MAX_LENGTH = 100;

interface MachineRenameDialogProps {
  target: Host | null;
  pending: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onRename: (host: Host, name: string) => void;
}

export function MachineRenameDialog({
  target,
  pending,
  errorMessage,
  onOpenChange,
  onRename,
}: MachineRenameDialogProps) {
  const { inputRef, handleOpenAutoFocus } = useRenameDialogAutoFocus();
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={handleOpenAutoFocus}>
        {target ? (
          <MachineRenameDialogContent
            key={target.id}
            target={target}
            pending={pending}
            errorMessage={errorMessage}
            onRename={onRename}
            inputRef={inputRef}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MachineRenameDialogContent({
  target,
  pending,
  errorMessage,
  onRename,
  inputRef,
}: {
  target: Host;
  pending: boolean;
  errorMessage: string | null;
  onRename: (host: Host, name: string) => void;
  inputRef: ReturnType<typeof useRenameDialogAutoFocus>["inputRef"];
}) {
  const { t } = useTranslation();
  const [nextName, setNextName] = useState(target.name);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const trimmed = nextName.trim();
    if (trimmed.length === 0) return;
    onRename(target, trimmed);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t("settingsMisc.machines.renameDialog.title", "Rename machine")}
        </DialogTitle>
        <DialogDescription>
          {t(
            "settingsMisc.machines.renameDialog.description",
            "Choose a new name for {{name}}.",
            { name: target.name },
          )}
        </DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Input
            ref={inputRef}
            aria-label={t(
              "settingsMisc.machines.renameDialog.inputAriaLabel",
              "Machine name",
            )}
            value={nextName}
            maxLength={HOST_NAME_MAX_LENGTH}
            autoCorrect="off"
            spellCheck={false}
            disabled={pending}
            onChange={(event) => setNextName(event.target.value)}
          />
          {errorMessage !== null ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="submit"
            disabled={pending || nextName.trim().length === 0}
          >
            {t("settingsMisc.machines.renameDialog.submit", "Rename machine")}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
