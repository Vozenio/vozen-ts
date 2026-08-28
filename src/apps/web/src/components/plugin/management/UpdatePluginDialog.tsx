import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UPDATE_ACTION_ICON } from "@bb/domain/update-state";
import { Button } from "@bb/shared-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bb/shared-ui/dialog";
import { Icon } from "@bb/shared-ui/icon";
import { appToast } from "@/components/ui/app-toast.js";
import { pluginAdminErrorMessage } from "@/lib/plugin-admin-error";
import { invalidatePluginList } from "@/hooks/cache-owners/plugin-cache-owner";
import {
  applyPluginUpdate,
  type PluginUpdateResult,
} from "@/hooks/queries/plugin-catalog-queries";
import type { PluginListItem } from "@/hooks/queries/plugin-settings-queries";
import {
  DetailsDisclosure,
  displayPluginVersion,
  formatAbsoluteDate,
  KeyValueGrid,
  RollbackNote,
  SUCCESS_TEXT_STYLE,
} from "./plugin-ui";

interface UpdatePluginDialogProps {
  plugin: PluginListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Layer 3 update confirmation (sketch v2, dialogs C): verdict first, checks
 * collapsed, rollback promise always visible. The incompatible variant
 * arrives with details pre-expanded and Update disabled — the details are
 * the story. Persisted and in-session rolled-back outcomes render in place
 * with their recovery action instead of being reduced to tooltip history.
 */
export function UpdatePluginDialog({
  plugin,
  open,
  onOpenChange,
}: UpdatePluginDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <UpdatePluginDialogContent
            plugin={plugin}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function UpdatePluginDialogContent({
  plugin,
  onOpenChange,
}: {
  plugin: PluginListItem;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const name = plugin.name ?? plugin.id;
  const state = plugin.updateState;
  const [rolledBack, setRolledBack] = useState<PluginUpdateResult | null>(null);

  const update = useMutation({
    mutationFn: () => applyPluginUpdate(fetch, plugin.id),
    onSuccess: (result) => {
      invalidatePluginList({ queryClient });
      if (result.outcome === "rolled-back") {
        setRolledBack(result);
        return;
      }
      if (result.applied) {
        appToast.success(
          t(
            "plugin.management.updatePluginDialog.toastUpdated",
            "{{name}} updated",
            { name },
          ),
          {
            description:
              result.to !== null
                ? t(
                    "plugin.management.updatePluginDialog.toastNowRunning",
                    "Now running {{version}}.",
                    { version: displayPluginVersion(result.to.display) },
                  )
                : undefined,
          },
        );
      } else {
        appToast.message(
          t(
            "plugin.management.updatePluginDialog.toastAlreadyUpToDate",
            "{{name}} is already up to date",
            { name },
          ),
        );
      }
      onOpenChange(false);
    },
    onError: (error) => {
      appToast.error(
        t(
          "plugin.management.updatePluginDialog.toastUpdateFailed",
          "Updating {{name}} failed",
          { name },
        ),
        {
          description: pluginAdminErrorMessage(error),
        },
      );
    },
  });

  const fromLine = t(
    "plugin.management.updatePluginDialog.currentlyLine",
    "Currently {{version}}",
    { version: displayPluginVersion(plugin.version) },
  );
  const persistedFailure = state.lastFailure;
  const failure =
    rolledBack !== null
      ? {
          version:
            rolledBack.to?.display ??
            state.availableVersion ??
            "The new version",
          at: null,
          detail: rolledBack.detail ?? "",
        }
      : persistedFailure === null
        ? null
        : persistedFailure;

  if (failure !== null) {
    const retryVersion = state.availableVersion;
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {t(
              "plugin.management.updatePluginDialog.failed.title",
              "Update failed",
            )}
          </DialogTitle>
          <DialogDescription>
            {failure.at === null
              ? t(
                  "plugin.management.updatePluginDialog.failed.descriptionIncomplete",
                  "The update couldn’t be completed.",
                )
              : t(
                  "plugin.management.updatePluginDialog.failed.descriptionFailedOn",
                  "Failed on {{date}}.",
                  { date: formatAbsoluteDate(failure.at) },
                )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <Icon
              name="CircleX"
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden
            />
            <span>
              {t(
                "plugin.management.updatePluginDialog.failed.couldNotActivate",
                "vozen couldn’t activate {{failedVersion}}. It restored {{currentVersion}} and its data.",
                {
                  failedVersion: displayPluginVersion(failure.version),
                  currentVersion: displayPluginVersion(plugin.version),
                },
              )}
            </span>
          </div>
          {failure.detail.length > 0 ? (
            <DetailsDisclosure
              key="failure-details"
              summary={t(
                "plugin.management.updatePluginDialog.failed.technicalDetailsSummary",
                "Technical details",
              )}
              defaultExpanded
            >
              <p className="break-words font-mono text-foreground">
                {failure.detail}
              </p>
            </DetailsDisclosure>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {retryVersion === null
              ? t(
                  "plugin.management.updatePluginDialog.failed.retryHintNoVersion",
                  "The restored version can keep running. Try again when a compatible update becomes available.",
                )
              : t(
                  "plugin.management.updatePluginDialog.failed.retryHintWithVersion",
                  "A compatible update to {{version}} is still available. Retry when you’re ready.",
                  { version: displayPluginVersion(retryVersion) },
                )}
          </p>
          {rolledBack === null ? null : (
            <p className="text-xs text-subtle-foreground">
              {t(
                "plugin.management.updatePluginDialog.failed.markedNote",
                "The plugin is marked “Update failed” in the installed list until an update succeeds.",
              )}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("plugin.management.updatePluginDialog.closeButton", "Close")}
          </Button>
          {retryVersion === null ? null : (
            <Button
              type="button"
              disabled={update.isPending}
              aria-busy={update.isPending}
              aria-label={t(
                "plugin.management.updatePluginDialog.failed.retryButtonAriaLabel",
                "Retry update to {{version}}",
                { version: retryVersion },
              )}
              onClick={() => update.mutate()}
            >
              {update.isPending ? (
                <Icon name="Spinner" className="animate-spin" />
              ) : null}
              {t(
                "plugin.management.updatePluginDialog.failed.retryButtonLabel",
                "Retry update",
              )}
            </Button>
          )}
        </DialogFooter>
      </>
    );
  }

  if (state.availableVersion !== null) {
    const candidate = state.availableVersion;
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {/* Hashes shorten here; the details grid keeps the full value. */}
            {t(
              "plugin.management.updatePluginDialog.available.title",
              "Update {{name}} to {{version}}?",
              { name, version: displayPluginVersion(candidate) },
            )}
          </DialogTitle>
          <DialogDescription>{fromLine}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium" style={SUCCESS_TEXT_STYLE}>
              ✓
            </span>
            <span>
              {t(
                "plugin.management.updatePluginDialog.available.compatibleLine",
                "Compatible with your vozen and plugin SDK",
              )}
            </span>
          </div>
          <DetailsDisclosure
            summary={t(
              "plugin.management.updatePluginDialog.available.detailsSummary",
              "Details — source, versions",
            )}
          >
            <KeyValueGrid
              entries={[
                {
                  key: t(
                    "plugin.management.updatePluginDialog.available.sourceLabel",
                    "Source",
                  ),
                  value: plugin.sourceDisplay,
                },
                {
                  key: t(
                    "plugin.management.updatePluginDialog.available.currentLabel",
                    "Current",
                  ),
                  value: plugin.version,
                },
                {
                  key: t(
                    "plugin.management.updatePluginDialog.available.candidateLabel",
                    "Candidate",
                  ),
                  value: candidate,
                },
              ]}
            />
          </DetailsDisclosure>
          <RollbackNote
            fromVersion={displayPluginVersion(plugin.version)}
            toVersion={displayPluginVersion(candidate)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={update.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t(
              "plugin.management.updatePluginDialog.available.notNowButton",
              "Not now",
            )}
          </Button>
          <Button
            type="button"
            disabled={update.isPending}
            aria-busy={update.isPending}
            onClick={() => update.mutate()}
          >
            {update.isPending ? (
              <Icon name="Spinner" className="animate-spin" />
            ) : (
              <Icon name={UPDATE_ACTION_ICON} aria-hidden />
            )}
            {t("plugin.management.updatePluginDialog.updateButton", "Update")}
          </Button>
        </DialogFooter>
      </>
    );
  }

  if (state.blockedVersion !== null) {
    const blocked = state.blockedVersion;
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {t(
              "plugin.management.updatePluginDialog.blocked.title",
              "Update {{name}} to {{version}}?",
              { name, version: displayPluginVersion(blocked) },
            )}
          </DialogTitle>
          <DialogDescription>{fromLine}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Icon
              name="AlertTriangle"
              className="size-4 shrink-0 text-warning"
              aria-hidden
            />
            <span>
              {t(
                "plugin.management.updatePluginDialog.blocked.notCompatible",
                "{{version}} isn’t compatible with this vozen",
                { version: displayPluginVersion(blocked) },
              )}
            </span>
          </div>
          {/* Failure case: the details ARE the story, so they arrive open. */}
          <DetailsDisclosure
            summary={t(
              "plugin.management.updatePluginDialog.blocked.detailsSummary",
              "Details",
            )}
            defaultExpanded
          >
            <div className="space-y-1.5">
              {state.blockedReasons.length > 0 ? (
                <ul className="space-y-1">
                  {state.blockedReasons.map((reason) => (
                    <li key={reason} className="text-foreground">
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              <KeyValueGrid
                entries={[
                  {
                    key: t(
                      "plugin.management.updatePluginDialog.blocked.newestCompatibleLabel",
                      "Newest compatible",
                    ),
                    value: t(
                      "plugin.management.updatePluginDialog.blocked.newestCompatibleValue",
                      "{{version}} — already installed",
                      { version: plugin.version },
                    ),
                  },
                ]}
              />
            </div>
          </DetailsDisclosure>
          <p className="text-xs text-subtle-foreground">
            {t(
              "plugin.management.updatePluginDialog.blocked.keepUsingNote",
              "Keep using {{version}} and check again when a compatible plugin version is available.",
              { version: plugin.version },
            )}
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("plugin.management.updatePluginDialog.closeButton", "Close")}
          </Button>
          <Button type="button" disabled>
            <Icon name={UPDATE_ACTION_ICON} aria-hidden />
            {t("plugin.management.updatePluginDialog.updateButton", "Update")}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t(
            "plugin.management.updatePluginDialog.upToDate.title",
            "{{name}} is up to date",
            { name },
          )}
        </DialogTitle>
        <DialogDescription>{fromLine}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          {t("plugin.management.updatePluginDialog.closeButton", "Close")}
        </Button>
      </DialogFooter>
    </>
  );
}
