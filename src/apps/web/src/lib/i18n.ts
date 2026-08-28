import { useCallback } from "react";
import { useAtom } from "jotai";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { createLocalStorageEnumStorage } from "@/lib/browser-storage";
import { atomWithStorage } from "jotai/utils";
import { en as threadEn, zh as threadZh } from "./i18n/thread";
import { en as pluginEn, zh as pluginZh } from "./i18n/plugin";
import { en as uiEn, zh as uiZh } from "./i18n/ui";
import { en as promptboxEn, zh as promptboxZh } from "./i18n/promptbox";
import { en as secondaryPanelEn, zh as secondaryPanelZh } from "./i18n/secondaryPanel";
import { en as sidebarEn, zh as sidebarZh } from "./i18n/sidebar";
import { en as settingsMiscEn, zh as settingsMiscZh } from "./i18n/settingsMisc";
import { en as settingsGeneralEn, zh as settingsGeneralZh } from "./i18n/settingsGeneral";
import { en as viewsEn, zh as viewsZh } from "./i18n/views";

export const LOCALE_STORAGE_KEY = "bb.locale";

export type Locale = "en" | "zh";

const isLocale = (value: string): value is Locale =>
  value === "en" || value === "zh";

const EN_TRANSLATION = {
  settings: {
    appearance: {
      title: "Appearance",
      theme: {
        label: "Theme",
        options: {
          system: "System",
          light: "Light",
          dark: "Dark",
        },
      },
      palette: {
        label: "Palette",
        description:
          "Palettes change vozen's colors, including syntax colors in diffs and file previews. Choose a built-in palette or create one from a prompt.",
        create: "Create",
        createPrompt:
          "Create a custom vozen palette. First run `vozen theme dir` to find the custom theme directory. Ask me for the palette name and visual direction, then create `<theme-dir>/<name>/theme.css` with light and dark theme variables compatible with vozen's theme tokens.",
      },
      faviconColor: {
        label: "Favicon color",
        description: "Tint browser tabs to tell instances apart.",
        options: {
          default: "Default",
          red: "Red",
          orange: "Orange",
          yellow: "Yellow",
          green: "Green",
          teal: "Teal",
          blue: "Blue",
          purple: "Purple",
          pink: "Pink",
        },
      },
      language: {
        label: "Language",
        options: {
          en: "English",
          zh: "中文",
        },
      },
    },
  },
};

const ZH_TRANSLATION: typeof EN_TRANSLATION = {
  settings: {
    appearance: {
      title: "外观",
      theme: {
        label: "主题",
        options: {
          system: "跟随系统",
          light: "浅色",
          dark: "深色",
        },
      },
      palette: {
        label: "调色板",
        description:
          "调色板会改变 vozen 的配色，包括差异对比和文件预览中的语法高亮颜色。选择内置调色板，或用提示词创建一个新的。",
        create: "新建",
        createPrompt:
          "创建一个自定义 vozen 调色板。先运行 `vozen theme dir` 找到自定义主题目录，然后告诉我调色板名称和视觉风格，我会在 `<theme-dir>/<name>/theme.css` 中创建兼容 vozen 主题变量的浅色和深色主题变量。",
      },
      faviconColor: {
        label: "图标颜色",
        description: "给浏览器标签页图标染色，方便区分多个实例。",
        options: {
          default: "默认",
          red: "红色",
          orange: "橙色",
          yellow: "黄色",
          green: "绿色",
          teal: "青色",
          blue: "蓝色",
          purple: "紫色",
          pink: "粉色",
        },
      },
      language: {
        label: "语言",
        options: {
          en: "English",
          zh: "中文",
        },
      },
    },
  },
};

// Each batch below owns a disjoint top-level key, so a shallow merge is
// enough — no deep-merge library needed.
const MERGED_EN = {
  ...EN_TRANSLATION,
  ...threadEn,
  ...pluginEn,
  ...uiEn,
  ...promptboxEn,
  ...secondaryPanelEn,
  ...sidebarEn,
  ...settingsMiscEn,
  ...settingsGeneralEn,
  ...viewsEn,
};

const MERGED_ZH: typeof MERGED_EN = {
  ...ZH_TRANSLATION,
  ...threadZh,
  ...pluginZh,
  ...uiZh,
  ...promptboxZh,
  ...secondaryPanelZh,
  ...sidebarZh,
  ...settingsMiscZh,
  ...settingsGeneralZh,
  ...viewsZh,
};

function readCachedLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored !== null && isLocale(stored) ? stored : "en";
  } catch {
    return "en";
  }
}

let initialized = false;

/**
 * Must run before the first render: react-i18next's useTranslation() throws
 * if i18next hasn't been initialized yet.
 */
export function initializeI18n(): void {
  if (initialized) return;
  initialized = true;
  void i18next.use(initReactI18next).init({
    lng: readCachedLocale(),
    fallbackLng: "en",
    resources: {
      en: { translation: MERGED_EN },
      zh: { translation: MERGED_ZH },
    },
    interpolation: { escapeValue: false },
  });
}

const localePreferenceStorage = createLocalStorageEnumStorage<Locale>(isLocale);
const localeAtom = atomWithStorage<Locale>(
  LOCALE_STORAGE_KEY,
  "en",
  localePreferenceStorage,
  { getOnInit: true },
);

export function useLocalePreference() {
  const [locale, setLocaleAtom] = useAtom(localeAtom);
  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleAtom(next);
      void i18next.changeLanguage(next);
    },
    [setLocaleAtom],
  );
  return [locale, setLocale] as const;
}
