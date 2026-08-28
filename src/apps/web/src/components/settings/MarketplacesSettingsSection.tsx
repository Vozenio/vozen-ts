import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import type { PluginMarketplace } from "@bb/server-contract";
import { Badge } from "@bb/shared-ui/badge";
import { Button } from "@bb/shared-ui/button";
import { Input } from "@bb/shared-ui/input";
import { SettingsSection } from "@/components/ui/settings-section";
import { appToast } from "@/components/ui/app-toast";
import {
  ConfirmDeleteDialog,
  ConfirmDeleteDialogContent,
} from "@/components/dialogs/ConfirmDeleteDialog";
import { pluginAdminErrorMessage } from "@/lib/plugin-admin-error";
import { invalidatePluginMarketplaces } from "@/hooks/cache-owners/plugin-cache-owner";
import {
  addPluginMarketplace,
  refreshPluginMarketplaces,
  removePluginMarketplace,
  usePluginMarketplaces,
} from "@/hooks/queries/plugin-catalog-queries";

const SOURCE_PLACEHOLDER = "https://example.com/marketplace.json";

function formatRefreshedAt(marketplace: PluginMarketplace): string {
  if (marketplace.lastError !== null) {
    return i18next.t(
      "settingsMisc.pluginMarketplaces.lastRefreshFailed",
      "Last refresh failed: {{error}}",
      { error: marketplace.lastError },
    );
  }
  if (marketplace.lastRefreshAt === null) {
    return i18next.t(
      "settingsMisc.pluginMarketplaces.neverRefreshed",
      "Never refreshed",
    );
  }
  return i18next.t(
    "settingsMisc.pluginMarketplaces.refreshedAt",
    "Refreshed {{date}}",
    { date: new Date(marketplace.lastRefreshAt).toLocaleString() },
  );
}

/**
 * Add and remove the marketplaces bb reads plugin catalogs from. Adding one
 * installs nothing and removing one uninstalls nothing: the server owns both
 * policies, and this page only calls the routes.
 */
export function MarketplacesSettingsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [source, setSource] = useState("");
  const [removing, setRemoving] = useState<PluginMarketplace | null>(null);
  const marketplacesQuery = usePluginMarketplaces({ enabled: true });
  const marketplaces = marketplacesQuery.data ?? [];

  const invalidate = () => invalidatePluginMarketplaces({ queryClient });

  const add = useMutation({
    mutationFn: (value: string) => addPluginMarketplace(fetch, value),
    onSuccess: (marketplace) => {
      setSource("");
      invalidate();
      appToast.success(
        t("settingsMisc.pluginMarketplaces.addedToast", "Added {{name}}", {
          name: marketplace.displayName,
        }),
        {
          description: t(
            "settingsMisc.pluginMarketplaces.addedToastDescription",
            "{{count}} plugins listed. Adding a marketplace installs nothing.",
            { count: marketplace.entryCount },
          ),
        },
      );
    },
    onError: (error) => {
      appToast.error(
        t(
          "settingsMisc.pluginMarketplaces.addFailedToast",
          "Adding the marketplace failed",
        ),
        {
          description: pluginAdminErrorMessage(error),
        },
      );
    },
  });

  const refresh = useMutation({
    mutationFn: (name: string) => refreshPluginMarketplaces(fetch, name),
    onSuccess: (results) => {
      invalidate();
      const failed = results.filter((result) => !result.ok);
      if (failed.length === 0) {
        appToast.success(
          t(
            "settingsMisc.pluginMarketplaces.refreshedToast",
            "Marketplace refreshed",
          ),
        );
        return;
      }
      appToast.error(
        t(
          "settingsMisc.pluginMarketplaces.refreshFailedToast",
          "Refreshing the marketplace failed",
        ),
        {
          description: t(
            "settingsMisc.pluginMarketplaces.refreshFailedToastDescription",
            "{{error}}. The last catalog vozen validated is still in use.",
            {
              error:
                failed[0]?.error ??
                t("settingsMisc.pluginMarketplaces.unknownError", "Unknown error"),
            },
          ),
        },
      );
    },
    onError: (error) => {
      appToast.error(
        t(
          "settingsMisc.pluginMarketplaces.refreshFailedToast",
          "Refreshing the marketplace failed",
        ),
        {
          description: pluginAdminErrorMessage(error),
        },
      );
    },
  });

  const remove = useMutation({
    mutationFn: (name: string) => removePluginMarketplace(fetch, name),
    onSuccess: (result) => {
      setRemoving(null);
      invalidate();
      appToast.success(
        t("settingsMisc.pluginMarketplaces.removedToast", "Marketplace removed"),
        {
          description:
            result.convertedPluginIds.length === 0
              ? undefined
              : t(
                  "settingsMisc.pluginMarketplaces.removedToastKeptDescription",
                  "Kept as direct installs: {{ids}}",
                  { ids: result.convertedPluginIds.join(", ") },
                ),
        },
      );
    },
    onError: (error) => {
      appToast.error(
        t(
          "settingsMisc.pluginMarketplaces.removeFailedToast",
          "Removing the marketplace failed",
        ),
        {
          description: pluginAdminErrorMessage(error),
        },
      );
    },
  });

  return (
    <SettingsSection
      title={t("settingsMisc.pluginMarketplaces.title", "Plugin marketplaces")}
      description={t(
        "settingsMisc.pluginMarketplaces.description",
        "vozen reads plugin catalogs from these marketplaces. Adding one validates and caches its catalog; it never installs, updates, or runs plugin code.",
      )}
    >
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <Input
            value={source}
            aria-label={t(
              "settingsMisc.pluginMarketplaces.sourceInputAriaLabel",
              "Marketplace source",
            )}
            placeholder={SOURCE_PLACEHOLDER}
            className="h-8 font-mono text-xs"
            onChange={(event) => setSource(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            disabled={source.trim().length === 0 || add.isPending}
            onClick={() => add.mutate(source.trim())}
          >
            {add.isPending
              ? t("settingsMisc.pluginMarketplaces.adding", "Adding…")
              : t("settingsMisc.pluginMarketplaces.add", "Add")}
          </Button>
        </div>
        <p className="text-2xs text-subtle-foreground">
          {t(
            "settingsMisc.pluginMarketplaces.sourceHintPrefix",
            "An https manifest URL, ",
          )}
          <code>git:&lt;url&gt;[@&lt;ref&gt;]</code>
          {t("settingsMisc.pluginMarketplaces.sourceHintMiddle", ", or ")}
          <code>path:&lt;directory&gt;</code>
          {t(
            "settingsMisc.pluginMarketplaces.sourceHintSuffix",
            " on the vozen server’s machine.",
          )}
        </p>
      </div>

      <ul className="space-y-2 pt-1">
        {marketplaces.map((marketplace) => (
          <li
            key={marketplace.name}
            className="flex items-start gap-3 rounded-md border border-border p-3"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex items-center gap-2 text-sm text-foreground">
                {marketplace.displayName}
                <span className="font-mono text-2xs text-subtle-foreground">
                  {marketplace.name}
                </span>
                {marketplace.official ? (
                  <Badge variant="outline" className="text-2xs font-normal">
                    {t("settingsMisc.pluginMarketplaces.officialBadge", "Official")}
                  </Badge>
                ) : null}
              </p>
              <p className="truncate font-mono text-2xs text-subtle-foreground">
                {marketplace.source}
              </p>
              <p className="text-2xs text-subtle-foreground">
                {t(
                  "settingsMisc.pluginMarketplaces.entryCount",
                  "{{count}} plugins",
                  { count: marketplace.entryCount },
                )}{" "}
                · {formatRefreshedAt(marketplace)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={refresh.isPending}
                aria-label={t(
                  "settingsMisc.pluginMarketplaces.refreshAriaLabel",
                  "Refresh {{name}}",
                  { name: marketplace.displayName },
                )}
                onClick={() => refresh.mutate(marketplace.name)}
              >
                {t("settingsMisc.pluginMarketplaces.refresh", "Refresh")}
              </Button>
              {marketplace.official ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t(
                    "settingsMisc.pluginMarketplaces.removeAriaLabel",
                    "Remove {{name}}",
                    { name: marketplace.displayName },
                  )}
                  onClick={() => setRemoving(marketplace)}
                >
                  {t("settingsMisc.pluginMarketplaces.remove", "Remove")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDeleteDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setRemoving(null);
        }}
      >
        <ConfirmDeleteDialogContent
          title={t(
            "settingsMisc.pluginMarketplaces.removeDialog.title",
            "Remove {{name}}?",
            {
              name:
                removing?.displayName ??
                t(
                  "settingsMisc.pluginMarketplaces.removeDialog.fallbackName",
                  "marketplace",
                ),
            },
          )}
          description={t(
            "settingsMisc.pluginMarketplaces.removeDialog.description",
            "Its catalog and cached icons are deleted. Plugins installed from it keep running as direct installs and keep checking for updates from their recorded source.",
          )}
          confirmLabel={
            remove.isPending
              ? t("settingsMisc.pluginMarketplaces.removing", "Removing…")
              : t("settingsMisc.pluginMarketplaces.remove", "Remove")
          }
          pending={remove.isPending}
          onConfirm={() => {
            if (removing !== null) remove.mutate(removing.name);
          }}
          onCancel={() => setRemoving(null)}
        />
      </ConfirmDeleteDialog>
    </SettingsSection>
  );
}
