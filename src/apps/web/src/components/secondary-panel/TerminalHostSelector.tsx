import { useMemo } from "react";
import type { Host } from "@bb/domain";
import { OptionDisplay } from "@bb/shared-ui/option-display";
import { useTranslation } from "react-i18next";
import {
  OptionPicker,
  type PickerOption,
} from "@/components/pickers/OptionPicker";

interface ResolveTerminalHostArgs {
  hosts: readonly Host[];
  preferredHostId: string | null;
  primaryHostId: string | null;
}

interface TerminalHostSelectorProps {
  disabled: boolean;
  hosts: readonly Host[];
  isLoading: boolean;
  onChange: (hostId: string) => void;
  selectedHostId: string | null;
}

const CONTROL_CLASS_NAME = "h-6 max-w-40 px-1.5 text-xs";

export function resolveTerminalHost({
  hosts,
  preferredHostId,
  primaryHostId,
}: ResolveTerminalHostArgs): Host | null {
  const preferredHost =
    hosts.find((host) => host.id === preferredHostId) ?? null;
  if (preferredHost?.status === "connected") {
    return preferredHost;
  }

  const primaryHost = hosts.find((host) => host.id === primaryHostId) ?? null;
  if (primaryHost?.status === "connected") {
    return primaryHost;
  }

  return (
    hosts.find((host) => host.status === "connected") ??
    preferredHost ??
    primaryHost ??
    hosts[0] ??
    null
  );
}

export function TerminalHostSelector({
  disabled,
  hosts,
  isLoading,
  onChange,
  selectedHostId,
}: TerminalHostSelectorProps) {
  const { t } = useTranslation();
  const options = useMemo<readonly PickerOption<string>[]>(
    () =>
      hosts.map((host) => ({
        value: host.id,
        label: host.name,
        ...(host.status === "connected"
          ? {}
          : {
              disabled: true,
              disabledReason: t(
                "secondaryPanel.terminalHostSelector.offline",
                "Offline",
              ),
            }),
      })),
    [hosts, t],
  );

  if (isLoading) {
    return (
      <OptionDisplay
        label={t("secondaryPanel.terminalHostSelector.machine", "Machine")}
        value={t("secondaryPanel.terminalHostSelector.loading", "Loading…")}
        muted
        className={CONTROL_CLASS_NAME}
      />
    );
  }

  if (hosts.length === 0) {
    return (
      <OptionDisplay
        label={t("secondaryPanel.terminalHostSelector.machine", "Machine")}
        value={t(
          "secondaryPanel.terminalHostSelector.noMachines",
          "No machines",
        )}
        muted
        className={CONTROL_CLASS_NAME}
      />
    );
  }

  const selectedHost =
    hosts.find((host) => host.id === selectedHostId) ?? hosts[0];
  if (selectedHost === undefined) {
    return null;
  }
  if (hosts.length === 1) {
    return (
      <OptionDisplay
        label={t("secondaryPanel.terminalHostSelector.machine", "Machine")}
        value={selectedHost.name}
        muted
        className={CONTROL_CLASS_NAME}
      />
    );
  }

  return (
    <OptionPicker
      align="end"
      label={t("secondaryPanel.terminalHostSelector.machine", "Machine")}
      value={selectedHost.id}
      options={options}
      onChange={onChange}
      disabled={disabled}
      muted
      className={CONTROL_CLASS_NAME}
      contentClassName="max-w-72"
    />
  );
}
