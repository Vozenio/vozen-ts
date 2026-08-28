import "@/lib/i18n/promptbox";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { ThreadTimelineGoal } from "@bb/domain";
import {
  PROMPT_STACK_CARD_ROW_HEIGHT,
  PromptStackCard,
} from "@/components/promptbox/banner/PromptStackCard";
import {
  activityIconClass,
  activityRowClass,
  activityTextClass,
} from "@bb/shared-ui/activity-row-styles";
import { Icon } from "@bb/shared-ui/icon";
import { cn } from "@bb/shared-ui/lib/utils";

const GOAL_HEADER_GROUP_CLASS = activityRowClass(
  "active",
  "flex w-full items-stretch rounded-none px-0 py-0",
);
const GOAL_HEADER_BUTTON_CLASS =
  "flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-none bg-transparent px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-background/80";
const GOAL_CLEAR_BUTTON_CLASS =
  "flex min-h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-none border-l border-border/35 bg-transparent text-muted-foreground transition-colors hover:text-foreground disabled:cursor-wait disabled:text-muted-foreground/60";

function formatDuration(t: TFunction, seconds: number): string {
  if (seconds < 60) {
    return t("promptbox.threadGoalCard.durationSeconds", {
      count: Math.round(seconds),
    });
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const rest = Math.round(seconds % 60);
    return rest > 0
      ? t("promptbox.threadGoalCard.durationMinutesSeconds", {
          minutes,
          seconds: rest,
        })
      : t("promptbox.threadGoalCard.durationMinutes", { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0
    ? t("promptbox.threadGoalCard.durationHoursMinutes", {
        hours,
        minutes: restMinutes,
      })
    : t("promptbox.threadGoalCard.durationHours", { count: hours });
}

function formatTokenUsage(t: TFunction, goal: ThreadTimelineGoal): string {
  const used = goal.tokensUsed.toLocaleString();
  if (goal.tokenBudget === null) {
    return t("promptbox.threadGoalCard.tokensUsed", { used });
  }
  return t("promptbox.threadGoalCard.tokensUsedOfBudget", {
    used,
    budget: goal.tokenBudget.toLocaleString(),
  });
}

interface ThreadGoalCardProps {
  goal: ThreadTimelineGoal | null;
  isClearPending?: boolean;
  isExpanded: boolean;
  onClearGoal?: () => void;
  onToggle: () => void;
}

const BODY_ID = "thread-goal-card-body";
const TOGGLE_ID = "thread-goal-card-toggle";

/**
 * Collapsible goal card for the prompt stack above the composer. Surfaces the
 * provider's current durable objective (Codex `thread/goal/*` events projected
 * onto the timeline). Collapsed: goal state. Expanded: full objective +
 * token/time usage. Mirrors the ThreadPromptModeCard header/body split. Only
 * rendered while the goal is active — once the provider marks it complete (or
 * paused / budget-limited) it drops out of the prompt stack.
 */
export function ThreadGoalCard({
  goal,
  isClearPending = false,
  isExpanded,
  onClearGoal,
  onToggle,
}: ThreadGoalCardProps) {
  const { t } = useTranslation();
  if (!goal || goal.status !== "active") {
    return null;
  }
  const objective = goal.objective.trim();
  return (
    <PromptStackCard
      ariaLabel={t("promptbox.threadGoalCard.ariaLabel")}
      className="overflow-hidden"
      style={{ minHeight: PROMPT_STACK_CARD_ROW_HEIGHT }}
    >
      <div
        role="group"
        aria-label={t("promptbox.threadGoalCard.controlsAriaLabel")}
        className={GOAL_HEADER_GROUP_CLASS}
      >
        <button
          type="button"
          id={TOGGLE_ID}
          aria-expanded={isExpanded}
          aria-controls={BODY_ID}
          aria-label={t("promptbox.threadGoalCard.ariaLabel")}
          onClick={onToggle}
          className={GOAL_HEADER_BUTTON_CLASS}
        >
          <Icon
            name="Target"
            className={activityIconClass("active", "size-3.5 shrink-0")}
            aria-hidden="true"
          />
          <span
            className={activityTextClass(
              "active",
              "min-w-0 flex-1 truncate text-left",
            )}
          >
            {t("promptbox.threadGoalCard.ariaLabel")}
          </span>
          <Icon
            name="ChevronDown"
            className={cn(
              activityIconClass("active"),
              "size-3.5 shrink-0 transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        {onClearGoal ? (
          <button
            type="button"
            aria-label={t("promptbox.threadGoalCard.clearGoal")}
            onClick={onClearGoal}
            disabled={isClearPending}
            className={GOAL_CLEAR_BUTTON_CLASS}
          >
            <Icon
              name={isClearPending ? "Loading" : "X"}
              className={cn("size-3.5", isClearPending && "animate-spin")}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>
      <section
        id={BODY_ID}
        role="region"
        aria-labelledby={TOGGLE_ID}
        aria-hidden={!isExpanded}
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,opacity,border-color] duration-200 ease-out",
          isExpanded
            ? "grid-rows-[1fr] border-t border-border opacity-100"
            : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden bg-popover">
          <div className="space-y-2 px-3 pb-2.5 pt-2">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
              {objective.length > 0
                ? objective
                : t("promptbox.threadGoalCard.noObjective")}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  name="Zap"
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
                {formatTokenUsage(t, goal)}
              </span>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Icon
                  name="Clock"
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
                {formatDuration(t, goal.timeUsedSeconds)}
              </span>
            </div>
          </div>
        </div>
      </section>
    </PromptStackCard>
  );
}
