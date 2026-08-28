import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UPDATE_ACTION_ICON } from "@bb/domain/update-state";
import { Button } from "@bb/shared-ui/button";
import { Icon } from "@bb/shared-ui/icon";
import { appToast } from "@/components/ui/app-toast";
import { invalidatePluginList } from "@/hooks/cache-owners/plugin-cache-owner";
import { applyPluginUpdate } from "@/hooks/queries/plugin-catalog-queries";
import type { PluginListItem } from "@/hooks/queries/plugin-settings-queries";
import { pluginAdminErrorMessage } from "@/lib/plugin-admin-error";
import { DetailsDisclosure, displayPluginVersion } from "./plugin-ui";
import { UpdatePluginDialog } from "./UpdatePluginDialog";

/**
 * Whether a plugin has any update surfaces at all.
 *
 * Bundled plugins — auto builtins and store-installed officials alike — are
 * pinned to the copy shipped inside the app and update with bb releases, so
 * none of these surfaces render for them.
 */
export function pluginHasUpdateSurfaces(plugin: PluginListItem): boolean {
  if (plugin.source.startsWith("builtin:")) return false;
  return plugin.provenance === "direct" || plugin.provenance === "catalog";
}

/** The newest release that exists but cannot run on this bb version. */
function pluginCompatibilityBlockedVersion(
  plugin: PluginListItem,
): string | null {
  if (!pluginHasUpdateSurfaces(plugin)) return null;
  return plugin.updateState.availableVersion === null
    ? plugin.updateState.blockedVersion
    : null;
}

function sentence(value: string): string {
  const trimmed = value.trim();
  const capitalized = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  return /[.!?]$/u.test(capitalized) ? capitalized : `${capitalized}.`;
}

/**
 * Release action for the plugin detail section header.
 *
 * Updates describe the installed artifact, not the plugin's current ability
 * to operate. Keeping them in the Release section prevents routine update
 * availability and historical rollbacks from competing with activation or
 * present-tense health banners.
 */
export function PluginDetailReleaseControl({
  plugin,
}: {
  plugin: PluginListItem;
}) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const queryClient = useQueryClient();
  const name = plugin.name ?? plugin.id;
  const availableVersion = plugin.updateState.availableVersion;
  const failure = plugin.updateState.lastFailure;
  const retry = useMutation({
    mutationFn: () => applyPluginUpdate(fetch, plugin.id),
    onSuccess: (result) => {
      invalidatePluginList({ queryClient });
      if (result.outcome === "rolled-back") {
        appToast.error(
          t(
            "plugin.management.updatesCard.toastUpdateFailed",
            "Updating {{name}} failed",
            { name },
          ),
          {
            description:
              result.detail ??
              t(
                "plugin.management.updatesCard.toastRestoredDescription",
                "{{version}} was restored.",
                { version: displayPluginVersion(plugin.version) },
              ),
          },
        );
      } else if (result.applied) {
        appToast.success(
          t(
            "plugin.management.updatesCard.toastUpdated",
            "{{name}} updated",
            { name },
          ),
          {
            description:
              result.to === null
                ? undefined
                : t(
                    "plugin.management.updatesCard.toastNowRunning",
                    "Now running {{version}}.",
                    { version: displayPluginVersion(result.to.display) },
                  ),
          },
        );
      } else {
        appToast.message(
          t(
            "plugin.management.updatesCard.toastAlreadyUpToDate",
            "{{name}} is already up to date",
            { name },
          ),
        );
      }
    },
    onError: (error) => {
      appToast.error(
        t(
          "plugin.management.updatesCard.toastUpdateFailed",
          "Updating {{name}} failed",
          { name },
        ),
        {
          description: pluginAdminErrorMessage(error),
        },
      );
    },
  });

  if (!pluginHasUpdateSurfaces(plugin)) return null;
  if (availableVersion === null) return null;

  if (failure !== null) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 px-2 text-xs"
        disabled={retry.isPending}
        aria-busy={retry.isPending}
        aria-label={t(
          "plugin.management.updatesCard.retryButtonAriaLabel",
          "Retry update to {{version}}",
          { version: displayPluginVersion(availableVersion) },
        )}
        onClick={() => retry.mutate()}
      >
        {retry.isPending ? (
          <Icon name="Spinner" className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Icon name="RotateCcw" className="size-3.5" aria-hidden />
        )}
        {t("plugin.management.updatesCard.retryButtonLabel", "Retry")}
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 px-2 text-xs"
        aria-label={t(
          "plugin.management.updatesCard.updateButtonAriaLabel",
          "Update {{name}} to {{version}}",
          {
            name: plugin.name ?? plugin.id,
            version: displayPluginVersion(availableVersion),
          },
        )}
        onClick={() => setDetailsOpen(true)}
      >
        <Icon name={UPDATE_ACTION_ICON} className="size-3.5" aria-hidden />
        {t("plugin.management.updatesCard.updateButtonLabel", "Update")}
      </Button>
      <UpdatePluginDialog
        plugin={plugin}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </>
  );
}

/** Passive update context shown in the Release table. */
export function PluginDetailReleaseStatus({
  plugin,
}: {
  plugin: PluginListItem;
}) {
  const { t } = useTranslation();
  const failure = plugin.updateState.lastFailure;
  const blockedVersion = pluginCompatibilityBlockedVersion(plugin);
  const blockedReasons = plugin.updateState.blockedReasons;

  if (!pluginHasUpdateSurfaces(plugin)) return null;

  if (failure !== null) {
    return (
      <div
        role="status"
        aria-label={t(
          "plugin.management.updatesCard.status.updateFailedAriaLabel",
          "Update failed",
        )}
        className="flex min-w-0 items-start gap-2.5"
      >
        <Icon
          name="CircleX"
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden
        />
        <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
          {t(
            "plugin.management.updatesCard.status.couldNotActivate",
            "vozen couldn’t activate {{failedVersion}}. It restored {{currentVersion}} and its data.",
            {
              failedVersion: displayPluginVersion(failure.version),
              currentVersion: displayPluginVersion(plugin.version),
            },
          )}
        </p>
      </div>
    );
  }

  if (
    plugin.updateState.outcome === "unavailable" &&
    plugin.updateState.detail !== null
  ) {
    return (
      <div
        role="status"
        aria-label={t(
          "plugin.management.updatesCard.status.needsAttentionAriaLabel",
          "Update needs attention",
        )}
        className="flex min-w-0 items-start gap-2.5"
      >
        <Icon
          name="AlertTriangle"
          className="mt-0.5 size-4 shrink-0 text-warning"
          aria-hidden
        />
        <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
          {plugin.updateState.detail}
        </p>
      </div>
    );
  }

  if (plugin.updateState.availableVersion !== null) {
    return (
      <div role="status" className="flex min-w-0 items-baseline gap-2">
        <span className="font-mono text-xs text-foreground">
          {displayPluginVersion(plugin.updateState.availableVersion)}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("plugin.management.updatesCard.status.availableLabel", "Available")}
        </span>
      </div>
    );
  }

  if (blockedVersion === null) return null;
  return (
    <div
      role="status"
      aria-label={t(
        "plugin.management.updatesCard.status.blockedAriaLabel",
        "Update blocked",
      )}
      className="flex min-w-0 items-start gap-2.5"
    >
      <Icon
        name="AlertTriangle"
        className="mt-0.5 size-4 shrink-0 text-warning"
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {blockedReasons[0] === undefined
            ? t(
                "plugin.management.updatesCard.status.notCompatible",
                "{{version}} isn’t compatible with this vozen.",
                { version: displayPluginVersion(blockedVersion) },
              )
            : sentence(blockedReasons[0])}{" "}
          {t(
            "plugin.management.updatesCard.status.remainsInstalled",
            "{{version}} remains installed. Keep using it and check again when a compatible plugin version is available.",
            { version: displayPluginVersion(plugin.version) },
          )}
        </p>
        {blockedReasons.length > 1 ? (
          <div className="mt-1.5">
            <DetailsDisclosure
              summary={t(
                "plugin.management.updatesCard.status.otherRequirementsSummary",
                "Other requirements",
              )}
            >
              <ul className="space-y-1 text-foreground">
                {blockedReasons.slice(1).map((reason) => (
                  <li key={reason}>{sentence(reason)}</li>
                ))}
              </ul>
            </DetailsDisclosure>
          </div>
        ) : null}
      </div>
    </div>
  );
}
