import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, ListTodo, Search, User } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getAuthToken } from "@/lib/auth/token";
import { nameToInitials } from "@/lib/auth/use-current-user";
import { resolveAvatarUrl } from "@/lib/avatar-url";
import { searchWorkspace, type GlobalSearchResult } from "@/lib/api/search";
import { Skeleton } from "@/components/ui/skeleton";

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
  label,
  onSelect,
}: {
  result: GlobalSearchResult;
  label: string;
  onSelect: (result: GlobalSearchResult) => void;
}) {
  const Icon = result.type === "project" ? FolderKanban : result.type === "task" ? ListTodo : User;

  return (
    <button
      type="button"
      role="option"
      aria-label={label}
      className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left text-sm transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(result)}
    >
      {result.type === "member" && resolveAvatarUrl(result.avatarUrl) ? (
        <img
          src={resolveAvatarUrl(result.avatarUrl)!}
          alt=""
          className="mt-0.5 size-7 shrink-0 rounded-full object-cover"
        />
      ) : result.type === "member" ? (
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-gradient-brand text-[10px] font-semibold text-white">
          {nameToInitials(result.title)}
        </span>
      ) : (
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-muted/70 text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-snug text-foreground">
          {result.title}
        </span>
        {(result.subtitle || result.projectName) && (
          <span className="block truncate text-xs text-muted-foreground">
            {result.type === "task" && result.projectName
              ? `${result.subtitle ?? ""}${result.subtitle ? " · " : ""}${result.projectName}`
              : (result.subtitle ?? result.projectName)}
          </span>
        )}
      </span>
    </button>
  );
}

function SearchGroup({
  title,
  results,
  openLabel,
  onSelect,
}: {
  title: string;
  results: GlobalSearchResult[];
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
            <SearchResultButton result={result} label={openLabel} onSelect={onSelect} />
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

export function GlobalSearch() {
  const { t } = useI18n();
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const trimmedQuery = query.trim();
  const debouncedTrimmed = debouncedQuery.trim();
  const showPanel = open && trimmedQuery.length >= 2;
  const hasToken = typeof window !== "undefined" && !!getAuthToken();

  const searchQuery = useQuery({
    queryKey: [GLOBAL_SEARCH_QUERY_KEY, debouncedTrimmed],
    queryFn: () => searchWorkspace(debouncedTrimmed),
    enabled: hasToken && showPanel && debouncedTrimmed.length >= 2,
    staleTime: 30_000,
    retry: 1,
  });

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
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
    if (!showPanel) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        inputRef.current?.blur();
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
  }, [showPanel, closeSearch]);

  const isDebouncing = trimmedQuery !== debouncedTrimmed;
  const isLoading = searchQuery.isLoading || searchQuery.isFetching || isDebouncing;
  const hasError = searchQuery.isError && !isLoading;
  const data = searchQuery.data;
  const totalResults =
    (data?.projects.length ?? 0) + (data?.tasks.length ?? 0) + (data?.members.length ?? 0);
  const isEmpty = !isLoading && !hasError && totalResults === 0;

  return (
    <div ref={rootRef} className="relative hidden min-w-0 flex-1 lg:block lg:max-w-sm xl:max-w-md">
      <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={showPanel ? listboxId : undefined}
        aria-autocomplete="list"
        value={query}
        placeholder={t("top.search")}
        className="h-9 w-full rounded-lg border border-input bg-secondary/60 pl-9 pr-12 text-sm outline-none transition placeholder:text-muted-foreground focus:bg-card focus:ring-2 focus:ring-ring/40"
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) {
            setOpen(true);
          }
        }}
        onFocus={() => setOpen(true)}
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>

      {showPanel && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        >
          {isLoading && <SearchDropdownSkeleton />}
          {hasError && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {t("top.searchError")}
            </p>
          )}
          {isEmpty && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {t("top.searchNothingFound")}
            </p>
          )}
          {!isLoading && !hasError && !isEmpty && data && (
            <div className="app-scrollbar max-h-80 overflow-y-auto overscroll-contain p-1">
              <SearchGroup
                title={t("top.searchProjects")}
                results={data.projects}
                openLabel={t("top.searchOpenResult")}
                onSelect={handleSelect}
              />
              <SearchGroup
                title={t("top.searchTasks")}
                results={data.tasks}
                openLabel={t("top.searchOpenResult")}
                onSelect={handleSelect}
              />
              <SearchGroup
                title={t("top.searchPeople")}
                results={data.members}
                openLabel={t("top.searchOpenResult")}
                onSelect={handleSelect}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
