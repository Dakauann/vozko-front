"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { AnimatePresence, motion } from "framer-motion";
import {
  Buildings,
  CaretDown,
  Check,
  MagnifyingGlass,
  Plus,
  SpinnerGap,
  X,
} from "@/components/icons";

import type { Workspace } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import { createWorkspaceAction } from "@/app/actions/workspace";
import { fetchWorkspaces } from "@/lib/workspace/client";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const PAGE_SIZE = 20;

export function WorkspaceSwitcher({
  fullWidth = false,
}: { fullWidth?: boolean } = {}) {
  const t = useTranslations("workspace");
  const { currentWorkspace, isLoading, switchWorkspace, refreshWorkspaces } =
    useWorkspace();
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [searchMode, setSearchMode] = React.useState<"name" | "email">("name");
  const [isCreating, setIsCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [createError, setCreateError] = React.useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  /** The portalled panel. Needed by the click-outside test — see below. */
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Measure from the trigger, not from a positioned ancestor: the spine clips.
  React.useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 288);
      setMenuPos({
        top: r.bottom + 6,
        // Keep the panel on screen when the trigger sits near an edge.
        left: Math.min(r.left, window.innerWidth - width - 8),
        width,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isOpen]);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const [items, setItems] = React.useState<Workspace[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [isFetching, setIsFetching] = React.useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = React.useState(false);
  const fetchRef = React.useRef(0);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadWorkspaces = React.useCallback(
    async (pageNum: number, searchQuery: string, append: boolean) => {
      const fetchId = ++fetchRef.current;
      setIsFetching(true);
      try {
        const result = await fetchWorkspaces({
          search: searchMode === "name" ? searchQuery || undefined : undefined,
          memberEmail:
            searchMode === "email" ? searchQuery || undefined : undefined,
          page: pageNum,
          pageSize: PAGE_SIZE,
        });
        if (fetchId !== fetchRef.current) return; 
        if (!result.error) {
          setItems((prev) =>
            append ? [...prev, ...result.workspaces] : result.workspaces,
          );
          setTotalPages(result.totalPages ?? 1);
          setHasInitiallyLoaded(true);
        }
      } finally {
        if (fetchId === fetchRef.current) {
          setIsFetching(false);
        }
      }
    },
    [searchMode],
  );

  React.useEffect(() => {
    if (!isOpen) return;
    setPage(1);
    loadWorkspaces(1, debouncedSearch, false);
  }, [isOpen, debouncedSearch, searchMode, loadWorkspaces]);

  const handleScroll = React.useCallback(() => {
    const el = listRef.current;
    if (!el || isFetching || page >= totalPages) return;
    const threshold = 40;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadWorkspaces(nextPage, debouncedSearch, true);
    }
  }, [isFetching, page, totalPages, debouncedSearch, loadWorkspaces]);

  React.useEffect(() => {
    /*
      The panel is portalled to document.body, so it is NOT a DOM descendant of
      dropdownRef — that ref only wraps the trigger. Testing containment against
      the trigger alone therefore reported "outside" for every click INSIDE the
      panel, which is why clicking the search field closed the menu instantly:
      mousedown fired, the menu unmounted, and the click never reached the input.

      Both subtrees have to be excluded.
    */
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inTrigger = dropdownRef.current?.contains(target) ?? false;
      const inPanel = panelRef.current?.contains(target) ?? false;
      if (!inTrigger && !inPanel) {
        setIsOpen(false);
        setSearch("");
        setDebouncedSearch("");
        setIsCreating(false);
        setNewName("");
        setCreateError("");
        setSearch("");
        setDebouncedSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setItems([]);
      setHasInitiallyLoaded(false);
      setPage(1);
      setTotalPages(1);
      setSearch("");
      setDebouncedSearch("");
    }
  }, [isOpen]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreateError("");
    const result = await createWorkspaceAction(newName.trim());
    if (result.error) {
      setCreateError(result.error);
      return;
    }
    if (result.workspace) {
      switchWorkspace(result.workspace);
      await refreshWorkspaces();
    }
    setIsCreating(false);
    setNewName("");
    setIsOpen(false);
  };

  if (isLoading || !currentWorkspace) {
    return (
      <div
        className={cn(
          "h-9 animate-pulse rounded-[--radius] bg-muted",
          fullWidth ? "w-full" : "w-36",
        )}
      />
    );
  }

  return (
    <div className={cn("relative", fullWidth && "w-full")} ref={dropdownRef}>
      {/*
        The scope slot of the app bar's identity line — "Brand | Workspace",
        the way the reference bar reads "Azure Data Explorer | All dashboards".
        In the bar it is a quiet single-line trigger: the name IS the label,
        with the accessible name carrying the legend. The drawer keeps the
        stacked legend-over-name form (fullWidth), where vertical room is free.
      */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={t("label")}
        className={cn(
          "flex items-center gap-2 rounded-[--radius] border text-left transition-colors",
          fullWidth
            ? "h-9 w-full border-border px-2"
            : "h-8 border-transparent px-2",
          isOpen ? "bg-muted" : "hover:bg-muted",
        )}
      >
        <Buildings
          className="h-4 w-4 shrink-0 text-muted-foreground"
          weight="regular"
        />
        {fullWidth ? (
          <span className="flex min-w-0 flex-1 flex-col leading-none">
            <span className="legend leading-none">{t("label")}</span>
            <span className="mt-0.5 max-w-[9rem] truncate text-sm font-semibold leading-none text-foreground">
              {currentWorkspace.name}
            </span>
          </span>
        ) : (
          <span className="max-w-[12rem] truncate text-sm font-semibold leading-none text-foreground">
            {currentWorkspace.name}
          </span>
        )}
        <CaretDown
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
            fullWidth && "ml-auto",
          )}
          weight="bold"
        />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && menuPos && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: [0.1, 0.9, 0.2, 1] }}
                style={{
                  position: "fixed",
                  top: menuPos.top,
                  left: menuPos.left,
                  width: menuPos.width,
                }}
                className="z-[100] overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
              >
            <div className="border-b border-border px-3 py-2.5 space-y-2">
              {/* Search mode toggle */}
              <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                <button
                  onClick={() => {
                    setSearchMode("name");
                    setSearch("");
                  }}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                    searchMode === "name"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-muted-foreground",
                  )}
                >
                  {t("searchByName")}
                </button>
                <button
                  onClick={() => {
                    setSearchMode("email");
                    setSearch("");
                  }}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                    searchMode === "email"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-muted-foreground",
                  )}
                >
                  {t("searchByEmail")}
                </button>
              </div>
              {/* Search input */}
              <div className="flex items-center gap-2 rounded-[--radius] bg-muted px-3 py-2">
                <MagnifyingGlass
                  className="h-4 w-4 text-muted-foreground"
                  weight="bold"
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    searchMode === "email"
                      ? t("searchEmailPlaceholder")
                      : t("search")
                  }
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {search && (
                  <button onClick={() => setSearch("")}>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            <div
              ref={listRef}
              onScroll={handleScroll}
              className="max-h-64 overflow-y-auto p-1.5 z-10"
            >
              {!hasInitiallyLoaded && isFetching ? (
                <div className="flex items-center justify-center py-6">
                  <SpinnerGap className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </div>
              ) : (
                <>
                  {items.map((ws) => {
                    const isSelected = ws.id === currentWorkspace.id;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => {
                          switchWorkspace(ws);
                          setIsOpen(false);
                          setSearch("");
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[--radius] p-2.5 transition-all",
                          // Neutral opaque ground; the glyph carries the green.
                          isSelected ? "bg-muted text-foreground" : "hover:bg-muted",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg",
                            // Lifts to --card so the tile still separates from
                            // the selected row's own --muted ground.
                            isSelected ? "bg-card text-primary-ink" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Buildings className="h-4 w-4" weight="fill" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              isSelected ? "font-semibold text-foreground" : "text-foreground",
                            )}
                          >
                            {ws.name}
                          </p>
                          {ws.isDefault && (
                            <p className="text-2xs text-muted-foreground">
                              {t("default")}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <Check
                            className="h-4 w-4 flex-shrink-0 text-primary-ink"
                            weight="bold"
                          />
                        )}
                      </button>
                    );
                  })}
                  {isFetching && page > 1 && (
                    <div className="flex items-center justify-center py-2">
                      <SpinnerGap className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-border p-1.5">
              {isCreating ? (
                <div className="space-y-2 p-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setCreateError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") {
                        setIsCreating(false);
                        setNewName("");
                        setCreateError("");
                      }
                    }}
                    placeholder={t("newWorkspaceName")}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/10"
                    autoFocus
                  />
                  {createError && (
                    <p className="text-xs text-destructive-ink">{createError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setNewName("");
                        setCreateError("");
                      }}
                      className="flex-1 rounded-lg bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:bg-border transition-colors"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {t("create")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex w-full items-center gap-3 rounded-[--radius] px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                >
                  <Plus className="h-4 w-4" weight="bold" />
                  <span>{t("createWorkspace")}</span>
                </button>
              )}
            </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
