import "@/lib/i18n/promptbox";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@bb/shared-ui/button";
import { cn } from "@bb/shared-ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bb/shared-ui/dropdown-menu";
import {
  PluginComposerPlusMenuEntry,
  type PluginComposerPlusMenuContribution,
  type PluginComposerPlusMenuSelection,
} from "@/components/plugin/PluginComposerActions";
import { useResolvedComposerPlusMenuItems } from "@/components/plugin/composer-slot-hooks";
import { useOptionalPluginComposerView } from "@/components/plugin/plugin-composer-host";
import { Icon, type IconName } from "@bb/shared-ui/icon";
import { COARSE_POINTER_PROMPT_ICON_ACTION_BUTTON_CLASS } from "@bb/shared-ui/coarse-pointer-sizing";
import { CREATE_PLUGIN_PROMPT } from "@bb/client-core";
import type { ProviderPromptActionCommand } from "@bb/client-core";

type PromptBoxActionKind = "skills" | "plan" | "goal" | "automation" | "plugin";

export interface PromptBoxAction {
  kind: PromptBoxActionKind;
  text: string;
  command?: ProviderPromptActionCommand;
  label?: string;
  disabled?: boolean;
}

interface PromptBoxActionsMenuProps {
  actions?: readonly PromptBoxAction[];
  isAttaching?: boolean;
  onAttach?: () => void;
  onAction: (action: PromptBoxAction) => void;
  pluginItems?: readonly PluginComposerPlusMenuContribution[];
}

export function ComposerPlusMenuSlot({
  includePluginContributions = true,
  ...props
}: Omit<PromptBoxActionsMenuProps, "pluginItems"> & {
  includePluginContributions?: boolean;
}) {
  const view = useOptionalPluginComposerView();
  const pluginItems = useResolvedComposerPlusMenuItems(
    includePluginContributions ? (view?.scope.kind ?? null) : null,
  );
  return <PromptBoxActionsMenu {...props} pluginItems={pluginItems} />;
}

export const AUTOMATION_PROMPT_ACTION: PromptBoxAction = {
  kind: "automation",
  command: { trigger: "/", name: "automation", trailingText: " " },
  text: "/automation ",
};

/**
 * Seeds the composer with the plugin prompt prefix the plugin library uses, so
 * the user finishes one sentence and the agent reaches the plugin-authoring
 * skill. There is no provider command for it, so the text is inserted as is.
 */
export const CREATE_PLUGIN_PROMPT_ACTION: PromptBoxAction = {
  kind: "plugin",
  text: CREATE_PLUGIN_PROMPT,
};

const PROMPT_ACTION_ORDER: readonly PromptBoxActionKind[] = [
  "skills",
  "plan",
  "goal",
  "automation",
  "plugin",
];

function getPromptActionPresentation(
  t: TFunction,
): Record<PromptBoxActionKind, { label: string; icon: IconName }> {
  return {
    skills: {
      label: t("promptbox.promptBoxActionsMenu.skills"),
      icon: "Zap",
    },
    plan: {
      label: t("promptbox.promptBoxActionsMenu.plan"),
      icon: "ListTodo",
    },
    goal: {
      label: t("promptbox.promptBoxActionsMenu.goal"),
      icon: "Target",
    },
    automation: {
      label: t("promptbox.promptBoxActionsMenu.automation"),
      icon: "Repeat",
    },
    // The icons follow the Tools navigation sections, so "Skills" and "Plugin"
    // read the same here as they do in the sidebar. See tools-navigation.ts.
    plugin: {
      label: t("promptbox.promptBoxActionsMenu.plugin"),
      icon: "ElectricPlugs",
    },
  };
}

/**
 * Adds the app-owned prompt actions to the provider-owned ones. Providers
 * describe only their own composer commands, so bb appends the actions it owns
 * itself and keeps a provider entry when the provider already supplies one.
 */
export function withAppPromptActions(
  actions: readonly PromptBoxAction[],
): PromptBoxAction[] {
  const appActions = [AUTOMATION_PROMPT_ACTION, CREATE_PLUGIN_PROMPT_ACTION];
  return [
    ...actions,
    ...appActions.filter(
      (appAction) => !actions.some((action) => action.kind === appAction.kind),
    ),
  ];
}

function orderedPromptActions(
  actions: readonly PromptBoxAction[],
): PromptBoxAction[] {
  return PROMPT_ACTION_ORDER.flatMap((kind) => {
    const action = actions.find((candidate) => candidate.kind === kind);
    return action ? [action] : [];
  });
}

export function PromptBoxActionsMenu({
  actions = [],
  isAttaching = false,
  onAttach,
  onAction,
  pluginItems = [],
}: PromptBoxActionsMenuProps) {
  const { t } = useTranslation();
  const presentationMap = getPromptActionPresentation(t);
  const selectedItemRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pluginSelectionRef = useRef<PluginComposerPlusMenuSelection | null>(
    null,
  );
  const visibleActions = orderedPromptActions(actions).filter(
    (action) => action.text.length > 0,
  );
  const clearSelectedActionAfterClose = useCallback(() => {
    const clear = () => {
      selectedItemRef.current = false;
      pluginSelectionRef.current = null;
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(clear);
      return;
    }
    setTimeout(clear, 0);
  }, []);
  const restorePluginComposerFocus = useCallback(
    (selection: PluginComposerPlusMenuSelection) => {
      const activeElement = document.activeElement;
      const pluginMovedFocus =
        activeElement !== null &&
        activeElement !== document.body &&
        activeElement !== triggerRef.current &&
        activeElement !== selection.selectedElement &&
        activeElement.isConnected;
      if (!pluginMovedFocus) {
        selection.restoreComposerFocus();
      }
    },
    [],
  );

  if (visibleActions.length === 0 && !onAttach && pluginItems.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={(open) => {
        if (!open) {
          clearSelectedActionAfterClose();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t("promptbox.promptBoxActionsMenu.promptActions")}
          className={cn(
            COARSE_POINTER_PROMPT_ICON_ACTION_BUTTON_CLASS,
            // Outdent so the "+" glyph lines up with the placeholder/text
            // (toolbar px-3.5 + button px-2 sits 6px right of the editor's px-4).
            "-ml-1.5",
          )}
        >
          <Icon
            name={isAttaching ? "Spinner" : "Plus"}
            className={cn("size-4", isAttaching && "animate-spin")}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label={t("promptbox.promptBoxActionsMenu.promptActions")}
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-36"
        mobileTitle={t("promptbox.promptBoxActionsMenu.promptActions")}
        onCloseAutoFocus={(event) => {
          if (selectedItemRef.current) {
            event.preventDefault();
            const pluginSelection = pluginSelectionRef.current;
            if (pluginSelection) {
              restorePluginComposerFocus(pluginSelection);
            }
          }
        }}
      >
        {onAttach ? (
          <>
            <DropdownMenuItem
              disabled={isAttaching}
              onSelect={() => {
                selectedItemRef.current = true;
                onAttach();
              }}
            >
              <Icon
                name={isAttaching ? "Spinner" : "Paperclip"}
                className={cn(
                  "size-4 text-muted-foreground",
                  isAttaching && "animate-spin",
                )}
                aria-hidden
              />
              {t("promptbox.promptBoxActionsMenu.attachFiles")}
            </DropdownMenuItem>
            {visibleActions.length > 0 ? <DropdownMenuSeparator /> : null}
          </>
        ) : null}
        {visibleActions.map((action) => {
          const presentation = presentationMap[action.kind];
          return (
            <DropdownMenuItem
              key={action.kind}
              disabled={action.disabled}
              onSelect={() => {
                selectedItemRef.current = true;
                onAction(action);
              }}
            >
              <Icon
                name={presentation.icon}
                className="size-4 text-muted-foreground"
                aria-hidden
              />
              {action.label ?? presentation.label}
            </DropdownMenuItem>
          );
        })}
        {pluginItems.length > 0 ? <DropdownMenuSeparator /> : null}
        {pluginItems.map((contribution, index) => {
          const contributingPluginCount = new Set(
            pluginItems.map((candidate) => candidate.pluginId),
          ).size;
          const previous = pluginItems[index - 1];
          const startsPluginGroup =
            contributingPluginCount >= 2 &&
            previous?.pluginId !== contribution.pluginId;
          return (
            <PluginComposerPlusMenuEntry
              key={contribution.key}
              contribution={contribution}
              showPluginLabel={startsPluginGroup}
              onSelected={(selection) => {
                selectedItemRef.current = true;
                pluginSelectionRef.current = selection;
                queueMicrotask(() => restorePluginComposerFocus(selection));
              }}
            />
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
