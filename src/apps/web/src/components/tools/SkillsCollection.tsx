import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import i18next, { type TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { SkillProvider, SkillSummary } from "@bb/server-contract";
import {
  ResourceInfiniteScrollSentinel,
  useResourceInfiniteItems,
  useResourceViewportPageSize,
} from "@bb/shared-ui/resource-pagination";
import {
  ResourceCollectionPage,
  ResourceCollectionViewport,
  ResourceListPanel,
  ResourceFilterMenu,
  ResourceListState,
  ResourceOverflowMenu,
  ResourceRow,
  ResourceRowDetailChevron,
  ResourceSortMenu,
  ResourceToolbar,
} from "@bb/shared-ui/resource-list";
import { VozenLogo } from "@/components/ui/vozen-logo";
import {
  ConfirmDeleteDialog,
  ConfirmDeleteDialogContent,
} from "@/components/dialogs/ConfirmDeleteDialog";
import { CreateWithTemplatesButton } from "@/components/create-via-prompt-examples";
import { ProvenancePill } from "@/components/tools/ProvenancePill";
import { SkillDetailView } from "@/components/tools/SkillDetailView";
import { TOOLS_PAGE_BAND_CLASSES } from "@/components/tools/tools-navigation";
import { skillScopeLabel } from "@/components/tools/skill-taxonomy";
import type { ProviderInfo } from "@bb/domain";
import { ProviderIconMark } from "@/components/settings/ProviderIconMark";
import { getProviderIconInfo } from "@/lib/provider-icon";

type ResourceProviderFilter = "bb" | SkillProvider;
/**
 * Provider id → the server's `ProviderInfo`, for every listed provider: the
 * display name and the declared mark (core vendors neither).
 */
export type ProviderRoster = ReadonlyMap<string, ProviderInfo>;
type ResourceSkillSourceFilter = "included" | "bb-official" | "user";
type ResourceSortMode = "provider" | "alpha";
type ResourceSortDirection = "asc" | "desc";

const RESOURCE_SKILL_SOURCE_FILTERS: readonly ResourceSkillSourceFilter[] = [
  "included",
  "bb-official",
  "user",
];

function sourceFilterOptions(): {
  id: ResourceSkillSourceFilter;
  label: string;
}[] {
  return RESOURCE_SKILL_SOURCE_FILTERS.map((source) => ({
    id: source,
    label: skillSourceFilterLabel(source),
  }));
}

/**
 * Names a provider the way the rest of the app does: the server's display name
 * first. Without the roster the fallback is the icon's aria label, and a
 * caller holding only an id cannot reach one for an unregistered agent, so
 * the label degrades to the raw provider id in the filter menu, the scope
 * label, and search.
 */
function providerLabel(
  provider: SkillProvider | null,
  providerRoster: ProviderRoster,
): string {
  if (provider === null) return "vozen";
  return providerRoster.get(provider)?.displayName ?? provider;
}

function skillProviderFilterId(skill: SkillSummary): ResourceProviderFilter {
  return skill.provider ?? "bb";
}

function providerFilterLabel(
  provider: ResourceProviderFilter,
  providerRoster: ProviderRoster,
): string {
  return provider === "bb"
    ? "vozen"
    : providerLabel(provider, providerRoster);
}

function skillSourceFilterId(skill: SkillSummary): ResourceSkillSourceFilter {
  if (skill.scope === "bb-builtin") return "bb-official";
  if (skill.scope === "plugin") return "included";
  // Every remaining scope is authored by the user, so the bucket is total and
  // the filter can never strand a skill.
  return "user";
}

function skillSourceFilterLabel(source: ResourceSkillSourceFilter): string {
  switch (source) {
    case "bb-official":
      return i18next.t("tools.skillsCollection.source.bbOfficial", "BB Official");
    case "included":
      return i18next.t(
        "tools.skillsCollection.source.includedInPlugin",
        "Included in plugin",
      );
    case "user":
      return i18next.t("tools.skillsCollection.source.user", "User");
  }
}

function isResourceSkillSourceFilter(
  value: string,
): value is ResourceSkillSourceFilter {
  return value === "included" || value === "bb-official" || value === "user";
}

// The filter menu hands back plain strings. Provider ids are an open
// vocabulary now, so completeness of the option list comes from deriving it
// from the listed skills rather than from a closed table; this only rejects
// the empty string, which is not a provider id.
function isResourceProviderFilter(
  value: string,
): value is ResourceProviderFilter {
  return value !== "";
}

export function ProviderLogo({
  providerId,
  provider,
  className,
}: {
  providerId: SkillProvider;
  /** The roster entry; without it only a plugin-registered icon can draw. */
  provider?: ProviderInfo | undefined;
  className?: string;
}) {
  const info = getProviderIconInfo(providerId, provider ?? null);
  if (!info) {
    return null;
  }
  if (provider === undefined) {
    const LogoIcon = info.icon;
    return <LogoIcon className={className} />;
  }
  return (
    <ProviderIconMark provider={provider} icon={info.icon} className={className} />
  );
}

export function SkillProvenanceTooltip({
  prefix,
  providerId,
  provider,
  name,
}: {
  prefix: string;
  providerId: SkillProvider | null;
  provider?: ProviderInfo | undefined;
  name: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{prefix}</span>
      <span data-provider-icon={providerId ?? "bb"} aria-hidden="true">
        {providerId === null ? (
          <VozenLogo className="size-3.5 brightness-0 invert" />
        ) : (
          <ProviderLogo
            providerId={providerId}
            provider={provider}
            className="size-3.5"
          />
        )}
      </span>
      <span>{name}</span>
    </span>
  );
}

function SkillLeading({
  skill,
  providerRoster,
}: {
  skill: SkillSummary;
  providerRoster: ProviderRoster;
}) {
  if (skill.provider !== null) {
    return (
      <ProviderLogo
        providerId={skill.provider}
        provider={providerRoster.get(skill.provider)}
        className="size-6"
      />
    );
  }
  return <VozenLogo className="size-6" />;
}

function skillDescription(
  skill: SkillSummary,
  providerRoster: ProviderRoster,
): string {
  return (
    skill.description ??
    skillScopeLabel(skill, providerLabelForScope(skill, providerRoster))
  );
}

function providerLabelForScope(
  skill: SkillSummary,
  providerRoster: ProviderRoster,
): string | undefined {
  return skill.provider === null
    ? undefined
    : providerRoster.get(skill.provider)?.displayName;
}

function providerPluginNameForSkill(skill: SkillSummary): string {
  if (skill.pluginId !== null) return skill.pluginId;
  const separatorIndex = skill.name.indexOf(":");
  return separatorIndex > 0 ? skill.name.slice(0, separatorIndex) : skill.name;
}

function providerPluginDisplayName(skill: SkillSummary): string {
  const name = providerPluginNameForSkill(skill).replace(/[-_]+/gu, " ");
  return name.length === 0 ? name : name[0].toUpperCase() + name.slice(1);
}

function includedPluginDescription(
  skill: SkillSummary,
  providerRoster: ProviderRoster,
): string {
  return i18next.t(
    "tools.skillsCollection.includedPluginDescription",
    "{{pluginName}} ({{provider}} plugin)",
    {
      pluginName: providerPluginDisplayName(skill),
      provider: providerLabel(skill.provider, providerRoster),
    },
  );
}

function skillMutationDisabledReason(
  skill: SkillSummary,
  providerRoster: ProviderRoster,
): string {
  if (skill.scope === "bb-builtin") {
    return i18next.t(
      "tools.skillsCollection.disabledReason.builtIn",
      "Built-in skill",
    );
  }
  if (skill.scope === "plugin") {
    return i18next.t(
      "tools.skillsCollection.disabledReason.bundledWithPlugin",
      "Bundled with plugin",
    );
  }
  return i18next.t(
    "tools.skillsCollection.disabledReason.bundledWithProvider",
    "Bundled with {{provider}}",
    { provider: providerLabel(skill.provider, providerRoster) },
  );
}

/**
 * Each Skills page describes its own purpose: Browse speaks to discovery from
 * the open ecosystem, the library to managing what this host already has.
 */
function skillsBrowseDescription(t: TFunction): ReactNode {
  return (
    <>
      {t(
        "tools.skillsCollection.browseDescriptionPrefix",
        "Trending agent skills from ",
      )}
      <a
        href="https://skills.sh"
        target="_blank"
        rel="noreferrer"
        className="rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        skills.sh
      </a>
      {t(
        "tools.skillsCollection.browseDescriptionSuffix",
        ". Install one and every agent you use in vozen can run it.",
      )}
    </>
  );
}
function skillsLibraryDescription(t: TFunction): string {
  return t(
    "tools.skillsCollection.libraryDescription",
    "The skills on this vozen host — yours, your providers', and those bundled with plugins. They work with every agent you use in bb.",
  );
}

/**
 * How long the pointer (or focus) must rest on a row before its detail
 * queries warm. Raw enter events would turn one sweep of the cursor down the
 * list into a prefetch per row — two requests each — for rows the user never
 * meant to open.
 */
const PREFETCH_HOVER_INTENT_MS = 150;

function SkillRow({
  skill,
  providerRoster,
  onSelect,
  onPrefetch,
}: {
  skill: SkillSummary;
  providerRoster: ProviderRoster;
  onSelect: () => void;
  /** Warms the detail queries on intent; the connected layer supplies it. */
  onPrefetch?: (skill: SkillSummary) => void;
}) {
  const { t } = useTranslation();
  const description = skillDescription(skill, providerRoster);
  const prefetchTimer = useRef<number | null>(null);
  const cancelScheduledPrefetch = () => {
    if (prefetchTimer.current === null) return;
    window.clearTimeout(prefetchTimer.current);
    prefetchTimer.current = null;
  };
  const schedulePrefetch = () => {
    if (prefetchTimer.current !== null) return;
    prefetchTimer.current = window.setTimeout(() => {
      prefetchTimer.current = null;
      onPrefetch?.(skill);
    }, PREFETCH_HOVER_INTENT_MS);
  };
  useEffect(() => cancelScheduledPrefetch, []);
  return (
    // ResourceRow keeps its narrow prop surface; the intent listeners live on
    // a wrapper (React delegates these events, so this covers the whole row).
    <div
      onPointerEnter={schedulePrefetch}
      onPointerLeave={cancelScheduledPrefetch}
      onFocus={schedulePrefetch}
      onBlur={cancelScheduledPrefetch}
    >
      <ResourceRow
        leading={<SkillLeading skill={skill} providerRoster={providerRoster} />}
        title={skill.name}
        titleMeta={
          skill.scope === "bb-builtin" ? (
            <ProvenancePill
              label={t("tools.skillsCollection.bbOfficial", "BB Official")}
            />
          ) : skill.scope === "plugin" ? (
            <ProvenancePill
              label={t("tools.skillsCollection.included", "Included")}
              tooltip={
                <SkillProvenanceTooltip
                  prefix={t(
                    "tools.skillsCollection.includedWithPrefix",
                    "Included with",
                  )}
                  providerId={skill.provider}
                  provider={
                    skill.provider === null
                      ? undefined
                      : providerRoster.get(skill.provider)
                  }
                  name={t(
                    "tools.skillsCollection.pluginSuffix",
                    "{{pluginName}} plugin.",
                    { pluginName: providerPluginDisplayName(skill) },
                  )}
                />
              }
              accessibleLabel={t(
                "tools.skillsCollection.isIncludedWithAccessibleLabel",
                "{{name}} is included with {{description}}",
                {
                  name: skill.name,
                  description: includedPluginDescription(skill, providerRoster),
                },
              )}
            />
          ) : undefined
        }
        description={description}
        onOpen={onSelect}
        trailingVisual={<ResourceRowDetailChevron />}
      />
    </div>
  );
}

interface SkillsOverviewProps {
  skills: readonly SkillSummary[];
  /**
   * Provider display names from the server roster. Provider ids are
   * open-ended (every custom ACP agent is one), so without the roster an
   * agent labels itself with its raw provider id.
   */
  providerRoster: ProviderRoster;
  isLoading: boolean;
  hasError: boolean;
  query?: string;
  activeMode?: SkillsCollectionMode;
  browseContent?: ReactNode;
  /** Opens the composer to create a skill, optionally seeded with a full prompt. */
  onCreateSkill: (prompt?: string) => void;
  onSelectSkill: (skill: SkillSummary) => void;
  /** Warms a skill's detail queries from row hover/focus. */
  onPrefetchSkill?: (skill: SkillSummary) => void;
  onQueryChange?: (query: string) => void;
  /** Refetch after a load failure — gives the error state a way out. */
  onRetry?: () => void;
}

type SkillsCollectionMode = "library" | "browse";

/**
 * Presentational Skills list: provider-grouped, searchable, typeahead-style
 * rows. Split from the data-fetching container so it renders in tests/stories.
 */
export function SkillsOverview({
  skills,
  providerRoster,
  isLoading,
  hasError,
  query = "",
  activeMode = "library",
  browseContent,
  onCreateSkill,
  onSelectSkill,
  onPrefetchSkill,
  onQueryChange = () => {},
  onRetry,
}: SkillsOverviewProps) {
  const { t } = useTranslation();
  const [providerFilters, setProviderFilters] = useState<
    ResourceProviderFilter[]
  >(["bb"]);
  // Empty means unfiltered: the menu has no explicit "All" row.
  const [sourceFilters, setSourceFilters] = useState<
    ResourceSkillSourceFilter[]
  >([]);
  const [sortMode, setSortMode] = useState<ResourceSortMode>("alpha");
  const [sortDirection, setSortDirection] =
    useState<ResourceSortDirection>("asc");
  const [libraryViewport, setLibraryViewport] = useState<HTMLDivElement | null>(
    null,
  );
  const normalizedQuery = query.trim().toLowerCase();
  // One projection identity for both the page selection and the row heights
  // the page size is measured from.
  const libraryResetKey = [
    normalizedQuery,
    providerFilters.join(","),
    sourceFilters.join(","),
    sortMode,
    sortDirection,
  ].join("\u0000");
  const libraryPageSize = useResourceViewportPageSize(libraryViewport, {
    resetKey: libraryResetKey,
  });
  const providerCounts = useMemo(() => {
    const counts = new Map<ResourceProviderFilter, number>();
    for (const skill of skills) {
      const provider = skillProviderFilterId(skill);
      counts.set(provider, (counts.get(provider) ?? 0) + 1);
    }
    return counts;
  }, [skills]);
  const providerBucketCount = providerCounts.size;
  // Derived from the listed skills (plus any still-selected filter) so a
  // provider bb has never heard of still gets a filter row. "bb" leads;
  // the rest sort by display label, which reproduces the order the old
  // hardcoded table hardcoded.
  const providerOptions = useMemo(() => {
    const present = new Set<ResourceProviderFilter>([
      "bb",
      ...providerCounts.keys(),
      ...providerFilters,
    ]);
    const ordered = [...present].sort((left, right) =>
      left === "bb" || right === "bb"
        ? Number(left !== "bb") - Number(right !== "bb")
        : providerFilterLabel(left, providerRoster).localeCompare(
            providerFilterLabel(right, providerRoster),
          ),
    );
    return ordered.map((provider) => ({
      id: provider,
      label: providerFilterLabel(provider, providerRoster),
      leading:
        provider === "bb" ? (
          <VozenLogo className="size-4" />
        ) : (
          <ProviderLogo
            providerId={provider}
            provider={providerRoster.get(provider)}
            className="size-4"
          />
        ),
      disabled:
        !providerCounts.has(provider) && !providerFilters.includes(provider),
    }));
  }, [providerCounts, providerRoster, providerFilters]);
  useEffect(() => {
    if (sortMode === "provider" && providerBucketCount <= 1) {
      setSortMode("alpha");
      setSortDirection("asc");
    }
  }, [providerBucketCount, sortMode]);
  const visibleSkills = useMemo(() => {
    const filtered = skills.filter((skill) => {
      const source = skillSourceFilterId(skill);
      if (sourceFilters.length > 0 && !sourceFilters.includes(source)) {
        return false;
      }
      if (
        providerFilters.length > 0 &&
        !providerFilters.includes(skillProviderFilterId(skill))
      ) {
        return false;
      }
      return (
        normalizedQuery === "" ||
        [
          skill.name,
          skill.description ?? "",
          providerLabel(skill.provider, providerRoster),
          skillScopeLabel(
            skill,
            providerLabelForScope(skill, providerRoster),
          ),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      );
    });
    return [...filtered].sort((left, right) => {
      if (providerFilters.length === 1 && providerFilters[0] === "bb") {
        const officialResult =
          Number(left.scope !== "bb-builtin") -
          Number(right.scope !== "bb-builtin");
        if (officialResult !== 0) return officialResult;
      }
      const base =
        sortMode === "provider"
          ? providerLabel(left.provider, providerRoster).localeCompare(
              providerLabel(right.provider, providerRoster),
            ) || left.name.localeCompare(right.name)
          : left.name.localeCompare(right.name);
      if (base !== 0) return sortDirection === "asc" ? base : -base;
      return left.filePath.localeCompare(right.filePath);
    });
  }, [
    normalizedQuery,
    providerRoster,
    providerFilters,
    skills,
    sortDirection,
    sortMode,
    sourceFilters,
  ]);
  // Rows accumulate as the sentinel scrolls into view; the page machinery
  // (viewport-fit chunk size, projection reset keys) stays underneath.
  const libraryList = useResourceInfiniteItems(visibleSkills, {
    pageSize: libraryPageSize,
    resetKey: libraryResetKey,
  });
  const handleSortChange = useCallback(
    (nextSort: string) => {
      if (nextSort !== "provider" && nextSort !== "alpha") return;
      if (nextSort === "provider" && providerBucketCount <= 1) return;
      if (nextSort === sortMode) {
        setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
        return;
      }
      setSortMode(nextSort);
      setSortDirection("asc");
    },
    [providerBucketCount, sortMode],
  );
  const libraryBody = hasError ? (
    <ResourceListState
      state="error"
      message={t("tools.skillsCollection.loadSkillsError", "Couldn't load skills.")}
      onRetry={onRetry}
    />
  ) : isLoading ? (
    <ResourceListState
      state="loading"
      message={t("tools.skillsCollection.loadingSkills", "Loading skills")}
    />
  ) : visibleSkills.length === 0 ? (
    <ResourceListState
      state="empty"
      message={
        // Naming only the query would misattribute the empty result when a
        // filter is what emptied it — clearing the search would still show
        // nothing.
        normalizedQuery === ""
          ? skills.length === 0
            ? t(
                "tools.skillsCollection.emptyNoSkillsInLibrary",
                "No skills in your library.",
              )
            : t(
                "tools.skillsCollection.emptyNoSkillsMatchFilters",
                "No skills match these filters.",
              )
          : sourceFilters.length > 0 || providerFilters.length > 0
            ? t(
                "tools.skillsCollection.emptyNoSkillsMatchQueryWithFilters",
                'No skills match "{{query}}" with these filters.',
                { query },
              )
            : t(
                "tools.skillsCollection.emptyNoSkillsMatchQuery",
                'No skills match "{{query}}"',
                { query },
              )
      }
    />
  ) : (
    <>
      <ResourceListPanel>
        {libraryList.items.map((skill) => (
          <SkillRow
            key={`${skill.scope}-${skill.provider ?? "bb"}-${skill.name}-${skill.filePath}`}
            skill={skill}
            providerRoster={providerRoster}
            onSelect={() => onSelectSkill(skill)}
            onPrefetch={onPrefetchSkill}
          />
        ))}
      </ResourceListPanel>
      <ResourceInfiniteScrollSentinel
        hasMore={libraryList.hasMore}
        onLoadMore={libraryList.loadMore}
      />
    </>
  );

  return (
    // Browse and Library are separate top-nav destinations; the page renders
    // whichever the URL selects and carries no tab layer of its own. Each
    // describes its own purpose — discovery vs. managing what you have.
    <ResourceCollectionPage
      id="skills-collection"
      description={
        activeMode === "browse"
          ? skillsBrowseDescription(t)
          : skillsLibraryDescription(t)
      }
      bandClassName={TOOLS_PAGE_BAND_CLASSES}
    >
      {activeMode === "browse" ? (
        browseContent
      ) : (
        <ResourceCollectionViewport
          scrollId="skills-library-results"
          viewportRef={setLibraryViewport}
          bandClassName={TOOLS_PAGE_BAND_CLASSES}
          toolbar={
            <ResourceToolbar
              searchValue={query}
              searchPlaceholder={t(
                "tools.skillsCollection.searchPlaceholder",
                "Search skills",
              )}
              onSearchChange={onQueryChange}
              action={
                <CreateWithTemplatesButton
                  kind="skill"
                  label={t("tools.skillsCollection.newBbSkill", "New vozen skill")}
                  onCreate={onCreateSkill}
                />
              }
              controls={
                <>
                  <ResourceFilterMenu
                    compact
                    groups={[
                      {
                        id: "type",
                        label: t("tools.skillsCollection.typeFilterLabel", "Type"),
                        options: sourceFilterOptions(),
                        selectedValues: sourceFilters,
                        onChange: (values) =>
                          setSourceFilters(
                            values.filter(isResourceSkillSourceFilter),
                          ),
                      },
                      {
                        id: "provider",
                        label: t(
                          "tools.skillsCollection.providerFilterLabel",
                          "Provider",
                        ),
                        options: providerOptions,
                        selectedValues: providerFilters,
                        onChange: (values) =>
                          setProviderFilters(
                            values.filter(isResourceProviderFilter),
                          ),
                      },
                    ]}
                  />
                  <ResourceSortMenu
                    value={sortMode}
                    direction={sortDirection}
                    compact
                    options={[
                      {
                        id: "provider",
                        label: t(
                          "tools.skillsCollection.providerSortLabel",
                          "Provider",
                        ),
                        disabled: providerBucketCount <= 1,
                      },
                      {
                        id: "alpha",
                        label: t(
                          "tools.skillsCollection.skillNameSortLabel",
                          "Skill name",
                        ),
                      },
                    ]}
                    onChange={handleSortChange}
                  />
                </>
              }
            />
          }
        >
          <div className={TOOLS_PAGE_BAND_CLASSES}>{libraryBody}</div>
        </ResourceCollectionViewport>
      )}
    </ResourceCollectionPage>
  );
}

interface SkillDetailDialogViewProps {
  skill: SkillSummary | null;
  /** See {@link SkillsOverviewProps.providerRoster}. */
  providerRoster: ProviderRoster;
  files: readonly string[];
  selectedPath: string;
  onSelectPath: (path: string) => void;
  content: string;
  isLoadingContent: boolean;
  isContentError: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canOpenInEditor: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onRetry: () => void;
  onDelete: () => void;
  onOpenInEditor: () => void;
}

/**
 * Presentational skill detail page: renders the SKILL.md with Edit / Delete /
 * Open-source affordances. Editing starts a resource-scoped thread; direct
 * source opening remains a separate action. The connected
 * {@link SkillDetailPage} wires it to the content/update/delete queries.
 */
export function SkillDetailDialogView({
  skill,
  providerRoster,
  files,
  selectedPath,
  onSelectPath,
  content,
  isLoadingContent,
  isContentError,
  canEdit,
  canDelete,
  canOpenInEditor,
  isDeleting,
  onEdit,
  onRetry,
  onDelete,
  onOpenInEditor,
}: SkillDetailDialogViewProps) {
  const { t } = useTranslation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
  }, [skill?.id]);

  if (skill === null) return null;
  const bundledPluginName =
    skill.scope === "plugin" ? providerPluginNameForSkill(skill) : null;
  const disabledReason = skillMutationDisabledReason(skill, providerRoster);
  const canEditSelectedPath = canEdit && selectedPath === "SKILL.md";
  const headerActions =
    skill.scope !== "plugin" &&
    (canEdit || canDelete || canOpenInEditor) &&
    !confirmingDelete ? (
      <ResourceOverflowMenu
        label={t("tools.skillsCollection.actionsAriaLabel", "{{name}} actions", {
          name: skill.name,
        })}
        items={[
          {
            label: t("tools.skillsCollection.edit", "Edit"),
            icon: "Edit" as const,
            disabled: !canEditSelectedPath,
            disabledReason: !canEdit
              ? disabledReason
              : selectedPath !== "SKILL.md"
                ? t(
                    "tools.skillsCollection.onlySkillMdEditable",
                    "Only SKILL.md can be edited",
                  )
                : undefined,
            onSelect: onEdit,
          },
          ...(canOpenInEditor
            ? [
                {
                  label: t("tools.skillsCollection.openSource", "Open source"),
                  icon: "ExternalLink" as const,
                  onSelect: onOpenInEditor,
                },
              ]
            : []),
          { kind: "separator" as const },
          {
            label: t("tools.skillsCollection.delete", "Delete"),
            icon: "Trash2" as const,
            tone: "destructive" as const,
            disabled: !canDelete,
            disabledReason: !canDelete ? disabledReason : undefined,
            onSelect: () => setConfirmingDelete(true),
          },
        ]}
      />
    ) : null;
  return (
    <SkillDetailView
      leading={<SkillLeading skill={skill} providerRoster={providerRoster} />}
      title={skill.name}
      path={skill.filePath}
      titleBadge={
        skill.scope === "bb-builtin"
          ? {
              label: t("tools.skillsCollection.bbOfficial", "BB Official"),
              tooltip: t("tools.skillsCollection.shipsWithBb", "Ships with vozen"),
              accessibleLabel: t(
                "tools.skillsCollection.isBbOfficialAccessibleLabel",
                "{{name}} is BB Official",
                { name: skill.name },
              ),
            }
          : bundledPluginName !== null
            ? {
                label: t("tools.skillsCollection.included", "Included"),
                tooltip: (
                  <SkillProvenanceTooltip
                    prefix={t(
                      "tools.skillsCollection.includedWithPrefix",
                      "Included with",
                    )}
                    providerId={skill.provider}
                    provider={
                      skill.provider === null
                        ? undefined
                        : providerRoster.get(skill.provider)
                    }
                    name={t(
                      "tools.skillsCollection.pluginSuffix",
                      "{{pluginName}} plugin.",
                      { pluginName: providerPluginDisplayName(skill) },
                    )}
                  />
                ),
                accessibleLabel: t(
                  "tools.skillsCollection.isIncludedWithAccessibleLabel",
                  "{{name}} is included with {{description}}",
                  {
                    name: skill.name,
                    description: includedPluginDescription(
                      skill,
                      providerRoster,
                    ),
                  },
                ),
              }
            : skill.provider !== null
              ? {
                  label: t("tools.skillsCollection.imported", "Imported"),
                  tooltip: (
                    <SkillProvenanceTooltip
                      prefix={t(
                        "tools.skillsCollection.discoveredFromPrefix",
                        "Discovered from",
                      )}
                      providerId={skill.provider}
                      provider={providerRoster.get(skill.provider)}
                      name={providerLabel(skill.provider, providerRoster)}
                    />
                  ),
                  accessibleLabel: t(
                    "tools.skillsCollection.isImportedFromAccessibleLabel",
                    "{{name}} is imported from {{provider}}",
                    {
                      name: skill.name,
                      provider: providerLabel(skill.provider, providerRoster),
                    },
                  ),
                }
              : undefined
      }
      files={files.length > 0 ? files : ["SKILL.md"]}
      selectedPath={selectedPath}
      onSelectFile={onSelectPath}
      contentState={
        isContentError
          ? {
              kind: "error",
              message: t(
                "tools.skillsCollection.failedToLoadPath",
                "Failed to load {{path}}.",
                { path: selectedPath },
              ),
              onRetry,
            }
          : isLoadingContent
            ? { kind: "loading" }
            : { kind: "ready", content }
      }
      overflowMenu={headerActions}
      footer={
        <ConfirmDeleteDialog
          open={confirmingDelete}
          onOpenChange={(open) => {
            if (!isDeleting) setConfirmingDelete(open);
          }}
        >
          <ConfirmDeleteDialogContent
            title={t("tools.skillsCollection.deleteSkillTitle", "Delete skill?")}
            description={t(
              "tools.skillsCollection.deleteSkillDescription",
              'Delete "{{name}}" from its current location? This cannot be undone.',
              { name: skill.name },
            )}
            confirmLabel={t(
              "tools.skillsCollection.deleteSkillConfirmLabel",
              "Delete skill",
            )}
            pending={isDeleting}
            onConfirm={onDelete}
            onCancel={() => setConfirmingDelete(false)}
          />
        </ConfirmDeleteDialog>
      }
    />
  );
}
