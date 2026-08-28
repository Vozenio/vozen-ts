import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { Host, PermissionMode } from "@bb/domain";
import type { HostPlatform } from "@bb/host-daemon-contract";
import { Button } from "@bb/shared-ui/button";
import { DialogFooter, DialogHeader, DialogTitle } from "@bb/shared-ui/dialog";
import { DialogDescription } from "@bb/shared-ui/dialog";
import { Icon } from "@bb/shared-ui/icon";
import { cn } from "@bb/shared-ui/lib/utils";
import { Pill } from "@bb/shared-ui/pill";
import { ResourceOverflowMenu } from "@bb/shared-ui/resource-list";
import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog";
import { MachineStatusDot } from "@/components/machines/MachineStatusDot";
import { PageShell } from "@/components/ui/page-shell.js";
import {
  SettingsBadge,
  SettingsRow,
  SettingsRowList,
  SettingsSection,
} from "@/components/ui/settings-section";
import { appToast } from "@/components/ui/app-toast";
import { MachineRenameDialog } from "@/components/settings/MachineRenameDialog";
import {
  useRemoveHost,
  useRenameHost,
  useRetryHostUpdate,
  useUpdateHostPermissionCeiling,
} from "@/hooks/mutations/host-mutations";
import { useHosts } from "@/hooks/queries/host-queries";
import { useSidebarNavigation } from "@/hooks/queries/sidebar-navigation-query";
import {
  useSystemConfig,
  useSystemProviders,
} from "@/hooks/queries/system-queries";
import { isProviderCliUpdateIssue } from "@/components/provider-cli/provider-cli-install";
import { useUpdateInventory } from "@/hooks/useUpdateInventory";
import { useHostDaemon } from "@/hooks/useHostDaemon";
import {
  formatHostUpdateStatus,
  hostCanRetryUpdate,
} from "@/lib/host-update-status";
import { getMutationErrorMessage } from "@/lib/mutation-errors";
import { PERMISSION_MODE_OPTIONS } from "@/lib/permission-mode-options";
import { formatRelativeTime } from "@/lib/relative-time";
import { ProviderIconMark } from "@/components/settings/ProviderIconMark";
import { getProviderIconInfo } from "@/lib/provider-icon";
import {
  getProjectSettingsRoutePath,
  getSettingsRoutePath,
} from "@/lib/route-paths";

const PLATFORM_LABELS: Record<HostPlatform, string | null> = {
  darwin: "macOS",
  linux: "Linux",
  wsl: "WSL",
  unknown: null,
};

interface MachineProject {
  id: string;
  name: string;
}

function headerMeta({
  host,
  platformLabel,
  now,
  t,
}: {
  host: Host;
  platformLabel: string | null;
  now: number;
  t: TFunction;
}): string {
  const parts: string[] = [
    host.status === "connected"
      ? t("views.machineSettings.status.online")
      : t("views.machineSettings.status.offline"),
  ];
  if (host.status !== "connected" && host.lastSeenAt !== null) {
    parts.push(
      t("views.machineSettings.status.lastSeen", {
        time: formatRelativeTime({ timestamp: host.lastSeenAt, now }),
      }),
    );
  }
  if (platformLabel !== null) parts.push(platformLabel);
  parts.push(
    t("views.machineSettings.status.paired", {
      time: formatRelativeTime({ timestamp: host.createdAt, now }),
    }),
  );
  return parts.join(" · ");
}

interface PermissionLimitCardProps {
  disabled: boolean;
  onSelect: (permissionMode: PermissionMode) => void;
  value: PermissionMode;
}

/** The page has room to explain each mode, so keep the choices visible. */
function PermissionLimitCards({
  disabled,
  onSelect,
  value,
}: PermissionLimitCardProps) {
  const { t } = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={t("views.machineSettings.permissionLimit.title")}
    >
      <SettingsRowList>
        {PERMISSION_MODE_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <SettingsRow key={option.value} className="items-start">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => {
                  if (!selected) onSelect(option.value);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  disabled && "opacity-70",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-foreground" : "border-input",
                  )}
                >
                  {selected ? (
                    <span className="size-2 rounded-full bg-foreground" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="mt-0.5 block text-xs leading-snug text-subtle-foreground/75">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            </SettingsRow>
          );
        })}
      </SettingsRowList>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  children: ReactNode;
}

function DetailRow({ label, children }: DetailRowProps) {
  return (
    <SettingsRow className="flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-foreground">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 text-left text-subtle-foreground sm:ml-auto sm:justify-end sm:text-right">
        {children}
      </div>
    </SettingsRow>
  );
}

export function MachineSettingsView() {
  const { t } = useTranslation();
  const { hostId } = useParams<{ hostId: string }>();
  const navigate = useNavigate();
  const hostsQuery = useHosts();
  const systemConfig = useSystemConfig();
  const { localDaemonHostId, platform: localDaemonPlatform } = useHostDaemon();
  const sidebarNavigationQuery = useSidebarNavigation();
  const updateInventory = useUpdateInventory();
  const renameHost = useRenameHost();
  const removeHost = useRemoveHost();
  const retryHostUpdate = useRetryHostUpdate();
  const updatePermissionCeiling = useUpdateHostPermissionCeiling();
  const [renameOpen, setRenameOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const hosts = hostsQuery.data;
  const host = hosts?.find((candidate) => candidate.id === hostId) ?? null;
  const primaryHostId = systemConfig.data?.primaryHostId ?? null;
  const isPrimary = host !== null && host.id === primaryHostId;
  const showMachineIdentityBadges = (hosts?.length ?? 0) > 1;
  const isThisMachine =
    showMachineIdentityBadges && host !== null && host.id === localDaemonHostId;

  const projects: MachineProject[] = useMemo(() => {
    const navigation = sidebarNavigationQuery.data?.projects ?? [];
    return navigation
      .filter((project) =>
        project.sources.some((source) => source.hostId === hostId),
      )
      .map((project) => ({ id: project.id, name: project.name }));
  }, [hostId, sidebarNavigationQuery.data]);

  const machine = updateInventory.machines.find(
    (candidate) => candidate.host.id === hostId,
  );
  // This links to Settings → Updates, so it must count what that page lists —
  // updates, not install prompts — or it sends the reader to a page that has
  // nothing matching the number they just clicked.
  const updateIssueCount = (machine?.issues ?? []).filter(
    isProviderCliUpdateIssue,
  ).length;
  const providerRoster = useSystemProviders().data;
  const installedProviders = useMemo(() => {
    const status = machine?.providerStatus;
    if (!status) return [];
    return Object.entries(status).flatMap(([providerId, entry]) => {
      if (!entry.installed) return [];
      const provider = providerRoster?.find(
        (candidate) => candidate.id === providerId,
      );
      return [
        {
          ...entry,
          providerId,
          provider,
          ProviderIcon: getProviderIconInfo(providerId, provider ?? null)?.icon,
        },
      ];
    });
  }, [machine?.providerStatus, providerRoster]);

  const now = Date.now();
  const platformLabel =
    host !== null &&
    host.id === localDaemonHostId &&
    localDaemonPlatform !== null
      ? PLATFORM_LABELS[localDaemonPlatform]
      : isPrimary && systemConfig.data?.primaryHostPlatform
        ? PLATFORM_LABELS[systemConfig.data.primaryHostPlatform]
        : null;

  if (hosts === undefined) {
    return (
      <PageShell contentClassName="pt-4 md:pt-5">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-sm text-muted-foreground">
            {t("views.machineSettings.loading")}
          </p>
        </div>
      </PageShell>
    );
  }

  if (host === null) {
    return (
      <PageShell contentClassName="pt-4 md:pt-5">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          <Link
            to={getSettingsRoutePath("machines")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronLeft" className="size-3.5" />
            {t("views.machineSettings.backToMachines")}
          </Link>
          <p className="text-sm text-muted-foreground">
            {t("views.machineSettings.notPaired")}
          </p>
        </div>
      </PageShell>
    );
  }

  const updateStatus = formatHostUpdateStatus(host);

  return (
    <PageShell contentClassName="pt-4 md:pt-5">
      <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
        <div className="space-y-3">
          <Link
            to={getSettingsRoutePath("machines")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronLeft" className="size-3.5" />
            {t("views.machineSettings.backToMachines")}
          </Link>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="min-w-0 truncate text-sm font-semibold text-foreground">
                  {host.name}
                </h1>
                {isThisMachine ? (
                  <SettingsBadge>
                    {t("views.machineSettings.badge.thisMachine")}
                  </SettingsBadge>
                ) : null}
                {showMachineIdentityBadges && isPrimary ? (
                  <SettingsBadge>
                    {t("views.machineSettings.badge.primary")}
                  </SettingsBadge>
                ) : null}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <MachineStatusDot connected={host.status === "connected"} />
                <p className="min-w-0 text-xs text-subtle-foreground/75">
                  {headerMeta({ host, platformLabel, now, t })}
                </p>
              </div>
            </div>
            <ResourceOverflowMenu
              label={t("views.machineSettings.actionsMenuLabel", {
                name: host.name,
              })}
              items={[
                {
                  label: t("views.machineSettings.actionsMenu.rename"),
                  icon: "Edit",
                  onSelect: () => {
                    renameHost.reset();
                    setRenameOpen(true);
                  },
                },
              ]}
            />
          </div>
        </div>

        <SettingsSection
          title={t("views.machineSettings.permissionLimit.title")}
          description={t("views.machineSettings.permissionLimit.description")}
        >
          <PermissionLimitCards
            value={host.maxPermissionMode}
            disabled={updatePermissionCeiling.isPending}
            onSelect={(maxPermissionMode) =>
              updatePermissionCeiling.mutate(
                { hostId: host.id, maxPermissionMode },
                {
                  onError: (error) => {
                    appToast.error(
                      getMutationErrorMessage({
                        error,
                        fallbackMessage: t(
                          "views.machineSettings.permissionLimitError",
                          { name: host.name },
                        ),
                      }),
                    );
                  },
                },
              )
            }
          />
        </SettingsSection>

        <SettingsSection title={t("views.machineSettings.providerClis.title")}>
          <SettingsRowList>
            <DetailRow
              label={t("views.machineSettings.providerClis.installedLabel")}
            >
              {host.status !== "connected" ? (
                <span>
                  {t("views.machineSettings.providerClis.unavailableOffline")}
                </span>
              ) : machine?.statusPending ? (
                <span>{t("views.machineSettings.providerClis.checking")}</span>
              ) : machine?.statusError ? (
                <span>
                  {t("views.machineSettings.providerClis.statusUnavailable")}
                </span>
              ) : (
                <>
                  {installedProviders.length > 0 ? (
                    <span className="flex min-w-0 flex-wrap items-center justify-start gap-x-3 gap-y-1 sm:justify-end">
                      {installedProviders.map((entry) => (
                        <span
                          key={entry.providerId}
                          className="inline-flex min-w-0 items-center gap-1.5"
                        >
                          {entry.ProviderIcon ? (
                            <span
                              data-provider-icon={entry.providerId}
                              aria-hidden
                            >
                              {entry.provider === undefined ? (
                                <entry.ProviderIcon className="size-3.5" />
                              ) : (
                                <ProviderIconMark
                                  provider={entry.provider}
                                  icon={entry.ProviderIcon}
                                  className="size-3.5"
                                />
                              )}
                            </span>
                          ) : null}
                          <span>{entry.displayName}</span>
                          {entry.currentVersion ? (
                            <span>{entry.currentVersion}</span>
                          ) : null}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span>
                      {t("views.machineSettings.providerClis.noneInstalled")}
                    </span>
                  )}
                  {updateIssueCount > 0 ? (
                    <Link
                      to={getSettingsRoutePath("updates")}
                      className="shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Pill
                        variant="outline"
                        size="sm"
                        className="border-attention/50 bg-surface-attention text-warning-text transition-colors hover:border-attention hover:text-foreground"
                      >
                        {t("views.machineSettings.providerClis.toFix", {
                          count: updateIssueCount,
                        })}
                      </Pill>
                    </Link>
                  ) : null}
                </>
              )}
            </DetailRow>
          </SettingsRowList>
        </SettingsSection>

        <SettingsSection title={t("views.machineSettings.machineInfo.title")}>
          <SettingsRowList>
            <DetailRow
              label={t("views.machineSettings.machineInfo.projectsLabel")}
            >
              {projects.length === 0 ? (
                <span>{t("views.machineSettings.machineInfo.none")}</span>
              ) : (
                <span className="min-w-0 truncate">
                  {projects.map((project, index) => (
                    <span key={project.id}>
                      {index > 0 ? " · " : ""}
                      <Link
                        to={getProjectSettingsRoutePath(project.id)}
                        className="hover:text-foreground"
                      >
                        {project.name}
                      </Link>
                    </span>
                  ))}
                </span>
              )}
            </DetailRow>
            <DetailRow
              label={t("views.machineSettings.machineInfo.updatesLabel")}
            >
              <span>
                {updateStatus ?? t("views.machineSettings.machineInfo.upToDate")}
              </span>
              {hostCanRetryUpdate(host) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={retryHostUpdate.isPending}
                  onClick={() =>
                    retryHostUpdate.mutate(host.id, {
                      onSuccess: () => {
                        appToast.success(
                          t("views.machineSettings.machineInfo.retryRequested", {
                            name: host.name,
                          }),
                        );
                      },
                    })
                  }
                >
                  {retryHostUpdate.isPending
                    ? t("views.machineSettings.machineInfo.retrying")
                    : t("views.machineSettings.machineInfo.retryUpdate")}
                </Button>
              ) : null}
            </DetailRow>
          </SettingsRowList>
        </SettingsSection>

        <SettingsSection
          title={t("views.machineSettings.dangerZone.title")}
          description={
            isPrimary
              ? t("views.machineSettings.primaryRemoveDisabledReason")
              : t("views.machineSettings.dangerZone.description", {
                  name: host.name,
                })
          }
        >
          <SettingsRowList>
            <SettingsRow>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isPrimary}
                onClick={() => {
                  removeHost.reset();
                  setRemoveOpen(true);
                }}
              >
                {t("views.machineSettings.dangerZone.removeMachine")}
              </Button>
            </SettingsRow>
          </SettingsRowList>
        </SettingsSection>
      </div>

      <MachineRenameDialog
        target={renameOpen ? host : null}
        pending={renameHost.isPending}
        errorMessage={
          renameHost.isError
            ? getMutationErrorMessage({
                error: renameHost.error,
                fallbackMessage: t("views.machineSettings.renameError"),
              })
            : null
        }
        onOpenChange={(open) => {
          if (!open && !renameHost.isPending) setRenameOpen(false);
        }}
        onRename={(target, name) =>
          renameHost.mutate(
            { hostId: target.id, name },
            { onSuccess: () => setRenameOpen(false) },
          )
        }
      />

      <ConfirmDeleteDialog
        open={removeOpen}
        onOpenChange={(open) => {
          if (!open && !removeHost.isPending) setRemoveOpen(false);
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {t("views.machineSettings.removeDialog.title", {
              name: host.name,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("views.machineSettings.removeDialog.description", {
              name: host.name,
            })}
          </DialogDescription>
        </DialogHeader>
        {removeHost.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {getMutationErrorMessage({
              error: removeHost.error,
              fallbackMessage: t("views.machineSettings.removeError", {
                name: host.name,
              }),
            })}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            disabled={removeHost.isPending}
            onClick={() =>
              removeHost.mutate(host.id, {
                onSuccess: () => {
                  setRemoveOpen(false);
                  navigate(getSettingsRoutePath("machines"));
                },
              })
            }
          >
            {t("views.machineSettings.dangerZone.removeMachine")}
          </Button>
        </DialogFooter>
      </ConfirmDeleteDialog>
    </PageShell>
  );
}
