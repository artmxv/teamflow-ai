import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, ListTodo, Search, User, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getAuthToken } from "@/lib/auth/token";
import { searchWorkspace, type GlobalSearchResult } from "@/lib/api/search";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectAccent } from "@/lib/project-color";
import { fetchProjects, type ProjectApiItem } from "@/lib/api/projects";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 280;
const GLOBAL_SEARCH_QUERY_KEY = "global-search";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function parseTaskHref(href: string): { taskId: string } | null {
  try {
    const url = new URL(href, "http://local");
    const taskId = url.searchParams.get("taskId");
    if (!taskId) {
      return null;
    }
    return { taskId };
  } catch {
    return null;
  }
}

function SearchResultButton({
  result,
  project,
  label,
  onSelect,
}: {
  result: GlobalSearchResult;
  project?: ProjectApiItem;
  label: string;
  onSelect: (result: GlobalSearchResult) => void;
}) {
  const Icon = result.type === "project" ? FolderKanban : result.type === "task" ? ListTodo : User;
  const projectAccent = project ? getProjectAccent(project) : null;

  return (
    <button
      type="button"
      role="option"
      aria-label={label}
      className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left text-sm transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(result)}
    >
      {result.type === "member" ? (
        <UserAvatar
          id={result.id}
          name={result.title}
          avatarUrl={result.avatarUrl}
          size="sm"
          className="mt-0.5"
        />
      ) : (
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-border/70 bg-muted/45 text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5 font-medium leading-snug text-foreground">
          {result.type === "project" && projectAccent ? (
            <span className={`size-2 shrink-0 rounded-full ${projectAccent.dot}`} aria-hidden />
          ) : null}
          <span className="break-words [overflow-wrap:anywhere] lg:truncate">{result.title}</span>
        </span>
        {(result.subtitle || result.projectName) && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {result.type === "task" && result.projectName ? (
              <>
                {result.subtitle ? <span className="shrink-0">{result.subtitle}</span> : null}
                {result.subtitle ? <span className="shrink-0 opacity-60">·</span> : null}
                {projectAccent ? (
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${projectAccent.dot}`}
                    aria-hidden
                  />
                ) : null}
                <span className="break-words [overflow-wrap:anywhere] lg:truncate">
                  {result.projectName}
                </span>
              </>
            ) : (
              <span className="break-words [overflow-wrap:anywhere] lg:truncate">
                {result.subtitle ?? result.projectName}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

function resolveResultProject(
  result: GlobalSearchResult,
  projectById?: ReadonlyMap<string, ProjectApiItem>,
  projectByName?: ReadonlyMap<string, ProjectApiItem>,
) {
  if (result.type === "project") {
    return projectById?.get(result.id);
  }
  if (result.type === "task" && result.projectName) {
    return projectByName?.get(result.projectName);
  }
  return undefined;
}

function SearchGroup({
  title,
  results,
  projectById,
  projectByName,
  openLabel,
  onSelect,
}: {
  title: string;
  results: GlobalSearchResult[];
  projectById?: ReadonlyMap<string, ProjectApiItem>;
  projectByName?: ReadonlyMap<string, ProjectApiItem>;
  openLabel: string;
  onSelect: (result: GlobalSearchResult) => void;
}) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="py-1">
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-0.5">
        {results.map((result) => (
          <li key={`${result.type}-${result.id}`}>
            <SearchResultButton
              result={result}
              project={resolveResultProject(result, projectById, projectByName)}
              label={openLabel}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SearchDropdownSkeleton() {
  return (
    <div className="space-y-3 p-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-2.5 px-1">
          <Skeleton className="size-7 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4 max-w-[12rem]" />
            <Skeleton className="h-3 w-1/2 max-w-[8rem]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchResults({
  data,
  isLoading,
  hasError,
  isEmpty,
  projectById,
  projectByName,
  labels,
  onSelect,
  className,
}: {
  data: Awaited<ReturnType<typeof searchWorkspace>> | undefined;
  isLoading: boolean;
  hasError: boolean;
  isEmpty: boolean;
  projectById: ReadonlyMap<string, ProjectApiItem>;
  projectByName: ReadonlyMap<string, ProjectApiItem>;
  labels: {
    error: string;
    empty: string;
    projects: string;
    tasks: string;
    people: string;
    open: string;
  };
  onSelect: (result: GlobalSearchResult) => void;
  className?: string;
}) {
  if (isLoading) {
    return <SearchDropdownSkeleton />;
  }

  if (hasError) {
    return <p className="px-3 py-4 text-center text-sm text-muted-foreground">{labels.error}</p>;
  }

  if (isEmpty) {
    return <p className="px-3 py-4 text-center text-sm text-muted-foreground">{labels.empty}</p>;
  }

  if (!data) {
    return null;
  }

  return (
    <div className={cn("app-scrollbar max-h-80 overflow-y-auto overscroll-contain p-1", className)}>
      <SearchGroup
        title={labels.projects}
        results={data.projects}
        projectById={projectById}
        projectByName={projectByName}
        openLabel={labels.open}
        onSelect={onSelect}
      />
      <SearchGroup
        title={labels.tasks}
        results={data.tasks}
        projectById={projectById}
        projectByName={projectByName}
        openLabel={labels.open}
        onSelect={onSelect}
      />
      <SearchGroup
        title={labels.people}
        results={data.members}
        openLabel={labels.open}
        onSelect={onSelect}
      />
    </div>
  );
}

export function GlobalSearch() {
  const { t } = useI18n();
  const router = useRouter();
  const desktopListboxId = useId();
  const mobileListboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const trimmedQuery = query.trim();
  const debouncedTrimmed = debouncedQuery.trim();
  const showDesktopPanel = open && trimmedQuery.length >= 2;
  const showMobilePanel = mobileOpen && trimmedQuery.length >= 2;
  const showPanel = showDesktopPanel || showMobilePanel;
  const hasToken = typeof window !== "undefined" && !!getAuthToken();
  const { data: accessibleProjects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: hasToken,
    staleTime: 30_000,
  });
  const projectById = useMemo(
    () => new Map(accessibleProjects.map((project) => [project.id, project])),
    [accessibleProjects],
  );
  const projectByName = useMemo(
    () => new Map(accessibleProjects.map((project) => [project.name, project])),
    [accessibleProjects],
  );

  const searchQuery = useQuery({
    queryKey: [GLOBAL_SEARCH_QUERY_KEY, debouncedTrimmed],
    queryFn: () => searchWorkspace(debouncedTrimmed),
    enabled: hasToken && showPanel && debouncedTrimmed.length >= 2,
    staleTime: 30_000,
    retry: 1,
  });

  const closeSearch = useCallback(() => {
    setOpen(false);
    setMobileOpen(false);
    setQuery("");
    desktopInputRef.current?.blur();
    mobileInputRef.current?.blur();
  }, []);

  const handleSelect = useCallback(
    (result: GlobalSearchResult) => {
      closeSearch();

      if (result.type === "project") {
        void router.navigate({
          to: "/app/projects/$projectId",
          params: { projectId: result.id },
        });
        return;
      }

      if (result.type === "task") {
        const parsed = parseTaskHref(result.href);
        void router.navigate({
          to: "/app/tasks",
          search: parsed ?? { taskId: result.id },
        });
        return;
      }

      void router.navigate({
        to: "/app/team",
        search: { memberId: result.id },
      });
    },
    [closeSearch, router],
  );

  useEffect(() => {
    if (!showDesktopPanel) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        desktopInputRef.current?.blur();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSearch();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDesktopPanel, closeSearch]);

  const isDebouncing = trimmedQuery !== debouncedTrimmed;
  const isLoading = searchQuery.isLoading || searchQuery.isFetching || isDebouncing;
  const hasError = searchQuery.isError && !isLoading;
  const data = searchQuery.data;
  const totalResults =
    (data?.projects.length ?? 0) + (data?.tasks.length ?? 0) + (data?.members.length ?? 0);
  const isEmpty = !isLoading && !hasError && totalResults === 0;
  const resultLabels = {
    error: t("top.searchError"),
    empty: t("top.searchNothingFound"),
    projects: t("top.searchProjects"),
    tasks: t("top.searchTasks"),
    people: t("top.searchPeople"),
    open: t("top.searchOpenResult"),
  };

  return (
    <>
      <button
        type="button"
        aria-label={t("top.search")}
        aria-haspopup="dialog"
        aria-expanded={mobileOpen}
        className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none transition hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/35 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Search className="size-4.5" aria-hidden />
      </button>

      <Dialog
        open={mobileOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setMobileOpen(true);
          } else {
            closeSearch();
          }
        }}
      >
        <DialogContent
          closeLabel={t("nav.closeMenu")}
          closeClassName="right-3 top-3 size-10"
          className="top-2 flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-xl p-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t("top.search")}</DialogTitle>
            <DialogDescription>{t("top.search")}</DialogDescription>
          </DialogHeader>
          <div className="relative shrink-0 border-b border-border px-3 py-3 pr-14">
            <Search
              className="filter-search-icon pointer-events-none absolute left-6 top-1/2 z-10 size-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              ref={mobileInputRef}
              type="search"
              role="combobox"
              aria-expanded={showMobilePanel}
              aria-controls={showMobilePanel ? mobileListboxId : undefined}
              aria-autocomplete="list"
              value={query}
              placeholder={t("top.search")}
              className="filter-search-input h-11 w-full appearance-none pl-9 pr-10 text-sm outline-none transition [&::-webkit-search-cancel-button]:appearance-none"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                aria-label={t("top.searchClear")}
                className="absolute right-16 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/35"
                onClick={() => {
                  setQuery("");
                  mobileInputRef.current?.focus();
                }}
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
          <div
            id={showMobilePanel ? mobileListboxId : undefined}
            role={showMobilePanel ? "listbox" : undefined}
            className="min-h-0 flex-1 overflow-hidden bg-popover text-popover-foreground"
          >
            {showMobilePanel ? (
              <SearchResults
                data={data}
                isLoading={isLoading}
                hasError={hasError}
                isEmpty={isEmpty}
                projectById={projectById}
                projectByName={projectByName}
                labels={resultLabels}
                onSelect={handleSelect}
                className="h-full max-h-none px-2 py-2"
              />
            ) : (
              <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
                <span className="grid size-12 place-items-center rounded-xl bg-muted/60">
                  <Search className="size-5" aria-hidden />
                </span>
                <p>{t("top.search")}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div
        ref={rootRef}
        className="relative hidden min-w-0 flex-1 lg:block lg:max-w-sm xl:max-w-md"
      >
        <Search
          className="filter-search-icon pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          ref={desktopInputRef}
          type="search"
          role="combobox"
          aria-expanded={showDesktopPanel}
          aria-controls={showDesktopPanel ? desktopListboxId : undefined}
          aria-autocomplete="list"
          value={query}
          placeholder={t("top.search")}
          className="filter-search-input w-full appearance-none pl-9 pr-10 text-sm outline-none transition [&::-webkit-search-cancel-button]:appearance-none"
          onChange={(event) => {
            setQuery(event.target.value);
            if (!open) {
              setOpen(true);
            }
          }}
          onFocus={() => setOpen(true)}
        />

        {query ? (
          <button
            type="button"
            aria-label={t("top.searchClear")}
            className="absolute right-2 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/35"
            onClick={() => {
              setQuery("");
              setOpen(false);
              desktopInputRef.current?.focus();
            }}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}

        {showDesktopPanel && (
          <div
            id={desktopListboxId}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-50 min-w-0 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
          >
            <SearchResults
              data={data}
              isLoading={isLoading}
              hasError={hasError}
              isEmpty={isEmpty}
              projectById={projectById}
              projectByName={projectByName}
              labels={resultLabels}
              onSelect={handleSelect}
            />
          </div>
        )}
      </div>
    </>
  );
}
