import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "@bb/shared-ui/icon";
import { usePrefersReducedMotion } from "@bb/shared-ui/hooks/use-media-query";
import vozenLogoUrl from "../../assets/vozen-logo.svg";

interface RootComposeEmptyWelcomeProps {
  /** Reveal the composer, optionally prefilled with a starter prompt. */
  onCompose: (prompt?: string) => void;
  onAddProject: () => void;
  addProjectDisabled?: boolean;
}

interface WelcomeActionProps {
  icon: IconName;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}

function WelcomeAction({
  icon,
  title,
  description,
  onClick,
  disabled,
}: WelcomeActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-state-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    >
      <Icon
        name={icon}
        aria-hidden
        className="size-5 shrink-0 text-subtle-foreground group-hover:text-foreground"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

/**
 * Centered branded landing shown on the root compose page when the user has no
 * projects yet. Mirrors a logo-over-actions welcome layout: a dimensional bb
 * mark sits above the primary "get started" actions.
 */
export function RootComposeEmptyWelcome({
  onCompose,
  onAddProject,
  addProjectDisabled,
}: RootComposeEmptyWelcomeProps) {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const importProjectsPrompt = t(
    "views.rootCompose.emptyWelcome.importProjectsPrompt",
  );
  const learnPrompt = t("views.rootCompose.emptyWelcome.learnPrompt");
  return (
    <div className="flex flex-col items-center gap-12 duration-500 animate-in fade-in-0 slide-in-from-bottom-2">
      <svg aria-hidden className="absolute h-0 w-0" focusable="false">
        <defs>
          <filter
            id="bb-gloss"
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="bump" />
            <feSpecularLighting
              in="bump"
              surfaceScale="5"
              specularConstant="0.85"
              specularExponent="18"
              lightingColor="#ffffff"
              result="spec"
            >
              <fePointLight x="40" y="10" z="80">
                {reducedMotion ? null : (
                  <animate
                    attributeName="x"
                    dur="5s"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keyTimes="0;0.5;1"
                    values="-170;270;-170"
                    keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
                  />
                )}
              </fePointLight>
            </feSpecularLighting>
            <feMorphology
              in="SourceAlpha"
              operator="erode"
              radius="0.75"
              result="innerAlpha"
            />
            <feComposite
              in="spec"
              in2="innerAlpha"
              operator="in"
              result="specClip"
            />
            <feComposite
              in="SourceGraphic"
              in2="specClip"
              operator="arithmetic"
              k1="0"
              k2="1"
              k3="1"
              k4="0"
            />
          </filter>
        </defs>
      </svg>
      <div
        role="img"
        aria-label="vozen"
        className="h-24 w-28 select-none"
        style={{ filter: "url(#bb-gloss)" }}
      >
        <img
          src={vozenLogoUrl}
          alt=""
          aria-hidden
          draggable={false}
          className="size-full object-contain dark:invert"
        />
      </div>
      <div className="flex w-full max-w-[360px] flex-col gap-1">
        <WelcomeAction
          icon="MessageSquarePlus"
          title={t("views.rootCompose.emptyWelcome.newThread.title")}
          description={t(
            "views.rootCompose.emptyWelcome.newThread.description",
          )}
          onClick={() => onCompose()}
        />
        <WelcomeAction
          icon="FolderGit"
          title={t("views.rootCompose.emptyWelcome.importProjects.title")}
          description={t(
            "views.rootCompose.emptyWelcome.importProjects.description",
          )}
          onClick={() => onCompose(importProjectsPrompt)}
        />
        <WelcomeAction
          icon="FolderPlus"
          title={t("views.rootCompose.emptyWelcome.newProject.title")}
          description={t(
            "views.rootCompose.emptyWelcome.newProject.description",
          )}
          onClick={onAddProject}
          disabled={addProjectDisabled}
        />
        <WelcomeAction
          icon="Explore"
          title={t("views.rootCompose.emptyWelcome.learn.title")}
          description={t("views.rootCompose.emptyWelcome.learn.description")}
          onClick={() => onCompose(learnPrompt)}
        />
      </div>
    </div>
  );
}
