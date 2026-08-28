import { useMemo, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
// Route views render icons outside the shell's core set. Importing the
// extended registry here ships it as a static dependency of this route chunk,
// so those icons never flash blank waiting for an on-demand load.
import "@bb/shared-ui/icon-extended";
import {
  builtInThemes,
  defaultAppSettings,
  defaultAppTheme,
  defaultExperiments,
  type AppTheme,
  type FaviconColorPreference,
  type PluginThemeMeta,
} from "@bb/domain";
import type {
  WorkspaceOpenTarget,
  WorkspaceOpenTargetId,
} from "@bb/host-daemon-contract";
import { Button } from "@bb/shared-ui/button";
import { Icon } from "@bb/shared-ui/icon";
import { Switch } from "@bb/shared-ui/switch";
import { COARSE_POINTER_ICON_SIZE_CLASS } from "@bb/shared-ui/coarse-pointer-sizing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bb/shared-ui/dropdown-menu";
import { PageShell } from "@/components/ui/page-shell.js";
import {
  SettingsSection,
  SettingsWithControl,
} from "@/components/ui/settings-section.js";
import { WorkspaceOpenTargetIcon } from "@/components/workspace-open-target/WorkspaceOpenTargetIcon";
import {
  setPreferredTheme,
  useThemePreference,
  type ThemePreference,
} from "@/hooks/useTheme";
import { useHostDaemon, useLocalHostDaemonAccess } from "@/hooks/useHostDaemon";
import { UsageLimitsSettingsSection } from "@/components/settings/UsageLimitsSettingsSection";
import { ProvidersSettingsSection } from "@/components/settings/ProvidersSettingsSection";
import { CodeRendererSettings } from "@/components/settings/CodeRendererSettings";
import { SidebarThreadListSetting } from "@/components/settings/SidebarThreadListSetting";
import { SplitDimmingSetting } from "@/components/settings/SplitDimmingSetting";
import { useSettingsNavState } from "@/components/settings/settings-nav";
import { PluginSettingsPage } from "@/components/plugin/PluginSettings";
import { FileOpenersSettingsSection } from "@/components/settings/FileOpenersSettingsSection";
import { VoiceInputSettingsSection } from "@/components/settings/VoiceInputSettingsSection";
import { CommunitySettingsSection } from "@/components/settings/CommunitySettingsSection";
import { UpdatesSettingsSection } from "@/components/settings/UpdatesSettingsSection";
import { KeyboardSettingsSection } from "@/components/settings/KeyboardSettingsSection";
import { RemoteAccessSettingsSection } from "@/components/settings/RemoteAccessSettingsSection";
import { MachinesSettingsSection } from "@/components/settings/MachinesSettingsSection";
import { ArchivedThreadsSettingsSection } from "@/components/settings/ArchivedThreadsSettingsSection";
import { CliSkillsSettingsSection } from "@/components/settings/CliSkillsSettingsSection";
import { MarketplacesSettingsSection } from "@/components/settings/MarketplacesSettingsSection";
import {
  useUpdateGeneralSettings,
  useUpdateAppearance,
  useUpdateExperiments,
} from "@/hooks/mutations/settings-mutations";
import { useSystemConfig } from "@/hooks/queries/system-queries";
import { useWorkspaceOpenTargets } from "@/hooks/useWorkspaceOpenTargets";
import { isDesktopBrowserAvailable } from "@/lib/bb-desktop";
import {
  FAVICON_COLOR_VALUES,
  getFaviconGlyphHref,
} from "@/lib/favicon-color-preference";
import { useLocalePreference, type Locale } from "@/lib/i18n";
import { useOpenLinksInAppBrowserPreference } from "@/lib/in-app-browser-link-preference";
import { useRewriteLocalhostLinksPreference } from "@/lib/localhost-link-rewrite-preference";
import { useRichTextEditingPreference } from "@/lib/rich-text-editing-preference";
import {
  SETTINGS_ROUTE_PATH,
  getRootComposeRoutePath,
} from "@/lib/route-paths";
import { useNavigateToThreadAfterCreatePreference } from "@/lib/root-compose-create-preference";
import { cn } from "@bb/shared-ui/lib/utils";
import {
  resolvePreferredWorkspaceOpenTarget,
  supportsWorkspaceOpenTargetCapability,
  useFileOpenTargetPreference,
  useWorkspaceOpenTargetPreference,
  type StoredWorkspaceOpenTargetPreference,
  type WorkspaceOpenTargetCapability,
} from "@/lib/workspace-open-target-preference";
import { getWorkspaceOpenTargetFallbackLabel } from "@/components/workspace-open-target/workspace-open-target-display";
import type { LocalHostDaemonAccessState } from "@/lib/local-host-daemon-access";
import { openUrlInExternalBrowser } from "@/lib/url-open-routing";

const LOCAL_EDITOR_INTEGRATION_DOCS_URL =
  "https://github.com/get-bb/bb/blob/main/docs/multiple-devices.md#open-bb-from-another-browser";

interface ThemePreferenceOption {
  label: string;
  value: ThemePreference;
}

interface FaviconColorOption {
  label: string;
  value: FaviconColorPreference;
}

interface LocalOpenTargetPreferenceDefinition {
  capability: WorkspaceOpenTargetCapability;
  emptyDescriptionKey: string;
  labelKey: string;
}

interface LocalOpenTargetPreferenceControlProps {
  definition: LocalOpenTargetPreferenceDefinition;
  onTargetChange: (targetId: WorkspaceOpenTargetId) => void;
  preferredTargetId: StoredWorkspaceOpenTargetPreference;
  targets: WorkspaceOpenTarget[];
}

export interface LocalOpenTargetSettingsSectionProps {
  accessState: LocalHostDaemonAccessState;
  directoryTargetId: StoredWorkspaceOpenTargetPreference;
  fileTargetId: StoredWorkspaceOpenTargetPreference;
  hasDaemon: boolean;
  onDirectoryTargetChange: (targetId: WorkspaceOpenTargetId) => void;
  onFileTargetChange: (targetId: WorkspaceOpenTargetId) => void;
  onRequestAccess: () => Promise<boolean>;
  targets: WorkspaceOpenTarget[];
}

interface FaviconColorSettingsControlProps {
  disabled: boolean;
  faviconColor: FaviconColorPreference;
  onFaviconColorChange: (faviconColor: FaviconColorPreference) => void;
}

interface AppearanceSettingsSectionProps {
  appearance: AppTheme;
  appearanceDisabled: boolean;
  customThemes: readonly string[];
  pluginThemes: readonly PluginThemeMeta[];
  faviconColor: FaviconColorPreference;
  onAppearanceThemeChange: (themeId: string) => void;
  onCreatePalette: () => void;
  onFaviconColorChange: (faviconColor: FaviconColorPreference) => void;
  onThemePreferenceChange: (themePreference: ThemePreference) => void;
  themePreference: ThemePreference;
}

interface GeneralSettingsSectionProps {
  desktopBrowserAvailable: boolean;
  navigateToThreadAfterCreate: boolean;
  onNavigateToThreadAfterCreateChange: (enabled: boolean) => void;
  onOpenLinksInAppBrowserChange: (enabled: boolean) => void;
  onRewriteLocalhostLinksChange: (enabled: boolean) => void;
  onRichTextEditingChange: (enabled: boolean) => void;
  onSteerActiveThreadOnEnterChange: (enabled: boolean) => void;
  onStreamerModeChange: (enabled: boolean) => void;
  openLinksInAppBrowser: boolean;
  rewriteLocalhostLinks: boolean;
  richTextEditing: boolean;
  steerActiveThreadOnEnter: boolean;
  steerActiveThreadOnEnterDisabled: boolean;
  streamerMode: boolean;
  streamerModeDisabled: boolean;
}

interface DebugSettingsSectionProps {
  disabled: boolean;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

function appPaletteLabel(
  appearance: AppTheme,
  pluginThemes: readonly PluginThemeMeta[],
): string {
  const meta = builtInThemes.find((entry) => entry.id === appearance.themeId);
  return (
    meta?.name ??
    pluginThemes.find((entry) => entry.id === appearance.themeId)?.name ??
    appearance.themeId
  );
}

interface ExperimentsSettingsSectionProps {
  /** True while the config query hasn't loaded or a toggle write is in flight. */
  disabled: boolean;
  changelogPreviewEnabled: boolean;
  editMessagesEnabled: boolean;
  mobileAppEnabled: boolean;
  providerSessionReapingEnabled: boolean;
  timelineWindowingEnabled: boolean;
  onChangelogPreviewEnabledChange: (enabled: boolean) => void;
  onEditMessagesEnabledChange: (enabled: boolean) => void;
  onMobileAppEnabledChange: (enabled: boolean) => void;
  onProviderSessionReapingEnabledChange: (enabled: boolean) => void;
  onTimelineWindowingEnabledChange: (enabled: boolean) => void;
}

function useThemePreferenceOptions(): ReadonlyArray<ThemePreferenceOption> {
  const { t } = useTranslation();
  return [
    { label: t("settings.appearance.theme.options.system"), value: "system" },
    { label: t("settings.appearance.theme.options.light"), value: "light" },
    { label: t("settings.appearance.theme.options.dark"), value: "dark" },
  ];
}

function useFaviconColorOptions(): ReadonlyArray<FaviconColorOption> {
  const { t } = useTranslation();
  return [
    { label: t("settings.appearance.faviconColor.options.default"), value: "default" },
    { label: t("settings.appearance.faviconColor.options.red"), value: "red" },
    { label: t("settings.appearance.faviconColor.options.orange"), value: "orange" },
    { label: t("settings.appearance.faviconColor.options.yellow"), value: "yellow" },
    { label: t("settings.appearance.faviconColor.options.green"), value: "green" },
    { label: t("settings.appearance.faviconColor.options.teal"), value: "teal" },
    { label: t("settings.appearance.faviconColor.options.blue"), value: "blue" },
    { label: t("settings.appearance.faviconColor.options.purple"), value: "purple" },
    { label: t("settings.appearance.faviconColor.options.pink"), value: "pink" },
  ];
}

function useLocaleOptions(): ReadonlyArray<{ label: string; value: Locale }> {
  const { t } = useTranslation();
  return [
    { label: t("settings.appearance.language.options.en"), value: "en" },
    { label: t("settings.appearance.language.options.zh"), value: "zh" },
  ];
}

const SETTINGS_DROPDOWN_TRIGGER_CLASS =
  "h-7 w-full justify-between border-border/60 bg-card px-2 text-xs sm:w-36";
const SETTINGS_DROPDOWN_CONTENT_CLASS =
  "min-w-[var(--radix-dropdown-menu-trigger-width)]";

// Renders the favicon glyph itself in the candidate color by using the
// favicon image as a CSS mask, so the preview matches the resulting tab icon.
function FaviconColorPreview({ value }: { value: FaviconColorPreference }) {
  return (
    <span
      aria-hidden
      className={cn("size-4 shrink-0", value === "default" && "bg-foreground")}
      style={{
        mask: `url("${getFaviconGlyphHref()}") center / contain no-repeat`,
        ...(value === "default"
          ? undefined
          : { backgroundColor: FAVICON_COLOR_VALUES[value] }),
      }}
    />
  );
}

function FaviconColorSettingsControl({
  disabled,
  faviconColor,
  onFaviconColorChange,
}: FaviconColorSettingsControlProps) {
  const { t } = useTranslation();
  const faviconColorOptions = useFaviconColorOptions();
  const faviconColorLabel = t("settings.appearance.faviconColor.label");
  return (
    <SettingsWithControl
      label={faviconColorLabel}
      description={t("settings.appearance.faviconColor.description")}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={SETTINGS_DROPDOWN_TRIGGER_CLASS}
            aria-label={faviconColorLabel}
            disabled={disabled}
          >
            <span className="flex min-w-0 items-center gap-2">
              <FaviconColorPreview value={faviconColor} />
              <span className="min-w-0 truncate">
                {
                  faviconColorOptions.find(
                    (option) => option.value === faviconColor,
                  )?.label
                }
              </span>
            </span>
            <Icon
              name="ChevronDown"
              className="size-3.5 text-muted-foreground"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={SETTINGS_DROPDOWN_CONTENT_CLASS}
        >
          {faviconColorOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onFaviconColorChange(option.value)}
            >
              <FaviconColorPreview value={option.value} />
              {option.label}
              <Icon
                name="Check"
                className={cn(
                  "ml-auto",
                  faviconColor !== option.value && "opacity-0",
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

const DIRECTORY_TARGET_PREFERENCE: LocalOpenTargetPreferenceDefinition = {
  capability: "openDirectory",
  emptyDescriptionKey: "settingsGeneral.filePreferences.directoryDefault.emptyDescription",
  labelKey: "settingsGeneral.filePreferences.directoryDefault.label",
};

const FILE_TARGET_PREFERENCE: LocalOpenTargetPreferenceDefinition = {
  capability: "openFile",
  emptyDescriptionKey: "settingsGeneral.filePreferences.fileDefault.emptyDescription",
  labelKey: "settingsGeneral.filePreferences.fileDefault.label",
};

function LocalOpenTargetPreferenceControl({
  definition,
  onTargetChange,
  preferredTargetId,
  targets,
}: LocalOpenTargetPreferenceControlProps) {
  const { t } = useTranslation();
  const label = t(definition.labelKey);
  const emptyDescription = t(definition.emptyDescriptionKey);
  const compatibleTargets = useMemo(
    () =>
      targets.filter((target) =>
        supportsWorkspaceOpenTargetCapability({
          capability: definition.capability,
          target,
        }),
      ),
    [definition.capability, targets],
  );
  const resolvedTarget = useMemo(
    () =>
      resolvePreferredWorkspaceOpenTarget({
        capability: definition.capability,
        preferredTargetId,
        targets,
      }),
    [definition.capability, preferredTargetId, targets],
  );
  const unavailableMessage =
    compatibleTargets.length === 0 ? emptyDescription : null;
  const selectedTargetId = resolvedTarget?.id ?? preferredTargetId;
  const buttonLabel =
    resolvedTarget?.label ??
    (preferredTargetId
      ? getWorkspaceOpenTargetFallbackLabel(preferredTargetId)
      : t("settingsGeneral.filePreferences.unavailable"));

  return (
    <SettingsWithControl label={label}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={SETTINGS_DROPDOWN_TRIGGER_CLASS}
            aria-label={label}
          >
            <span className="flex min-w-0 items-center gap-2">
              {selectedTargetId ? (
                <WorkspaceOpenTargetIcon
                  {...(resolvedTarget
                    ? { target: resolvedTarget }
                    : { targetId: selectedTargetId })}
                  className="size-5"
                />
              ) : null}
              <span className="min-w-0 truncate">{buttonLabel}</span>
            </span>
            <Icon
              name="ChevronDown"
              className="size-3.5 text-muted-foreground"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={SETTINGS_DROPDOWN_CONTENT_CLASS}
        >
          {unavailableMessage ? (
            <div
              role="note"
              className="px-2 py-[0.3125rem] text-xs leading-snug text-foreground"
            >
              {unavailableMessage}
            </div>
          ) : (
            compatibleTargets.map((target) => (
              <DropdownMenuItem
                key={target.id}
                onSelect={() => onTargetChange(target.id)}
              >
                <WorkspaceOpenTargetIcon target={target} className="size-5" />
                <span className="min-w-0 truncate">{target.label}</span>
                <Icon
                  name="Check"
                  className={cn(
                    "ml-auto",
                    resolvedTarget?.id !== target.id && "opacity-0",
                    COARSE_POINTER_ICON_SIZE_CLASS,
                  )}
                />
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SettingsWithControl>
  );
}

export function LocalOpenTargetSettingsSection({
  accessState,
  directoryTargetId,
  fileTargetId,
  hasDaemon,
  onDirectoryTargetChange,
  onFileTargetChange,
  onRequestAccess,
  targets,
}: LocalOpenTargetSettingsSectionProps) {
  const { t } = useTranslation();
  const [accessRequestPending, setAccessRequestPending] = useState(false);

  if (accessState === "unavailable") {
    return null;
  }

  const handleRequestAccess = async () => {
    setAccessRequestPending(true);
    try {
      await onRequestAccess();
    } finally {
      setAccessRequestPending(false);
    }
  };

  if (!hasDaemon) {
    const accessDenied = accessState === "denied";
    const accessAvailable = accessState === "available";
    const descriptionText = accessDenied
      ? t("settingsGeneral.filePreferences.accessDenied")
      : accessAvailable
        ? t("settingsGeneral.filePreferences.accessAvailable")
        : t("settingsGeneral.filePreferences.accessDefault");
    const buttonLabel = accessRequestPending
      ? accessAvailable
        ? t("settingsGeneral.filePreferences.retrying")
        : t("settingsGeneral.filePreferences.enabling")
      : accessDenied
        ? t("settingsGeneral.filePreferences.blocked")
        : accessAvailable
          ? t("settingsGeneral.filePreferences.retry")
          : t("settingsGeneral.filePreferences.enable");

    return (
      <SettingsSection title={t("settingsGeneral.filePreferences.title")}>
        <SettingsWithControl
          label={t("settingsGeneral.filePreferences.localEditorIntegration")}
          description={
            <>
              {descriptionText}{" "}
              <a
                href={LOCAL_EDITOR_INTEGRATION_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={(event) => {
                  event.preventDefault();
                  openUrlInExternalBrowser(LOCAL_EDITOR_INTEGRATION_DOCS_URL);
                }}
              >
                {t("settingsGeneral.filePreferences.setupGuide")}
                <Icon
                  name="ExternalLink"
                  className="size-3 shrink-0"
                  aria-hidden
                />
              </a>
            </>
          }
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={accessRequestPending || accessDenied}
            onClick={handleRequestAccess}
          >
            {buttonLabel}
          </Button>
        </SettingsWithControl>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title={t("settingsGeneral.filePreferences.title")}>
      <div className="space-y-5">
        <LocalOpenTargetPreferenceControl
          definition={DIRECTORY_TARGET_PREFERENCE}
          onTargetChange={onDirectoryTargetChange}
          preferredTargetId={directoryTargetId}
          targets={targets}
        />
        <LocalOpenTargetPreferenceControl
          definition={FILE_TARGET_PREFERENCE}
          onTargetChange={onFileTargetChange}
          preferredTargetId={fileTargetId}
          targets={targets}
        />
      </div>
    </SettingsSection>
  );
}


export function AppearanceSettingsSection({
  appearance,
  appearanceDisabled,
  customThemes,
  pluginThemes,
  faviconColor,
  onAppearanceThemeChange,
  onFaviconColorChange,
  onCreatePalette,
  onThemePreferenceChange,
  themePreference,
}: AppearanceSettingsSectionProps) {
  const { t } = useTranslation();
  const [locale, setLocale] = useLocalePreference();
  const themePreferenceOptions = useThemePreferenceOptions();
  const localeOptions = useLocaleOptions();
  const themeLabel = t("settings.appearance.theme.label");
  const paletteLabel = t("settings.appearance.palette.label");
  const languageLabel = t("settings.appearance.language.label");

  return (
    <SettingsSection title={t("settings.appearance.title")}>
      <div className="space-y-5">
        <SidebarThreadListSetting />
        <CodeRendererSettings />
        <SettingsWithControl label={languageLabel}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={SETTINGS_DROPDOWN_TRIGGER_CLASS}
                aria-label={languageLabel}
              >
                {localeOptions.find((option) => option.value === locale)?.label}
                <Icon
                  name="ChevronDown"
                  className="size-3.5 text-muted-foreground"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={SETTINGS_DROPDOWN_CONTENT_CLASS}
            >
              {localeOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => setLocale(option.value)}
                >
                  {option.label}
                  <Icon
                    name="Check"
                    className={cn(
                      "ml-auto",
                      locale !== option.value && "opacity-0",
                      COARSE_POINTER_ICON_SIZE_CLASS,
                    )}
                  />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SettingsWithControl>

        <SettingsWithControl label={themeLabel}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={SETTINGS_DROPDOWN_TRIGGER_CLASS}
                aria-label={themeLabel}
              >
                {
                  themePreferenceOptions.find(
                    (option) => option.value === themePreference,
                  )?.label
                }
                <Icon
                  name="ChevronDown"
                  className="size-3.5 text-muted-foreground"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={SETTINGS_DROPDOWN_CONTENT_CLASS}
            >
              {themePreferenceOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => onThemePreferenceChange(option.value)}
                >
                  {option.label}
                  <Icon
                    name="Check"
                    className={cn(
                      "ml-auto",
                      themePreference !== option.value && "opacity-0",
                      COARSE_POINTER_ICON_SIZE_CLASS,
                    )}
                  />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SettingsWithControl>

        <SettingsWithControl
          label={paletteLabel}
          description={t("settings.appearance.palette.description")}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={SETTINGS_DROPDOWN_TRIGGER_CLASS}
                aria-label={paletteLabel}
                disabled={appearanceDisabled}
              >
                <span className="min-w-0 truncate">
                  {appPaletteLabel(appearance, pluginThemes)}
                </span>
                <Icon
                  name="ChevronDown"
                  className="size-3.5 text-muted-foreground"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={SETTINGS_DROPDOWN_CONTENT_CLASS}
            >
              {builtInThemes.map((entry) => (
                <DropdownMenuItem
                  key={entry.id}
                  onSelect={() => onAppearanceThemeChange(entry.id)}
                >
                  {entry.name}
                  <Icon
                    name="Check"
                    className={cn(
                      "ml-auto",
                      appearance.themeId !== entry.id && "opacity-0",
                      COARSE_POINTER_ICON_SIZE_CLASS,
                    )}
                  />
                </DropdownMenuItem>
              ))}
              {customThemes.map((name) => (
                <DropdownMenuItem
                  key={`custom:${name}`}
                  onSelect={() => onAppearanceThemeChange(name)}
                >
                  {name}
                  <Icon
                    name="Check"
                    className={cn(
                      "ml-auto",
                      appearance.themeId !== name && "opacity-0",
                      COARSE_POINTER_ICON_SIZE_CLASS,
                    )}
                  />
                </DropdownMenuItem>
              ))}
              {pluginThemes.map((theme) => (
                <DropdownMenuItem
                  key={theme.id}
                  onSelect={() => onAppearanceThemeChange(theme.id)}
                >
                  {theme.name}
                  <span className="text-muted-foreground">
                    ({theme.pluginId})
                  </span>
                  <Icon
                    name="Check"
                    className={cn(
                      "ml-auto",
                      appearance.themeId !== theme.id && "opacity-0",
                      COARSE_POINTER_ICON_SIZE_CLASS,
                    )}
                  />
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onCreatePalette}>
                <Icon name="Plus" className={COARSE_POINTER_ICON_SIZE_CLASS} />
                {t("settings.appearance.palette.create")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SettingsWithControl>

        <FaviconColorSettingsControl
          disabled={appearanceDisabled}
          faviconColor={faviconColor}
          onFaviconColorChange={onFaviconColorChange}
        />
        <SplitDimmingSetting />
      </div>
    </SettingsSection>
  );
}

export function GeneralSettingsSection({
  desktopBrowserAvailable,
  navigateToThreadAfterCreate,
  onNavigateToThreadAfterCreateChange,
  onOpenLinksInAppBrowserChange,
  onRewriteLocalhostLinksChange,
  onRichTextEditingChange,
  onSteerActiveThreadOnEnterChange,
  onStreamerModeChange,
  openLinksInAppBrowser,
  rewriteLocalhostLinks,
  richTextEditing,
  steerActiveThreadOnEnter,
  steerActiveThreadOnEnterDisabled,
  streamerMode,
  streamerModeDisabled,
}: GeneralSettingsSectionProps) {
  const { t } = useTranslation();
  const navigateToThreadAfterCreateLabel = t(
    "settingsGeneral.general.navigateToThreadAfterCreate",
  );
  const richTextEditingLabel = t("settingsGeneral.general.richTextEditing");
  const steerActiveThreadOnEnterLabel = t(
    "settingsGeneral.general.steerActiveThreadOnEnter",
  );
  const openLinksInAppBrowserLabel = t(
    "settingsGeneral.general.openLinksInAppBrowser",
  );
  const rewriteLocalhostLinksLabel = t(
    "settingsGeneral.general.rewriteLocalhostLinks",
  );
  const streamerModeLabel = t("settingsGeneral.general.streamerMode");

  return (
    <SettingsSection title={t("settingsGeneral.general.title")}>
      <div className="space-y-5">
        <SettingsWithControl label={navigateToThreadAfterCreateLabel}>
          <Switch
            checked={navigateToThreadAfterCreate}
            onCheckedChange={onNavigateToThreadAfterCreateChange}
            aria-label={navigateToThreadAfterCreateLabel}
          />
        </SettingsWithControl>

        <SettingsWithControl label={richTextEditingLabel}>
          <Switch
            checked={richTextEditing}
            onCheckedChange={onRichTextEditingChange}
            aria-label={richTextEditingLabel}
          />
        </SettingsWithControl>

        <SettingsWithControl
          label={steerActiveThreadOnEnterLabel}
          description={t(
            "settingsGeneral.general.steerActiveThreadOnEnterDescription",
          )}
        >
          <Switch
            checked={steerActiveThreadOnEnter}
            disabled={steerActiveThreadOnEnterDisabled}
            onCheckedChange={onSteerActiveThreadOnEnterChange}
            aria-label={steerActiveThreadOnEnterLabel}
          />
        </SettingsWithControl>

        {desktopBrowserAvailable ? (
          <SettingsWithControl
            label={openLinksInAppBrowserLabel}
            description={t(
              "settingsGeneral.general.openLinksInAppBrowserDescription",
            )}
          >
            <Switch
              checked={openLinksInAppBrowser}
              onCheckedChange={onOpenLinksInAppBrowserChange}
              aria-label={openLinksInAppBrowserLabel}
            />
          </SettingsWithControl>
        ) : null}

        <SettingsWithControl
          label={rewriteLocalhostLinksLabel}
          description={t(
            "settingsGeneral.general.rewriteLocalhostLinksDescription",
          )}
        >
          <Switch
            checked={rewriteLocalhostLinks}
            onCheckedChange={onRewriteLocalhostLinksChange}
            aria-label={rewriteLocalhostLinksLabel}
          />
        </SettingsWithControl>

        <SettingsWithControl
          label={streamerModeLabel}
          description={t("settingsGeneral.general.streamerModeDescription")}
        >
          <Switch
            checked={streamerMode}
            disabled={streamerModeDisabled}
            onCheckedChange={onStreamerModeChange}
            aria-label={streamerModeLabel}
          />
        </SettingsWithControl>
      </div>
    </SettingsSection>
  );
}

export function DebugSettingsSection({
  disabled,
  enabled,
  onEnabledChange,
}: DebugSettingsSectionProps) {
  const { t } = useTranslation();
  const unhandledProviderEventsLabel = t(
    "settingsGeneral.debug.unhandledProviderEvents",
  );
  return (
    <SettingsSection title={t("settingsGeneral.debug.title")}>
      <SettingsWithControl
        label={unhandledProviderEventsLabel}
        description={t(
          "settingsGeneral.debug.unhandledProviderEventsDescription",
        )}
      >
        <Switch
          checked={enabled}
          disabled={disabled}
          onCheckedChange={onEnabledChange}
          aria-label={unhandledProviderEventsLabel}
        />
      </SettingsWithControl>
    </SettingsSection>
  );
}

export function ExperimentsSettingsSection({
  changelogPreviewEnabled,
  disabled,
  editMessagesEnabled,
  mobileAppEnabled,
  providerSessionReapingEnabled,
  timelineWindowingEnabled,
  onChangelogPreviewEnabledChange,
  onEditMessagesEnabledChange,
  onMobileAppEnabledChange,
  onProviderSessionReapingEnabledChange,
  onTimelineWindowingEnabledChange,
}: ExperimentsSettingsSectionProps) {
  const { t } = useTranslation();
  const changelogPreviewLabel = t("settingsGeneral.experiments.changelogPreview");
  const editMessagesLabel = t("settingsGeneral.experiments.editMessages");
  const mobileAppLabel = t("settingsGeneral.experiments.mobileApp");
  const providerSessionReapingLabel = t(
    "settingsGeneral.experiments.providerSessionReaping",
  );
  const timelineWindowingLabel = t(
    "settingsGeneral.experiments.timelineWindowing",
  );

  return (
    <SettingsSection
      title={t("settingsGeneral.experiments.title")}
      description={t("settingsGeneral.experiments.description")}
    >
      <div className="space-y-5">
        <SettingsWithControl
          label={changelogPreviewLabel}
          description={t(
            "settingsGeneral.experiments.changelogPreviewDescription",
          )}
        >
          <Switch
            checked={changelogPreviewEnabled}
            disabled={disabled}
            onCheckedChange={onChangelogPreviewEnabledChange}
            aria-label={changelogPreviewLabel}
          />
        </SettingsWithControl>

        <SettingsWithControl
          label={editMessagesLabel}
          description={t(
            "settingsGeneral.experiments.editMessagesDescription",
          )}
        >
          <Switch
            checked={editMessagesEnabled}
            disabled={disabled}
            onCheckedChange={onEditMessagesEnabledChange}
            aria-label={editMessagesLabel}
          />
        </SettingsWithControl>

        <SettingsWithControl
          label={mobileAppLabel}
          description={t("settingsGeneral.experiments.mobileAppDescription")}
        >
          <Switch
            checked={mobileAppEnabled}
            disabled={disabled}
            onCheckedChange={onMobileAppEnabledChange}
            aria-label={mobileAppLabel}
          />
        </SettingsWithControl>

        <SettingsWithControl
          label={providerSessionReapingLabel}
          description={t(
            "settingsGeneral.experiments.providerSessionReapingDescription",
          )}
        >
          <Switch
            checked={providerSessionReapingEnabled}
            disabled={disabled}
            onCheckedChange={onProviderSessionReapingEnabledChange}
            aria-label={providerSessionReapingLabel}
          />
        </SettingsWithControl>

        <SettingsWithControl
          label={timelineWindowingLabel}
          description={t(
            "settingsGeneral.experiments.timelineWindowingDescription",
          )}
        >
          <Switch
            checked={timelineWindowingEnabled}
            disabled={disabled}
            onCheckedChange={onTimelineWindowingEnabledChange}
            aria-label={timelineWindowingLabel}
          />
        </SettingsWithControl>
      </div>
    </SettingsSection>
  );
}

export function SettingsView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const themePreference = useThemePreference();
  const systemConfigQuery = useSystemConfig();
  const { hasDaemon } = useHostDaemon();
  const { accessState, requestAccess } = useLocalHostDaemonAccess();
  const { workspaceOpenTargets } = useWorkspaceOpenTargets({
    enabled: hasDaemon,
  });
  const [directoryTargetId, setDirectoryTargetId] =
    useWorkspaceOpenTargetPreference(workspaceOpenTargets);
  const [fileTargetId, setFileTargetId] =
    useFileOpenTargetPreference(workspaceOpenTargets);
  const [openLinksInAppBrowser, setOpenLinksInAppBrowser] =
    useOpenLinksInAppBrowserPreference();
  const [rewriteLocalhostLinks, setRewriteLocalhostLinks] =
    useRewriteLocalhostLinksPreference();
  const [navigateToThreadAfterCreate, setNavigateToThreadAfterCreate] =
    useNavigateToThreadAfterCreatePreference();
  const [richTextEditing, setRichTextEditing] = useRichTextEditingPreference();
  // The in-app browser only exists on desktop; hide the toggle entirely on web,
  // where it would have no effect.
  const [desktopBrowserAvailable] = useState(isDesktopBrowserAvailable);
  const experiments = systemConfigQuery.data?.experiments ?? defaultExperiments;
  const updateExperimentsMutation = useUpdateExperiments();
  const generalSettings =
    systemConfigQuery.data?.generalSettings ?? defaultAppSettings;
  const updateGeneralSettingsMutation = useUpdateGeneralSettings();
  const appearance = systemConfigQuery.data?.appearance ?? defaultAppTheme;
  const updateAppearanceMutation = useUpdateAppearance();
  const { activePluginId, activeSection, hasUnknownSection } =
    useSettingsNavState();
  if (hasUnknownSection) {
    return <Navigate to={SETTINGS_ROUTE_PATH} replace />;
  }

  let content: ReactNode = null;
  if (activePluginId !== null) {
    content = <PluginSettingsPage pluginId={activePluginId} />;
  } else if (activeSection === "providers") {
    content = (
      <ProvidersSettingsSection
        disabled={
          systemConfigQuery.data === undefined ||
          updateGeneralSettingsMutation.isPending
        }
        generalSettings={generalSettings}
        onGeneralSettingsChange={(next) =>
          updateGeneralSettingsMutation.mutateAsync(next)
        }
      />
    );
  } else if (activeSection === "appearance") {
    content = (
      <AppearanceSettingsSection
        appearance={appearance}
        appearanceDisabled={
          systemConfigQuery.data === undefined ||
          updateAppearanceMutation.isPending
        }
        customThemes={systemConfigQuery.data?.customThemes ?? []}
        pluginThemes={systemConfigQuery.data?.pluginThemes ?? []}
        faviconColor={appearance.faviconColor}
        themePreference={themePreference}
        onAppearanceThemeChange={(themeId) =>
          updateAppearanceMutation.mutate({
            themeId,
            faviconColor: appearance.faviconColor,
          })
        }
        onCreatePalette={() =>
          navigate(getRootComposeRoutePath(), {
            state: {
              focusPrompt: true,
              initialPrompt: t("settings.appearance.palette.createPrompt"),
            },
          })
        }
        onFaviconColorChange={(faviconColor) =>
          updateAppearanceMutation.mutate({
            themeId: appearance.themeId,
            faviconColor,
          })
        }
        onThemePreferenceChange={setPreferredTheme}
      />
    );
  } else if (activeSection === "usage") {
    content = <UsageLimitsSettingsSection />;
  } else if (activeSection === "keyboard") {
    content = <KeyboardSettingsSection />;
  } else if (activeSection === "files") {
    content = (
      <>
        <LocalOpenTargetSettingsSection
          accessState={accessState}
          directoryTargetId={directoryTargetId}
          fileTargetId={fileTargetId}
          hasDaemon={hasDaemon}
          onDirectoryTargetChange={setDirectoryTargetId}
          onFileTargetChange={setFileTargetId}
          onRequestAccess={requestAccess}
          targets={workspaceOpenTargets}
        />
        <FileOpenersSettingsSection />
      </>
    );
  } else if (activeSection === "machines") {
    content = <MachinesSettingsSection />;
  } else if (activeSection === "remote-access") {
    content = <RemoteAccessSettingsSection />;
  } else if (activeSection === "updates") {
    // Always false: ChangelogPreviewCard fetches bb's own real changelog
    // straight from github.com/get-bb/bb — nothing vozen-specific to show.
    content = <UpdatesSettingsSection showChangelogPreview={false} />;
  } else if (activeSection === "experiments") {
    content = (
      <ExperimentsSettingsSection
        changelogPreviewEnabled={experiments.changelogPreview}
        disabled={
          systemConfigQuery.data === undefined ||
          updateExperimentsMutation.isPending
        }
        onChangelogPreviewEnabledChange={(enabled) =>
          updateExperimentsMutation.mutate({
            ...experiments,
            changelogPreview: enabled,
          })
        }
        editMessagesEnabled={experiments.editMessages}
        onEditMessagesEnabledChange={(enabled) =>
          updateExperimentsMutation.mutate({
            ...experiments,
            editMessages: enabled,
          })
        }
        mobileAppEnabled={experiments.mobileApp}
        onMobileAppEnabledChange={(enabled) =>
          updateExperimentsMutation.mutate({
            ...experiments,
            mobileApp: enabled,
          })
        }
        providerSessionReapingEnabled={experiments.providerSessionReaping}
        onProviderSessionReapingEnabledChange={(enabled) =>
          updateExperimentsMutation.mutate({
            ...experiments,
            providerSessionReaping: enabled,
          })
        }
        timelineWindowingEnabled={experiments.timelineWindowing}
        onTimelineWindowingEnabledChange={(enabled) =>
          updateExperimentsMutation.mutate({
            ...experiments,
            timelineWindowing: enabled,
          })
        }
      />
    );
  } else if (activeSection === "marketplaces") {
    content = <MarketplacesSettingsSection />;
  } else if (activeSection === "community") {
    content = <CommunitySettingsSection />;
  } else if (activeSection === "archived") {
    content = <ArchivedThreadsSettingsSection />;
  } else {
    content = (
      <>
        <GeneralSettingsSection
          desktopBrowserAvailable={desktopBrowserAvailable}
          navigateToThreadAfterCreate={navigateToThreadAfterCreate}
          openLinksInAppBrowser={openLinksInAppBrowser}
          rewriteLocalhostLinks={rewriteLocalhostLinks}
          richTextEditing={richTextEditing}
          steerActiveThreadOnEnter={generalSettings.steerActiveThreadOnEnter}
          steerActiveThreadOnEnterDisabled={
            systemConfigQuery.data === undefined ||
            updateGeneralSettingsMutation.isPending
          }
          onNavigateToThreadAfterCreateChange={setNavigateToThreadAfterCreate}
          onOpenLinksInAppBrowserChange={setOpenLinksInAppBrowser}
          onRewriteLocalhostLinksChange={setRewriteLocalhostLinks}
          onRichTextEditingChange={setRichTextEditing}
          onSteerActiveThreadOnEnterChange={(enabled) =>
            updateGeneralSettingsMutation.mutate({
              ...generalSettings,
              steerActiveThreadOnEnter: enabled,
            })
          }
          streamerMode={generalSettings.streamerMode}
          streamerModeDisabled={
            systemConfigQuery.data === undefined ||
            updateGeneralSettingsMutation.isPending
          }
          onStreamerModeChange={(enabled) =>
            updateGeneralSettingsMutation.mutate({
              ...generalSettings,
              streamerMode: enabled,
            })
          }
        />
        <CliSkillsSettingsSection />
        <VoiceInputSettingsSection />
        <DebugSettingsSection
          enabled={generalSettings.showUnhandledProviderEvents}
          disabled={
            systemConfigQuery.data === undefined ||
            updateGeneralSettingsMutation.isPending
          }
          onEnabledChange={(enabled) =>
            updateGeneralSettingsMutation.mutate({
              ...generalSettings,
              showUnhandledProviderEvents: enabled,
            })
          }
        />
      </>
    );
  }

  return (
    <PageShell contentClassName="pt-4 md:pt-5">
      <div className="mx-auto w-full max-w-3xl space-y-10">{content}</div>
    </PageShell>
  );
}
