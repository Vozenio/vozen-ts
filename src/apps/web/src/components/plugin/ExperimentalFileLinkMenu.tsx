import { useTranslation } from "react-i18next";
import type { ExperimentalFileOpenOptions } from "@get-bb/plugin-sdk";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@bb/shared-ui/context-menu";
import { useLocalOpenTargets } from "@/hooks/useLocalOpenTargets";
import { useResolvedLiveFileTarget } from "@/hooks/useResolvedLiveFileTarget";
import { useAppNavigationHost } from "@/lib/app-navigation-host";
import { copyToClipboardWithToast } from "@/lib/clipboard";
import { getExperimentalFileLocationStart } from "@/lib/live-file-navigation";
import { usePluginSlots } from "@/lib/plugin-slots";

function getFileBasename(path: string): string {
  const normalizedPath = path.replace(/[\\/]+$/u, "");
  return normalizedPath.split(/[\\/]/u).at(-1) ?? path;
}

function getFileExtension(path: string): string | null {
  const name = getFileBasename(path);
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 && dotIndex < name.length - 1
    ? name.slice(dotIndex + 1).toLowerCase()
    : null;
}

/** Lazily mounted destination discovery for `experimental_FileLink`. */
export function ExperimentalFileLinkMenu({
  intent,
}: {
  intent: ExperimentalFileOpenOptions;
}) {
  const { t } = useTranslation();
  const navigation = useAppNavigationHost();
  const resolved = useResolvedLiveFileTarget(intent.target, { enabled: true });
  const localTargets = useLocalOpenTargets({
    enabled: resolved.status === "available",
    ...(resolved.status === "available"
      ? { openContext: resolved.openContext }
      : {}),
  });
  const { fileOpeners } = usePluginSlots();
  const extension = getFileExtension(intent.target.path);
  const matchingOpeners =
    extension === null
      ? []
      : fileOpeners.filter((opener) => opener.extensions.includes(extension));
  const location = getExperimentalFileLocationStart(intent.location);

  return (
    <>
      <ContextMenuItem onSelect={() => navigation.openFilePreview(intent)}>
        {t("plugin.experimentalFileLinkMenu.openPreview")}
      </ContextMenuItem>
      {matchingOpeners.length > 0 ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            {t("plugin.experimentalFileLinkMenu.openWith")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-52">
            <ContextMenuItem
              onSelect={() =>
                navigation.openFilePreview({ ...intent, viewer: "builtin" })
              }
            >
              {t("plugin.experimentalFileLinkMenu.bbPreview")}
            </ContextMenuItem>
            {matchingOpeners.map((opener) => (
              <ContextMenuItem
                key={`${opener.pluginId}:${opener.id}`}
                onSelect={() =>
                  navigation.openFilePreview({
                    ...intent,
                    viewer: {
                      pluginId: opener.pluginId,
                      openerId: opener.id,
                    },
                  })
                }
              >
                {opener.title}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      ) : null}
      <ContextMenuItem
        disabled={
          resolved.status !== "available" ||
          localTargets.isLoading ||
          !localTargets.canOpenPreferredFileTarget
        }
        onSelect={() => navigation.openFileExternally(intent)}
      >
        {t("plugin.experimentalFileLinkMenu.openExternally")}
      </ContextMenuItem>
      {resolved.status === "available" &&
      localTargets.fileOpenTargets.length > 0 ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            {t("plugin.experimentalFileLinkMenu.openIn")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-52">
            {localTargets.fileOpenTargets.map((target) => (
              <ContextMenuItem
                key={target.id}
                onSelect={() => {
                  void localTargets.openPathInFileTarget({
                    columnNumber: location.columnNumber,
                    lineNumber: location.lineNumber,
                    path: resolved.absolutePath,
                    rememberTarget: false,
                    targetId: target.id,
                  });
                }}
              >
                {target.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      ) : null}
      <ContextMenuSeparator />
      <ContextMenuItem
        onSelect={() => {
          void copyToClipboardWithToast(
            resolved.status === "available"
              ? resolved.absolutePath
              : intent.target.path,
            {
              successMessage: t(
                "plugin.experimentalFileLinkMenu.copyFilePath.success",
              ),
              errorMessage: t(
                "plugin.experimentalFileLinkMenu.copyFilePath.error",
              ),
            },
          );
        }}
      >
        {t("plugin.experimentalFileLinkMenu.copyFilePath.label")}
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() => {
          void copyToClipboardWithToast(getFileBasename(intent.target.path), {
            successMessage: t(
              "plugin.experimentalFileLinkMenu.copyFileName.success",
            ),
            errorMessage: t(
              "plugin.experimentalFileLinkMenu.copyFileName.error",
            ),
          });
        }}
      >
        {t("plugin.experimentalFileLinkMenu.copyFileName.label")}
      </ContextMenuItem>
    </>
  );
}
