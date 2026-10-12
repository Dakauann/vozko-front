"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CaretLeft, MagnifyingGlass, Plus, X } from "@/components/icons";
import { libraryLocale, searchEntries, supports, type LibraryEntry } from "@/lib/studio/library/catalog";
import { assetsReady, readyItem } from "@/lib/studio/library/instantiate";
import type { LibraryCategory, LibraryEditor, LibraryItem, LibraryPanelId, LibraryTile } from "@/lib/studio/library/model";
import { loadedItems, loadItems } from "@/lib/studio/library/store";
import { cn } from "@/lib/utils";

import { useLibraryAssetImport } from "./asset-importer";
import { writeDraggedItem } from "./drag";
import { ItemPreview } from "./item-preview";
import { LibraryCredits } from "./library-credits";
import { useRecentItems } from "./recent-items";
import { RenderedPreview } from "./rendered-preview";
import { playPreview, stopPreview } from "./sound-preview";
import { SoundTileBody } from "./sound-tile";
import { LIBRARY_CATEGORIES } from "./registry";
import { useLibraryText, type LibraryText } from "./use-library-text";

export interface LibraryAdapter {
  editor: LibraryEditor;
  insert: (item: LibraryItem) => boolean;
  extras?: ReadonlyMap<string, readonly LibraryItem[]>;
  aside?: (categoryId: string) => ReactNode;
}

interface Section {
  category: LibraryCategory;
  name: string;
  note: string | null;
  aside?: ReactNode;
  entries: LibraryEntry[];
}

interface OpenCategory {
  id: string;
  subcategory: string | null;
}

const COLUMNS: Record<LibraryTile, number> = { square: 4, card: 2, row: 1, poster: 2, action: 1, sound: 1 };
const HOME_COUNT: Record<LibraryTile, number> = { square: 8, card: 4, row: 4, poster: 6, action: 4, sound: 4 };
const GRID_CLASS: Record<LibraryTile, string> = { square: "grid grid-cols-4 gap-1.5", card: "grid grid-cols-2 gap-1.5", row: "flex flex-col gap-1.5", poster: "grid grid-cols-2 gap-1.5", action: "flex flex-col gap-1.5", sound: "flex flex-col gap-1.5" };
const PAGE = 120;
const NEAR_MARGIN = "320px";
const TILE_BASE =
  "rounded-[--radius] border border-border bg-card text-foreground transition-colors hover:border-border-strong hover:bg-muted active:bg-[hsl(var(--accent-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const LINK_CLASS = "rounded-[--radius] px-1.5 py-0.5 text-2xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function snapshot(categories: readonly LibraryCategory[]): ReadonlyMap<string, readonly LibraryItem[]> {
  return new Map(categories.map((category) => [category.id, loadedItems(category) ?? []]));
}

function useCategoryLists(categories: readonly LibraryCategory[]): ReadonlyMap<string, readonly LibraryItem[]> {
  const [state, setState] = useState(() => ({ categories, lists: snapshot(categories) }));
  if (state.categories !== categories) setState({ categories, lists: snapshot(categories) });
  useEffect(() => {
    const missing = categories.filter((category) => !loadedItems(category));
    if (missing.length === 0) return;
    let live = true;
    void Promise.all(missing.map(loadItems)).then(() => {
      if (live) setState({ categories, lists: snapshot(categories) });
    });
    return () => {
      live = false;
    };
  }, [categories]);
  return state.lists;
}

function nextIndex(key: string, index: number, columns: number, last: number): number | null {
  switch (key) {
    case "ArrowRight":
      return Math.min(index + 1, last);
    case "ArrowLeft":
      return Math.max(index - 1, 0);
    case "ArrowDown":
      return Math.min(index + columns, last);
    case "ArrowUp":
      return Math.max(index - columns, 0);
    case "Home":
      return 0;
    case "End":
      return last;
  }
  return null;
}

function TileBody({ entry, tile, text }: { entry: LibraryEntry; tile: LibraryTile; text: LibraryText }) {
  const { item, name } = entry;
  if (tile === "sound" && item.preview.kind === "sound") return <SoundTileBody assetId={item.preview.assetId} name={name} />;
  if (tile === "action") {
    return (
      <>
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{name}</span>
      </>
    );
  }
  if (item.preview.kind === "render") return <RenderedPreview item={item} name={name} locale={text.locale} sample={text.sample} compact={tile !== "poster"} />;
  if (tile === "square") {
    return item.preview.kind === "text" ? (
      <span aria-hidden className="text-base leading-none" style={{ fontWeight: item.preview.weight }}>
        Aa
      </span>
    ) : (
      <ItemPreview preview={item.preview} name={name} className={item.preview.kind === "icon" || item.category === "icons" ? "h-[22px] w-[22px]" : "h-8 w-8"} />
    );
  }
  const hint = item.hint ? text.label(item.hint) : null;
  if (tile === "card") {
    const slot = item.template.slots?.[0];
    const detail = hint ?? (slot ? text.sample(slot) : null);
    return (
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="max-w-full truncate text-xs font-semibold">{name}</span>
        {detail ? <span className="max-w-full truncate text-2xs text-muted-foreground">{detail}</span> : null}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {item.preview.kind === "text" ? null : <ItemPreview preview={item.preview} name={name} className="h-4 w-4 text-muted-foreground" />}
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        {item.preview.kind === "text" ? <ItemPreview preview={item.preview} name={name} /> : <span className="max-w-full truncate text-xs font-semibold">{name}</span>}
        {hint ? <span className="text-2xs leading-snug text-muted-foreground">{hint}</span> : null}
      </span>
    </span>
  );
}

const TILE_SHAPE: Record<LibraryTile, string> = {
  square: "flex aspect-square w-full items-center justify-center",
  card: "flex h-14 w-full items-center px-2.5 text-left",
  row: "flex w-full items-center px-3 py-2 text-left",
  poster: "flex aspect-[4/3] w-full items-center justify-center p-1",
  action:
    "flex h-9 w-full items-center justify-center gap-1.5 border-transparent bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-button-primary hover:border-transparent hover:bg-[hsl(var(--primary-hover))] active:bg-[hsl(var(--primary-hover))]",
  sound: "flex h-12 w-full items-center px-2 text-left",
};

function soundOf(item: LibraryItem): string | null {
  return item.preview.kind === "sound" ? item.preview.assetId : null;
}

function TileGrid({ entries, tile, label, progressive, text, onInsert }: { entries: readonly LibraryEntry[]; tile: LibraryTile; label: string; progressive?: boolean; text: LibraryText; onInsert: (item: LibraryItem) => void }) {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(PAGE);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const sentinel = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const visible = progressive ? entries.slice(0, shown) : entries;
  const current = Math.max(0, Math.min(active, visible.length - 1));
  const more = progressive && shown < entries.length;

  useEffect(() => {
    if (pendingFocus.current === null) return;
    buttons.current[pendingFocus.current]?.focus();
    pendingFocus.current = null;
  });

  useEffect(() => {
    const element = sentinel.current;
    if (!more || !element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((seen) => {
      if (seen.some((entry) => entry.isIntersecting)) setShown((count) => count + PAGE);
    }, { rootMargin: NEAR_MARGIN });
    observer.observe(element);
    return () => observer.disconnect();
  }, [more, shown]);

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = nextIndex(event.key, index, COLUMNS[tile], entries.length - 1);
    if (target === null) return;
    event.preventDefault();
    if (target >= visible.length) setShown(target + 1);
    pendingFocus.current = target;
    setActive(target);
    buttons.current[target]?.focus();
  };

  return (
    <>
      <div role="group" aria-label={label} className={GRID_CLASS[tile]}>
        {visible.map((entry, index) => (
          <button
            key={entry.item.id}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            draggable
            tabIndex={index === current ? 0 : -1}
            aria-label={entry.name}
            title={entry.name}
            data-library-item={entry.item.id}
            onDragStart={(event) => {
              stopPreview();
              writeDraggedItem(event.dataTransfer, entry.item.id);
            }}
            onFocus={() => {
              setActive(index);
              const sound = soundOf(entry.item);
              if (sound) playPreview(sound);
            }}
            onBlur={() => {
              if (soundOf(entry.item)) stopPreview();
            }}
            onMouseEnter={() => {
              const sound = soundOf(entry.item);
              if (sound) playPreview(sound);
            }}
            onMouseLeave={() => {
              if (soundOf(entry.item)) stopPreview();
            }}
            onKeyDown={(event) => move(event, index)}
            onClick={() => {
              setActive(index);
              onInsert(entry.item);
            }}
            className={cn(TILE_BASE, TILE_SHAPE[tile])}
          >
            <TileBody entry={entry} tile={tile} text={text} />
          </button>
        ))}
      </div>
      {more ? <div ref={sentinel} aria-hidden className="h-px" /> : null}
    </>
  );
}

function SearchField({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  const t = useTranslations("studio.library");
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={input}
        type="search"
        value={value}
        aria-label={t("searchLabel")}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || value === "") return;
          event.preventDefault();
          event.stopPropagation();
          onChange("");
        }}
        className="h-8 w-full min-w-0 rounded-[--radius] border border-control-edge bg-card pl-7 pr-7 text-xs text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {value !== "" ? (
        <button
          type="button"
          aria-label={t("clearSearch")}
          title={t("clearSearch")}
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-[--radius] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function SectionHead({ title, id, action }: { title: string; id: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-2">
      <h3 id={id} className="legend text-muted-foreground">
        {title}
      </h3>
      {action}
    </div>
  );
}

function CategoryBlock({ section, entries, text, onInsert, onSeeAll }: { section: Section; entries: readonly LibraryEntry[]; text: LibraryText; onInsert: (item: LibraryItem) => void; onSeeAll: () => void }) {
  const t = useTranslations("studio.library");
  const id = useId();
  const limit = HOME_COUNT[section.category.tile];
  if (section.category.tile === "action") {
    return (
      <section aria-label={section.name}>
        <TileGrid entries={entries.slice(0, limit)} tile="action" label={section.name} text={text} onInsert={onInsert} />
      </section>
    );
  }
  return (
    <section aria-labelledby={id} className="space-y-2">
      <SectionHead
        id={id}
        title={section.name}
        action={
          entries.length > limit ? (
            <button type="button" onClick={onSeeAll} aria-label={t("seeAllIn", { name: section.name })} className={LINK_CLASS}>
              {t("seeAll")}
            </button>
          ) : null
        }
      />
      {section.note ? <p className="text-2xs leading-snug text-muted-foreground">{section.note}</p> : null}
      {section.aside}
      <TileGrid entries={entries.slice(0, limit)} tile={section.category.tile} label={section.name} text={text} onInsert={onInsert} />
    </section>
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-6 text-center">
      <MagnifyingGlass aria-hidden className="h-5 w-5 text-muted-foreground" />
      <p className="text-xs font-medium text-foreground">{title}</p>
      {hint ? <p className="text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function inSubcategoryOf(entries: readonly LibraryEntry[], id: string): LibraryEntry[] {
  return entries.filter((entry) => entry.item.subcategory === id);
}

function CategoryView({ section, open, query, text, onBack, onSubcategory, onInsert }: { section: Section; open: OpenCategory; query: string; text: LibraryText; onBack: () => void; onSubcategory: (id: string | null) => void; onInsert: (item: LibraryItem) => void }) {
  const t = useTranslations("studio.library");
  const back = useRef<HTMLButtonElement>(null);
  const subcategories = (section.category.subcategories ?? []).filter((sub) => section.entries.some((entry) => entry.item.subcategory === sub.id));
  const inSubcategory = open.subcategory ? section.entries.filter((entry) => entry.item.subcategory === open.subcategory) : section.entries;
  const entries = query.trim() === "" ? inSubcategory : searchEntries(inSubcategory, query, libraryLocale(text.locale));

  const rows = open.subcategory === null && query.trim() === "" && subcategories.length > 1 && section.entries.every((entry) => subcategories.some((sub) => sub.id === entry.item.subcategory)) ? subcategories.map((sub) => ({ id: sub.id, section: { ...section, name: text.label(sub.label), note: null, aside: null, entries: inSubcategoryOf(section.entries, sub.id) } })) : null;

  useEffect(() => back.current?.focus(), []);

  const chip = (id: string | null, label: string) => {
    const selected = open.subcategory === id;
    return (
      <button
        key={id ?? "all"}
        type="button"
        aria-pressed={selected}
        onClick={() => onSubcategory(id)}
        className={cn(
          "h-6 shrink-0 rounded-[--radius] px-2 text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected ? "bg-primary text-primary-foreground shadow-button-primary hover:bg-[hsl(var(--primary-hover))]" : "bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <section aria-label={section.name} className="space-y-3">
      <div className="flex items-center gap-1">
        <button
          ref={back}
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          title={t("back")}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CaretLeft className="h-4 w-4" aria-hidden />
        </button>
        <h3 className="min-w-0 flex-1 truncate font-display text-sm font-semibold tracking-[-0.01em] text-foreground">{section.name}</h3>
        <span className="readout shrink-0 text-2xs text-muted-foreground">{t("count", { count: entries.length })}</span>
      </div>
      {section.note ? <p className="text-2xs leading-snug text-muted-foreground">{section.note}</p> : null}
      {section.aside}
      {subcategories.length > 0 ? (
        <div role="group" aria-label={section.name} className="flex flex-wrap gap-1">
          {chip(null, t("all"))}
          {subcategories.map((sub) => chip(sub.id, text.label(sub.label)))}
        </div>
      ) : null}
      {entries.length === 0 ? (
        query.trim() === "" ? <EmptyState title={t("emptyCategory")} /> : <EmptyState title={t("noResults", { query: query.trim() })} hint={t("noResultsHint")} />
      ) : rows ? (
        <div className="space-y-4">
          {rows.map((row) => (
            <CategoryBlock key={row.id} section={row.section} entries={row.section.entries} text={text} onInsert={onInsert} onSeeAll={() => onSubcategory(row.id)} />
          ))}
        </div>
      ) : (
        <TileGrid key={`${open.subcategory ?? "all"}:${query}`} entries={entries} tile={section.category.tile} label={section.name} progressive text={text} onInsert={onInsert} />
      )}
    </section>
  );
}

interface LibraryPanelProps {
  panel: LibraryPanelId;
  adapter: LibraryAdapter;
  searchPlaceholder: string;
  leading?: ReactNode;
}

export function LibraryPanel({ panel, adapter, searchPlaceholder, leading }: LibraryPanelProps) {
  const t = useTranslations("studio.library");
  const text = useLibraryText();
  useLibraryAssetImport();
  const recent = useRecentItems();
  const recentId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<OpenCategory | null>(null);
  const categories = useMemo(() => LIBRARY_CATEGORIES.filter((category) => category.panel === panel), [panel]);
  const lists = useCategoryLists(categories);
  const { editor, extras, aside } = adapter;
  const { label } = text;
  const locale = libraryLocale(text.locale);

  const sections = useMemo<Section[]>(
    () =>
      categories
        .map((category) => ({
          category,
          name: label(category.label),
          note: category.notes?.[editor] ? label(category.notes[editor]) : null,
          aside: aside?.(category.id) ?? null,
          entries: [...(extras?.get(category.id) ?? []), ...(lists.get(category.id) ?? [])].filter((item) => supports(item, editor)).map((item) => ({ item, name: label(item.label) })),
        }))
        .filter((section) => section.entries.length > 0),
    [categories, lists, editor, label, extras, aside],
  );
  const known = useMemo(() => new Map(sections.flatMap((section) => section.entries.map((entry) => [entry.item.id, entry] as const))), [sections]);
  const recents = recent.ids.flatMap((id) => known.get(id) ?? []);
  const openSection = open ? sections.find((section) => section.category.id === open.id) : undefined;
  const searching = query.trim() !== "";
  const results = searching && !openSection ? sections.map((section) => ({ section, entries: searchEntries(section.entries, query, locale) })).filter((found) => found.entries.length > 0) : [];

  const loading = useRef(new Set<string>());
  const [failed, setFailed] = useState<string | null>(null);
  const insert = useCallback(
    (item: LibraryItem) => {
      if (loading.current.has(item.id)) return;
      setFailed(null);
      if (assetsReady(item)) {
        adapter.insert(item);
        return;
      }
      loading.current.add(item.id);
      void readyItem(item).then((ready) => {
        loading.current.delete(item.id);
        if (ready) adapter.insert(item);
        else setFailed(label(item.label));
      });
    },
    [adapter, label],
  );

  return (
    <div
      className="space-y-3"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !openSection || event.defaultPrevented) return;
        event.preventDefault();
        setOpen(null);
      }}
    >
      <div className="space-y-1.5">
        <SearchField value={query} placeholder={openSection ? t("search.category", { name: openSection.name }) : searchPlaceholder} onChange={setQuery} />
        <p className="text-2xs leading-snug text-muted-foreground">{t(`hint.${editor}`)}</p>
        {failed ? (
          <p role="alert" className="text-2xs leading-snug text-destructive">
            {t("insertFailed", { name: failed })}
          </p>
        ) : null}
      </div>
      {openSection && open ? (
        <CategoryView section={openSection} open={open} query={query} text={text} onBack={() => setOpen(null)} onSubcategory={(subcategory) => setOpen({ id: openSection.category.id, subcategory })} onInsert={insert} />
      ) : searching ? (
        results.length === 0 ? (
          <EmptyState title={t("noResults", { query: query.trim() })} hint={t("noResultsHint")} />
        ) : (
          <div className="space-y-4">
            {results.map(({ section, entries }) => (
              <CategoryBlock key={section.category.id} section={section} entries={entries} text={text} onInsert={insert} onSeeAll={() => setOpen({ id: section.category.id, subcategory: null })} />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {leading}
          {recents.length > 0 ? (
            <section aria-labelledby={recentId} className="space-y-2">
              <SectionHead
                id={recentId}
                title={t("recent")}
                action={
                  <button type="button" onClick={recent.clear} className={LINK_CLASS}>
                    {t("clearRecent")}
                  </button>
                }
              />
              <TileGrid entries={recents} tile="square" label={t("recent")} text={text} onInsert={insert} />
            </section>
          ) : null}
          {sections.map((section) => (
            <CategoryBlock key={section.category.id} section={section} entries={section.entries} text={text} onInsert={insert} onSeeAll={() => setOpen({ id: section.category.id, subcategory: null })} />
          ))}
          {sections.some((section) => section.entries.some((entry) => entry.item.source.license !== "own")) ? (
            <div className="flex justify-end">
              <LibraryCredits />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
