"use client";

import * as React from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  Buildings,
  CaretDown,
  Check,
  MagnifyingGlass,
  Plus,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";

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
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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
      <div className="flex h-9 w-36 animate-pulse items-center rounded-xl bg-muted" />
    );
  }

  return (
    <div className={cn("relative", fullWidth && "w-full")} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all",
          "border border-border/80 bg-card/80 shadow-sm",
          "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5",
          isOpen && "border-primary/40 shadow-md shadow-primary/5",
          fullWidth && "w-full",
        )}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-white shadow-sm shadow-primary/20">
          <Buildings className="h-3.5 w-3.5" weight="fill" />
        </div>
        <span
          className={cn(
            "max-w-[120px] truncate text-sm font-medium text-foreground",
            fullWidth ? "flex-1 text-left max-w-none" : "hidden md:block",
          )}
        >
          {currentWorkspace.name}
        </span>
        <CaretDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180",
            fullWidth && "ml-auto",
          )}
          weight="bold"
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute left-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl shadow-black/10",
              fullWidth ? "w-full" : "w-72",
            )}
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
              <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
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
                          "flex w-full items-center gap-3 rounded-xl p-2.5 transition-all",
                          isSelected ? "bg-primary/5" : "hover:bg-muted",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg",
                            isSelected
                              ? "bg-primary text-white"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Buildings className="h-4 w-4" weight="fill" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              isSelected ? "text-primary" : "text-foreground",
                            )}
                          >
                            {ws.name}
                          </p>
                          {ws.isDefault && (
                            <p className="text-[11px] text-muted-foreground">
                              {t("default")}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <Check
                            className="h-4 w-4 flex-shrink-0 text-primary"
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
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                    autoFocus
                  />
                  {createError && (
                    <p className="text-xs text-red-500">{createError}</p>
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
                      className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {t("create")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                >
                  <Plus className="h-4 w-4" weight="bold" />
                  <span>{t("createWorkspace")}</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
