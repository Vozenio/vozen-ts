import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ThreadListEntry } from "@bb/domain";
import type { ThreadSearchMatch } from "@bb/server-contract";
import { CHROME_SECTION_LABEL_CLASS } from "@bb/shared-ui/chrome-style-tokens";
import {
  COARSE_POINTER_TEXT_SM_CLASS,
  COARSE_POINTER_ICON_SIZE_CLASS,
} from "@bb/shared-ui/coarse-pointer-sizing";
import { Icon, type IconName } from "@bb/shared-ui/icon";
import { useThreadSearch } from "@/hooks/queries/thread-queries";
import { hasThreadSearchableQuery } from "@/hooks/queries/thread-queries";
import { cn } from "@bb/shared-ui/lib/utils";
import {
  getSidebarThreadSearchOptionId,
  isSidebarThreadTitleMatch,
  SIDEBAR_THREAD_SEARCH_LISTBOX_ID,
  type SidebarThreadSearchNavigationItem,
} from "./sidebarThreadSearch";
import { ThreadSearchResultRow } from "./ThreadSearchResultRow";

interface SidebarThreadSearchPanelProps {
  activeIndex: number;
  sectionNamesById?: ReadonlyMap<string, string>;
  isRecentsLoading: boolean;
  onActiveIndexChange: (index: number) => void;
  onNavigationItemsChange: (
    items: readonly SidebarThreadSearchNavigationItem[],
  ) => void;
  onSelect: (item: SidebarThreadSearchNavigationItem) => void;
  projectNamesById: ReadonlyMap<string, string>;
  query: string;
  recentThreads: readonly ThreadListEntry[];
  showSectionLabels?: boolean;
}

interface ThreadSearchRenderableRow {
  id: string;
  matches: readonly ThreadSearchMatch[];
  thread: ThreadListEntry;
}

interface ThreadSearchSection {
  id: "active" | "archived";
  label: string;
  rows: readonly ThreadSearchRenderableRow[];
  total: number;
}

interface ThreadSearchMessageProps {
  iconName: IconName;
  isLoading?: boolean;
  text: string;
}

const RECENT_THREAD_LIMIT = 20;
const EMPTY_MATCHES: readonly ThreadSearchMatch[] = [];
const EMPTY_SECTION_NAMES_BY_ID = new Map<string, string>();
// The message (non-title) match drives the deep-link target. Mirrors the row's
// snippet selection so clicking a result lands on the message shown in the row.
function getMessageMatchSeq(
  matches: readonly ThreadSearchMatch[],
): number | null {
  for (const match of matches) {
    if (!isSidebarThreadTitleMatch(match) && match.sourceSeq !== null) {
      return match.sourceSeq;
    }
  }
  return null;
}

function toNavigationItem(
  row: ThreadSearchRenderableRow,
): SidebarThreadSearchNavigationItem {
  return {
    id: row.id,
    optionId: getSidebarThreadSearchOptionId(row.id),
    projectId: row.thread.projectId,
    threadId: row.thread.id,
    messageSeq: getMessageMatchSeq(row.matches),
  };
}

function ThreadSearchMessage({
  iconName,
  isLoading = false,
  text,
}: ThreadSearchMessageProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-muted-foreground",
        COARSE_POINTER_TEXT_SM_CLASS,
      )}
    >
      <Icon
        name={iconName}
        className={cn(
          COARSE_POINTER_ICON_SIZE_CLASS,
          isLoading && "animate-spin",
        )}
      />
      <span>{text}</span>
    </div>
  );
}

function renderSectionRows({
  activeIndex,
  sectionFallbackLabel,
  sectionNamesById,
  onActiveIndexChange,
  onSelect,
  projectNamesById,
  section,
  showSectionLabels,
  startIndex,
}: {
  activeIndex: number;
  sectionFallbackLabel: string;
  sectionNamesById: ReadonlyMap<string, string>;
  onActiveIndexChange: (index: number) => void;
  onSelect: (item: SidebarThreadSearchNavigationItem) => void;
  projectNamesById: ReadonlyMap<string, string>;
  section: ThreadSearchSection;
  showSectionLabels: boolean;
  startIndex: number;
}) {
  if (section.rows.length === 0) {
    return null;
  }

  return (
    <section
      key={section.id}
      role="group"
      aria-label={section.label}
      className="space-y-1"
    >
      <div
        className={cn(
          CHROME_SECTION_LABEL_CLASS,
          "sticky top-0 z-10 rounded-none bg-sidebar px-2",
        )}
      >
        <span className="min-w-0 truncate">{section.label}</span>
        {section.total > section.rows.length ? (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {section.rows.length}/{section.total}
          </span>
        ) : null}
      </div>
      <div className="space-y-0.5">
        {section.rows.map((row, rowIndex) => {
          const index = startIndex + rowIndex;
          const item = toNavigationItem(row);
          return (
            <ThreadSearchResultRow
              key={row.id}
              id={item.optionId}
              isActive={activeIndex === index}
              matches={row.matches}
              sectionLabel={
                showSectionLabels && row.thread.sectionId
                  ? (sectionNamesById.get(row.thread.sectionId) ??
                    sectionFallbackLabel)
                  : null
              }
              projectName={projectNamesById.get(row.thread.projectId)}
              thread={row.thread}
              onActive={() => onActiveIndexChange(index)}
              onSelect={() => onSelect(item)}
            />
          );
        })}
      </div>
    </section>
  );
}

export function SidebarThreadSearchPanel({
  activeIndex,
  sectionNamesById = EMPTY_SECTION_NAMES_BY_ID,
  isRecentsLoading,
  onActiveIndexChange,
  onNavigationItemsChange,
  onSelect,
  projectNamesById,
  query,
  recentThreads,
  showSectionLabels = false,
}: SidebarThreadSearchPanelProps) {
  const { t } = useTranslation();
  const trimmedQuery = query.trim();
  const liveQueryIsSearchable = hasThreadSearchableQuery(trimmedQuery);
  const threadSearch = useThreadSearch({ active: true, query });
  const searchResultsAreCurrent =
    !liveQueryIsSearchable || threadSearch.debouncedQuery === trimmedQuery;
  const sections = useMemo<ThreadSearchSection[]>(() => {
    if (!liveQueryIsSearchable) {
      const rows = recentThreads
        .slice(0, RECENT_THREAD_LIMIT)
        .map((thread) => ({
          id: `recent:${thread.id}`,
          matches: EMPTY_MATCHES,
          thread,
        }));
      return [
        {
          id: "active",
          label: t("sidebar.search.recent"),
          rows,
          total: rows.length,
        },
      ];
    }

    if (!searchResultsAreCurrent) {
      return [
        {
          id: "active",
          label: t("sidebar.search.threads"),
          rows: [],
          total: 0,
        },
        {
          id: "archived",
          label: t("sidebar.search.archived"),
          rows: [],
          total: 0,
        },
      ];
    }

    const activeRows =
      threadSearch.data?.active.results.map((result) => ({
        id: `active:${result.thread.id}`,
        matches: result.matches,
        thread: result.thread,
      })) ?? [];
    const archivedRows =
      threadSearch.data?.archived.results.map((result) => ({
        id: `archived:${result.thread.id}`,
        matches: result.matches,
        thread: result.thread,
      })) ?? [];
    return [
      {
        id: "active",
        label: t("sidebar.search.threads"),
        rows: activeRows,
        total: threadSearch.data?.active.total ?? 0,
      },
      {
        id: "archived",
        label: t("sidebar.search.archived"),
        rows: archivedRows,
        total: threadSearch.data?.archived.total ?? 0,
      },
    ];
  }, [
    liveQueryIsSearchable,
    recentThreads,
    searchResultsAreCurrent,
    t,
    threadSearch.data,
  ]);
  const rows = useMemo(
    () => sections.flatMap((section) => section.rows),
    [sections],
  );
  const navigationItems = useMemo(() => rows.map(toNavigationItem), [rows]);

  useEffect(() => {
    onNavigationItemsChange(navigationItems);
  }, [navigationItems, onNavigationItemsChange]);

  const isLoading =
    liveQueryIsSearchable &&
    (!searchResultsAreCurrent ||
      threadSearch.isDebouncing ||
      (threadSearch.isLoading && threadSearch.data === undefined));
  const hasRows = rows.length > 0;
  const showRecentLoading = !liveQueryIsSearchable && isRecentsLoading;
  const showError =
    liveQueryIsSearchable && threadSearch.isError && !isLoading && !hasRows;
  const showNoSearchResults =
    liveQueryIsSearchable && !isLoading && !showError && !hasRows;
  const showTypeToSearch =
    !liveQueryIsSearchable && !showRecentLoading && recentThreads.length === 0;
  let startIndex = 0;

  return (
    <div
      id={SIDEBAR_THREAD_SEARCH_LISTBOX_ID}
      role="listbox"
      aria-label={t("sidebar.search.results")}
      // Rows and section labels own their horizontal inset (the standard 8px
      // row padding), matching the rest of the sidebar. A container `px-*` here
      // would stack on top of that and squeeze the results narrower than every
      // other sidebar row.
      className="space-y-3 pb-3 group-data-[collapsible=icon]:hidden"
    >
      {showRecentLoading ? (
        <ThreadSearchMessage
          iconName="Spinner"
          isLoading
          text={t("sidebar.search.loading")}
        />
      ) : null}
      {isLoading ? (
        <ThreadSearchMessage
          iconName="Spinner"
          isLoading
          text={t("sidebar.search.searching")}
        />
      ) : null}
      {showError ? (
        <ThreadSearchMessage
          iconName="AlertCircle"
          text={t("sidebar.search.failed")}
        />
      ) : null}
      {showNoSearchResults ? (
        <ThreadSearchMessage
          iconName="MessageQuestion"
          text={t("sidebar.search.noResults")}
        />
      ) : null}
      {showTypeToSearch ? (
        <ThreadSearchMessage
          iconName="Search"
          text={t("sidebar.search.typeToSearch")}
        />
      ) : null}
      {sections.map((section) => {
        const renderedSection = renderSectionRows({
          activeIndex,
          sectionFallbackLabel: t("sidebar.search.section"),
          sectionNamesById,
          onActiveIndexChange,
          onSelect,
          projectNamesById,
          section,
          showSectionLabels,
          startIndex,
        });
        startIndex += section.rows.length;
        return renderedSection;
      })}
    </div>
  );
}
