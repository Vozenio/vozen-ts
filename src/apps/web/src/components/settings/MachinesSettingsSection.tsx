import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Host, PermissionMode } from "@bb/domain";
import { RETRY_ACTION_ICON } from "@bb/domain/update-state";
import type { HostPlatform } from "@bb/host-daemon-contract";
import { Button } from "@bb/shared-ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bb/shared-ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bb/shared-ui/dropdown-menu";
import { Icon } from "@bb/shared-ui/icon";
import { cn } from "@bb/shared-ui/lib/utils";
import { ResourceRowDetailChevron } from "@bb/shared-ui/resource-list";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@bb/shared-ui/tooltip";
import { AddMachineDialog } from "@/components/dialogs/AddMachineDialog";
import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog";
import { appToast } from "@/components/ui/app-toast";
import { MachineStatusDot } from "@/components/machines/MachineStatusDot";
import { MachineRenameDialog } from "@/components/settings/MachineRenameDialog";
import {
  SettingsBadge,
  SettingsRow,
  SettingsRowList,
  SettingsSection,
} from "@/components/ui/settings-section";
import {
  useRemoveHost,
  useRenameHost,
  useRetryHostUpdate,
} from "@/hooks/mutations/host-mutations";
import { useHosts } from "@/hooks/queries/host-queries";
import { useSidebarNavigation } from "@/hooks/queries/sidebar-navigation-query";
import { useSystemConfig } from "@/hooks/queries/system-queries";
import { useHostDaemon } from "@/hooks/useHostDaemon";
import { getSettingsMachineRoutePath } from "@/lib/route-paths";
import { PERMISSION_MODE_OPTIONS } from "@/lib/permission-mode-options";
import { getMutationErrorMessage } from "@/lib/mutation-errors";
import { formatRelativeTime } from "@/lib/relative-time";
import {
  formatHostUpdateStatus,
  hostCanRetryUpdate,
} from "@/lib/host-update-status";

const PERMISSION_MODE_PRESENTATION: Record<
  PermissionMode,
  (typeof PERMISSION_MODE_OPTIONS)[number]
> = Object.fromEntries(
  PERMISSION_MODE_OPTIONS.map((option) => [option.value, option]),
) as Record<PermissionMode, (typeof PERMISSION_MODE_OPTIONS)[number]>;

const MACHINE_MENU_ITEM_CLASS = "min-h-9 px-2.5 py-2";

const PLATFORM_LABELS: Record<HostPlatform, string | null> = {
  darwin: "macOS",
  linux: "Linux",
  wsl: "WSL",
  unknown: null,
};

interface MachineRowProps {
  host: Host;
  isPrimary: boolean;
  isThisMachine: boolean;
  showPrimaryBadge: boolean;
  platformLabel: string | null;
  projectCount: number;
  now: number;
  onRename: () => void;
  onRemove: () => void;
  onRetryUpdate: () => void;
  retryUpdatePending: boolean;
}

function MachineRow({
  host,
  isPrimary,
  isThisMachine,
  showPrimaryBadge,
  platformLabel,
  projectCount,
  now,
  onRename,
  onRemove,
  onRetryUpdate,
  retryUpdatePending,
}: MachineRowProps) {
  const { t } = useTranslation();
  const permission = PERMISSION_MODE_PRESENTATION[host.maxPermissionMode];
  const projectLabel =
    projectCount === 1
      ? t("settingsMisc.machines.oneProject", "{{count}} project", {
          count: projectCount,
        })
      : t("settingsMisc.machines.manyProjects", "{{count}} projects", {
          count: projectCount,
        });
  const connectionLabel =
    host.status === "connected"
      ? t("settingsMisc.machines.online", "Online")
      : host.lastSeenAt === null
        ? t("settingsMisc.machines.offline", "Offline")
        : t(
            "settingsMisc.machines.offlineLastSeen",
            "Offline · last seen {{relativeTime}}",
            {
              relativeTime: formatRelativeTime({
                timestamp: host.lastSeenAt,
                now,
              }),
            },
          );
  const updateStatus = formatHostUpdateStatus(host);
  const removeItem = (
    <DropdownMenuItem
      variant="destructive"
      aria-disabled={isPrimary || undefined}
      className={cn(
        MACHINE_MENU_ITEM_CLASS,
        isPrimary && "cursor-not-allowed focus:bg-transparent",
      )}
      onSelect={(event) => {
        if (isPrimary) {
          event.preventDefault();
          return;
        }
        onRemove();
      }}
    >
      <Icon name="Trash2" aria-hidden />
      <span className="min-w-0 truncate">
        {t("settingsMisc.machines.removeMachine", "Remove machine")}
      </span>
    </DropdownMenuItem>
  );

  return (
    <SettingsRow>
      <div
        data-machine-row
        className="group group/machine -mx-2 flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-state-hover focus-within:bg-state-hover"
      >
        <Link
          to={getSettingsMachineRoutePath(host.id)}
          aria-label={t("settingsMisc.machines.openMachineAriaLabel", "Open {{name}}", {
            name: host.name,
          })}
          className="flex min-w-0 flex-1 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 truncate text-sm font-medium text-foreground">
                {host.name}
              </span>
              {isThisMachine ? (
                <SettingsBadge>
                  {t("settingsMisc.machines.thisMachineBadge", "this machine")}
                </SettingsBadge>
              ) : null}
              {showPrimaryBadge ? (
                <SettingsBadge>
                  {t("settingsMisc.machines.primaryBadge", "primary")}
                </SettingsBadge>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-subtle-foreground/75">
              <span className="inline-flex shrink-0 items-center gap-1.5">
                <MachineStatusDot connected={host.status === "connected"} />
                {connectionLabel}
              </span>
              {platformLabel === null ? null : (
                <span className="truncate">{platformLabel}</span>
              )}
              <span className="shrink-0">{projectLabel}</span>
              <span
                className={cn(
                  "shrink-0",
                  permission.tone === "warning" && "text-warning-text",
                )}
              >
                {permission.label}
              </span>
              {updateStatus === null ? null : (
                <span className="min-w-0 text-warning-text">
                  {updateStatus}
                </span>
              )}
            </div>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <TooltipProvider delayDuration={250}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 data-[state=open]:bg-state-active data-[state=open]:text-foreground"
                  aria-label={t(
                    "settingsMisc.machines.actionsAriaLabel",
                    "{{name}} actions",
                    { name: host.name },
                  )}
                >
                  <Icon name="MoreHorizontal" className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-max min-w-0">
                <DropdownMenuItem
                  className={MACHINE_MENU_ITEM_CLASS}
                  onSelect={onRename}
                >
                  <Icon name="Edit" aria-hidden />
                  <span className="min-w-0 truncate">
                    {t("settingsMisc.machines.rename", "Rename")}
                  </span>
                </DropdownMenuItem>
                {hostCanRetryUpdate(host) ? (
                  <DropdownMenuItem
                    className={MACHINE_MENU_ITEM_CLASS}
                    disabled={retryUpdatePending}
                    onSelect={onRetryUpdate}
                  >
                    <Icon name={RETRY_ACTION_ICON} aria-hidden />
                    <span className="min-w-0 truncate">
                      {retryUpdatePending
                        ? t(
                            "settingsMisc.machines.retryingUpdate",
                            "Retrying update…",
                          )
                        : t("settingsMisc.machines.retryUpdate", "Retry update")}
                    </span>
                  </DropdownMenuItem>
                ) : null}
                {isPrimary ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{removeItem}</TooltipTrigger>
                    <TooltipContent side="left">
                      {t(
                        "settingsMisc.machines.primaryRemoveDisabledReason",
                        "vozen's primary machine can't be removed.",
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  removeItem
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
          <ResourceRowDetailChevron />
        </div>
      </div>
    </SettingsRow>
  );
}

/**
 * Settings → Machines (multi-machine plan §4.3, Mockup C): the live host
 * list with rename/remove management and the add-a-machine pairing flow.
 */
export function MachinesSettingsSection() {
  const { t } = useTranslation();
  const systemConfig = useSystemConfig();
  const hostsQuery = useHosts();
  const { localDaemonHostId, platform: localDaemonPlatform } = useHostDaemon();
  const sidebarNavigationQuery = useSidebarNavigation();
  const renameHost = useRenameHost();
  const removeHost = useRemoveHost();
  const retryHostUpdate = useRetryHostUpdate();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Host | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Host | null>(null);

  const hosts = hostsQuery.data;
  const serverPrimaryHostId = systemConfig.data?.primaryHostId ?? null;
  const projects = sidebarNavigationQuery.data?.projects;
  const projectCountByHostId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projects ?? []) {
      const hostIds = new Set(project.sources.map((source) => source.hostId));
      for (const hostId of hostIds) {
        counts.set(hostId, (counts.get(hostId) ?? 0) + 1);
      }
    }
    return counts;
  }, [projects]);

  const now = Date.now();
  const primaryHostPlatform = systemConfig.data?.primaryHostPlatform ?? null;
  const showMachineIdentityBadges = (hosts?.length ?? 0) > 1;

  return (
    <>
      <SettingsSection
        title={t("settingsMisc.machines.sectionTitle", "Machines")}
        description={t(
          "settingsMisc.machines.sectionDescription",
          "Computers that can run your tasks. Pair a machine to run projects and threads on it.",
        )}
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddDialogOpen(true)}
          >
            <Icon name="Plus" className="size-3.5" />
            {t("settingsMisc.machines.addMachine", "Add a machine")}
          </Button>
        }
      >
        {hosts === undefined ? (
          <p className="text-sm text-muted-foreground">
            {t("settingsMisc.machines.loading", "Loading…")}
          </p>
        ) : hosts.length === 0 ? (
          <p className="text-sm text-subtle-foreground">
            {t("settingsMisc.machines.noMachines", "No machines yet.")}
          </p>
        ) : (
          <SettingsRowList>
            {hosts.map((host) => (
              <MachineRow
                key={host.id}
                host={host}
                isPrimary={host.id === serverPrimaryHostId}
                isThisMachine={
                  showMachineIdentityBadges && host.id === localDaemonHostId
                }
                showPrimaryBadge={
                  showMachineIdentityBadges && host.id === serverPrimaryHostId
                }
                platformLabel={
                  host.id === localDaemonHostId && localDaemonPlatform !== null
                    ? PLATFORM_LABELS[localDaemonPlatform]
                    : host.id === serverPrimaryHostId &&
                        primaryHostPlatform !== null
                      ? PLATFORM_LABELS[primaryHostPlatform]
                      : null
                }
                projectCount={projectCountByHostId.get(host.id) ?? 0}
                now={now}
                onRename={() => {
                  renameHost.reset();
                  setRenameTarget(host);
                }}
                onRemove={() => {
                  removeHost.reset();
                  setRemoveTarget(host);
                }}
                onRetryUpdate={() =>
                  retryHostUpdate.mutate(host.id, {
                    onSuccess: () => {
                      appToast.success(
                        t(
                          "settingsMisc.machines.updateRetryRequestedToast",
                          "Update retry requested for {{name}}",
                          { name: host.name },
                        ),
                      );
                    },
                  })
                }
                retryUpdatePending={
                  retryHostUpdate.isPending &&
                  retryHostUpdate.variables === host.id
                }
              />
            ))}
          </SettingsRowList>
        )}
      </SettingsSection>

      <AddMachineDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        serverUrl={systemConfig.data?.serverUrl ?? null}
      />

      <MachineRenameDialog
        target={renameTarget}
        pending={renameHost.isPending}
        errorMessage={
          renameHost.isError
            ? getMutationErrorMessage({
                error: renameHost.error,
                fallbackMessage: t(
                  "settingsMisc.machines.renameFailedFallback",
                  "Couldn't rename the machine.",
                ),
              })
            : null
        }
        onOpenChange={(open) => {
          if (!open && !renameHost.isPending) setRenameTarget(null);
        }}
        onRename={(host, name) =>
          renameHost.mutate(
            { hostId: host.id, name },
            { onSuccess: () => setRenameTarget(null) },
          )
        }
      />

      <ConfirmDeleteDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removeHost.isPending) setRemoveTarget(null);
        }}
      >
        {removeTarget ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {t(
                  "settingsMisc.machines.removeDialog.title",
                  "Remove {{name}}?",
                  { name: removeTarget.name },
                )}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "settingsMisc.machines.removeDialog.description",
                  "This revokes {{name}}'s access to this server. Project checkouts stay on its disk, but its environments become read-only history and it can't run new work until it's paired again.",
                  { name: removeTarget.name },
                )}
              </DialogDescription>
            </DialogHeader>
            {removeHost.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {getMutationErrorMessage({
                  error: removeHost.error,
                  fallbackMessage: t(
                    "settingsMisc.machines.removeDialog.failedFallback",
                    "Couldn't remove {{name}}.",
                    { name: removeTarget.name },
                  ),
                })}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                disabled={removeHost.isPending}
                onClick={() =>
                  removeHost.mutate(removeTarget.id, {
                    onSuccess: () => setRemoveTarget(null),
                  })
                }
              >
                {t("settingsMisc.machines.removeDialog.submit", "Remove machine")}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </ConfirmDeleteDialog>
    </>
  );
}
