import { useAtom, type PrimitiveAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { Icon } from "@bb/shared-ui/icon";
import { cn } from "@bb/shared-ui/lib/utils";
import { COARSE_POINTER_ICON_SIZE_CLASS } from "@bb/shared-ui/coarse-pointer-sizing";
import { Button } from "@bb/shared-ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bb/shared-ui/dropdown-menu";
import { SettingsWithControl } from "@/components/ui/settings-section";
import {
  diffRendererProviderAtom,
  sourceCodeRendererProviderAtom,
} from "@/components/code/codeRendererProvider";
import {
  AUTOMATIC_REPLACEMENT_PROVIDER,
  BUILT_IN_REPLACEMENT_PROVIDER,
  replacementProviderKey,
} from "@/lib/plugin-replacement-preference";
import { usePluginSlots } from "@/lib/plugin-slots";

interface CodeRendererProviderSlot {
  pluginId: string;
  id: string;
  title: string;
  description?: string;
}

interface CodeRendererSettingProps {
  label: string;
  description: string;
  builtInDescription: string;
  preferenceAtom: PrimitiveAtom<string>;
  slots: readonly CodeRendererProviderSlot[];
}

/**
 * The per-client pin for one code renderer, mirroring the sidebar thread list
 * control. A renderer takes over surfaces the user has no other way back
 * from — the file preview, every diff — so pinning has to be reachable
 * without uninstalling the plugin that supplied it.
 */
function CodeRendererSetting({
  label,
  description,
  builtInDescription,
  preferenceAtom,
  slots,
}: CodeRendererSettingProps) {
  const { t } = useTranslation();
  const [preference, setPreference] = useAtom(preferenceAtom);

  const automaticProvider = slots[0];
  if (automaticProvider === undefined) return null;
  const builtInOption = {
    key: BUILT_IN_REPLACEMENT_PROVIDER,
    title: t("settingsMisc.appearance.codeRenderer.builtInTitle", "vozen (built-in)"),
    description: builtInDescription,
  };
  const options = [
    {
      key: AUTOMATIC_REPLACEMENT_PROVIDER,
      title: t("settingsMisc.appearance.codeRenderer.automaticTitle", "Automatic"),
      description: t(
        "settingsMisc.appearance.codeRenderer.automaticDescription",
        "Currently using {{title}} from {{pluginId}}.",
        { title: automaticProvider.title, pluginId: automaticProvider.pluginId },
      ),
    },
    builtInOption,
    ...slots.map((slot) => ({
      key: replacementProviderKey(slot),
      title: slot.title,
      description:
        slot.description ??
        t(
          "settingsMisc.appearance.codeRenderer.fromPlugin",
          "From the {{pluginId}} plugin.",
          { pluginId: slot.pluginId },
        ),
    })),
  ];
  // An unavailable explicit provider renders BB's renderer until it returns.
  const selected =
    options.find((option) => option.key === preference) ?? builtInOption;

  return (
    <SettingsWithControl label={label} description={description}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="min-w-40 justify-between"
            aria-label={label}
          >
            <span className="min-w-0 truncate">{selected.title}</span>
            <Icon
              name="ChevronDown"
              className="size-3.5 text-muted-foreground"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.key}
              onSelect={() => setPreference(option.key)}
              className="flex items-start gap-2"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{option.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
              <Icon
                name="Check"
                className={cn(
                  "ml-auto mt-0.5",
                  selected.key !== option.key && "opacity-0",
                  COARSE_POINTER_ICON_SIZE_CLASS,
                )}
              />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SettingsWithControl>
  );
}

/** Both code-renderer pins; each row hides itself when no plugin supplies one. */
export function CodeRendererSettings() {
  const { t } = useTranslation();
  const { sourceCodeRenderers, diffRenderers } = usePluginSlots();
  return (
    <>
      <CodeRendererSetting
        label={t("settingsMisc.appearance.codeRenderer.sourceCodeLabel", "Source code")}
        description={t(
          "settingsMisc.appearance.codeRenderer.sourceCodeDescription",
          "Choose automatic activation, BB's viewer, or a specific plugin on this device.",
        )}
        builtInDescription={t(
          "settingsMisc.appearance.codeRenderer.sourceCodeBuiltInDescription",
          "Syntax highlighting and gutters from the vozen code theme.",
        )}
        preferenceAtom={sourceCodeRendererProviderAtom}
        slots={sourceCodeRenderers}
      />
      <CodeRendererSetting
        label={t("settingsMisc.appearance.codeRenderer.diffsLabel", "Diffs")}
        description={t(
          "settingsMisc.appearance.codeRenderer.diffsDescription",
          "Applies to file diffs in threads, the diff panel, and plugin views.",
        )}
        builtInDescription={t(
          "settingsMisc.appearance.codeRenderer.diffsBuiltInDescription",
          "Unified and split diffs from the vozen code theme.",
        )}
        preferenceAtom={diffRendererProviderAtom}
        slots={diffRenderers}
      />
    </>
  );
}
