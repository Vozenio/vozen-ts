import "@/lib/i18n/promptbox";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@bb/shared-ui/button";
import { Icon } from "@bb/shared-ui/icon";
import { PromptStackCard } from "@/components/promptbox/banner/PromptStackCard";

interface ProviderCliVersionBannerProps {
  displayName: string;
  currentVersion: string | null;
  minimumSupportedVersion: string | null;
  canUpdate: boolean;
  updating: boolean;
  onUpdate: () => void;
}

function versionRequirementCopy(
  t: TFunction,
  currentVersion: string | null,
  minimumSupportedVersion: string | null,
): string {
  if (currentVersion !== null && minimumSupportedVersion !== null) {
    return t("promptbox.providerCliVersionBanner.installedNeedsVersion", {
      currentVersion,
      minimumVersion: minimumSupportedVersion,
    });
  }
  if (currentVersion !== null) {
    return t("promptbox.providerCliVersionBanner.installedNeedsNewer", {
      currentVersion,
    });
  }
  if (minimumSupportedVersion !== null) {
    return t("promptbox.providerCliVersionBanner.needsVersion", {
      minimumVersion: minimumSupportedVersion,
    });
  }
  return t("promptbox.providerCliVersionBanner.needsNewer");
}

/** Blocking update state for the selected provider in the new-thread composer. */
export function ProviderCliVersionBanner({
  displayName,
  currentVersion,
  minimumSupportedVersion,
  canUpdate,
  updating,
  onUpdate,
}: ProviderCliVersionBannerProps) {
  const { t } = useTranslation();
  return (
    <PromptStackCard
      ariaLabel={t("promptbox.providerCliVersionBanner.updateRequiredAria", {
        displayName,
      })}
      className="overflow-hidden border-attention/50 bg-surface-attention shadow-sm"
    >
      <div
        role="alert"
        className="flex min-h-14 max-w-full items-center gap-3 px-3 py-2.5"
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-attention/15 text-warning-text ring-1 ring-attention/25"
          aria-hidden
        >
          <Icon name="AlertTriangle" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {t("promptbox.providerCliVersionBanner.updateRequiredAria", {
              displayName,
            })}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t("promptbox.providerCliVersionBanner.updateBeforeStarting", {
              displayName,
            })}{" "}
            {versionRequirementCopy(
              t,
              currentVersion,
              minimumSupportedVersion,
            )}
          </p>
        </div>
        {canUpdate ? (
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 px-3"
            disabled={updating}
            onClick={onUpdate}
          >
            {updating ? (
              <>
                <Icon name="Spinner" className="animate-spin" />
                {t("promptbox.providerCliVersionBanner.updating")}
              </>
            ) : (
              t("promptbox.providerCliVersionBanner.updateButton", {
                displayName,
              })
            )}
          </Button>
        ) : null}
      </div>
    </PromptStackCard>
  );
}
