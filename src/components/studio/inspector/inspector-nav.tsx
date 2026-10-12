"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Eyedropper, Layers, Lightning, MagnifyingGlass, Palette, SlidersHorizontal, Timer, X } from "@/components/icons";
import type { Icon } from "@/components/icons";
import { searchText, type InspectorGroupId } from "@/lib/studio/inspector-layout";
import { cn } from "@/lib/utils";

import { panelId, tabId, useInspectorStore, useInspectorValue } from "./inspector-context";
import type { InspectorStore } from "./inspector-store";

export const SEARCH_MIN_SECTIONS = 6;

const GROUP_ICONS: Record<InspectorGroupId, Icon> = {
  basic: SlidersHorizontal,
  animation: Lightning,
  color: Eyedropper,
  effects: Palette,
  cutout: Layers,
  speed: Timer,
};

const NO_GROUPS: readonly InspectorGroupId[] = [];

const TAB_KEYS: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

function useNavState(store: InspectorStore | null) {
  const groups = useInspectorValue(store, (s) => s.groups(), NO_GROUPS);
  const active = useInspectorValue(store, (s) => s.activeGroup(), null);
  const query = useInspectorValue(store, (s) => s.query(), "");
  const sections = useInspectorValue(store, (s) => s.sectionCount(), 0);
  const matches = useInspectorValue(store, (s) => s.matchCount(), 0);
  const searching = searchText(query) !== "";
  return { groups, active, query, sections, matches, searching, tabbed: groups.length > 1 && !searching };
}

function SearchField({ store, query }: { store: InspectorStore; query: string }) {
  const t = useTranslations("studio.inspector");
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="relative px-3 pt-2">
      <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-5 top-[calc(50%+4px)] h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={input}
        type="search"
        value={query}
        aria-label={t("search")}
        placeholder={t("searchPlaceholder")}
        spellCheck={false}
        onChange={(event) => store.setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || query === "") return;
          event.preventDefault();
          event.stopPropagation();
          store.setQuery("");
        }}
        className="h-7 w-full min-w-0 rounded-[--radius] border border-control-edge bg-card pl-7 pr-7 text-xs text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {query !== "" ? (
        <button
          type="button"
          aria-label={t("clearSearch")}
          title={t("clearSearch")}
          onClick={() => {
            store.setQuery("");
            input.current?.focus();
          }}
          className="absolute right-4 top-[calc(50%+4px)] inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-[--radius] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function GroupTabs({ store, groups, active }: { store: InspectorStore; groups: readonly InspectorGroupId[]; active: InspectorGroupId | null }) {
  const t = useTranslations("studio.inspector");
  const list = useRef<HTMLDivElement>(null);
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!TAB_KEYS.has(event.key) || active === null) return;
    event.preventDefault();
    event.stopPropagation();
    const index = groups.indexOf(active);
    const last = groups.length - 1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowLeft" ? (index <= 0 ? last : index - 1) : index >= last ? 0 : index + 1;
    store.selectGroup(groups[next]);
    list.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(store, groups[next]))}`)?.focus();
  };
  return (
    <div ref={list} role="tablist" aria-label={t("groupsLabel")} onKeyDown={move} className="flex px-1.5 pt-1.5">
      {groups.map((group) => {
        const Glyph = GROUP_ICONS[group];
        const selected = group === active;
        return (
          <button
            key={group}
            id={tabId(store, group)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(store)}
            tabIndex={selected ? 0 : -1}
            title={t(`groups.${group}`)}
            onClick={() => store.selectGroup(group)}
            className={cn(
              "-mb-px flex min-w-0 flex-1 flex-col items-center gap-0.5 border-b-2 border-transparent px-1 pb-1.5 pt-1 text-2xs text-muted-foreground transition-colors",
              "hover:text-foreground focus-visible:rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected && "border-primary font-semibold text-foreground",
            )}
          >
            <Glyph className="h-4 w-4 shrink-0" aria-hidden />
            <span className="w-full truncate text-center">{t(`groups.${group}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function InspectorNav() {
  const t = useTranslations("studio.inspector");
  const store = useInspectorStore();
  const { groups, active, query, sections, matches, searching, tabbed } = useNavState(store);
  if (!store || (sections < SEARCH_MIN_SECTIONS && !tabbed && !searching)) return null;
  return (
    <div className="shrink-0 border-b border-border bg-card">
      {sections >= SEARCH_MIN_SECTIONS || searching ? <SearchField store={store} query={query} /> : null}
      {tabbed ? <GroupTabs store={store} groups={groups} active={active} /> : <div className="h-2" />}
      {searching ? (
        <p role="status" className="px-3 pb-2 text-2xs text-muted-foreground">
          {matches === 0 ? t("noResults", { query: query.trim() }) : t("results", { count: matches })}
        </p>
      ) : null}
    </div>
  );
}

export function InspectorBody({ children, className }: { children: ReactNode; className?: string }) {
  const store = useInspectorStore();
  const { active, tabbed } = useNavState(store);
  const labelled = store && tabbed && active !== null;
  return (
    <div role={labelled ? "tabpanel" : undefined} id={store ? panelId(store) : undefined} aria-labelledby={labelled ? tabId(store, active) : undefined} className={className}>
      {children}
    </div>
  );
}
