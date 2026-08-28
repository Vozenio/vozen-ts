import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SystemExecutionOptionsModelLoadError } from "@bb/server-contract";
import { useUrlAnchorClickHandler } from "@/lib/url-open-routing";

interface ModelLoadErrorMessageProps {
  error: SystemExecutionOptionsModelLoadError;
  providerLabel: string;
  /** The provider's declared `strings.installUrl`, when it declares one. */
  installUrl?: string;
}

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

// Default translator for callers that don't pass one, so this stays a plain
// function usable outside React's translation context.
const englishFallbackT: TranslateFn = (key, options) => {
  const provider = (options?.provider as string | undefined) ?? "";
  switch (key) {
    case "ui.modelLoadError.providerUnavailable":
      return `${provider} is unavailable because its provider plugin failed to load.`;
    case "ui.modelLoadError.timeout":
      return `Timed out loading models for ${provider}.`;
    case "ui.modelLoadError.missingExecutable":
      return `Could not load models for ${provider}. Please make sure the ${provider} CLI is installed.`;
    case "ui.modelLoadError.authRequired":
      return `Could not load models for ${provider}. Authentication is required.`;
    default:
      return `Could not load models for ${provider}.`;
  }
};

interface FormatModelLoadErrorTextArgs {
  error: SystemExecutionOptionsModelLoadError;
  providerLabel: string;
  t?: TranslateFn;
}

export function formatModelLoadErrorText({
  error,
  providerLabel,
  t = englishFallbackT,
}: FormatModelLoadErrorTextArgs): string {
  if (error.code === "provider_unavailable") {
    return t("ui.modelLoadError.providerUnavailable", {
      provider: providerLabel,
    });
  }

  if (error.code === "timeout") {
    return t("ui.modelLoadError.timeout", { provider: providerLabel });
  }

  if (error.code === "missing_executable") {
    return t("ui.modelLoadError.missingExecutable", {
      provider: providerLabel,
    });
  }

  if (error.code === "auth_required") {
    return t("ui.modelLoadError.authRequired", { provider: providerLabel });
  }

  return t("ui.modelLoadError.generic", { provider: providerLabel });
}

export function ModelLoadErrorMessage({
  error,
  providerLabel,
  installUrl,
}: ModelLoadErrorMessageProps): ReactNode {
  const { t } = useTranslation();
  const helpUrl =
    error.code === "missing_executable" ? installUrl : undefined;
  const handleHelpLinkClick = useUrlAnchorClickHandler(helpUrl);

  if (error.code === "missing_executable") {
    if (helpUrl === undefined) {
      return formatModelLoadErrorText({ error, providerLabel, t });
    }
    return (
      <>
        {t("ui.modelLoadError.missingExecutablePrefix", {
          provider: providerLabel,
        })}{" "}
        <a
          href={helpUrl}
          target="_blank"
          rel="noreferrer"
          onClick={handleHelpLinkClick}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {t("ui.modelLoadError.cliLinkLabel", { provider: providerLabel })}
        </a>{" "}
        {t("ui.modelLoadError.installedSuffix")}
      </>
    );
  }

  if (error.code === "auth_required") {
    return (
      <>{t("ui.modelLoadError.authRequired", { provider: providerLabel })}</>
    );
  }

  return formatModelLoadErrorText({ error, providerLabel, t });
}
