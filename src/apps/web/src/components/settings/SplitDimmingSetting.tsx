import { Switch } from "@bb/shared-ui/switch";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { SettingsWithControl } from "@/components/ui/settings-section";
import { dimInactiveSplitsAtom } from "@/lib/split-layout/atoms";

export const SPLIT_DIMMING_SETTING_LABEL = "Fade inactive splits";

export function SplitDimmingSetting() {
  const { t } = useTranslation();
  const [dimsInactiveSplits, setDimsInactiveSplits] = useAtom(
    dimInactiveSplitsAtom,
  );
  const label = t(
    "settingsMisc.appearance.splitDimming.label",
    SPLIT_DIMMING_SETTING_LABEL,
  );

  return (
    <SettingsWithControl
      label={label}
      description={t(
        "settingsMisc.appearance.splitDimming.description",
        "Fade out splits that do not have focus.",
      )}
    >
      <Switch
        checked={dimsInactiveSplits}
        onCheckedChange={setDimsInactiveSplits}
        aria-label={label}
      />
    </SettingsWithControl>
  );
}
