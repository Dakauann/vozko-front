"use client";

import { useCallback, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, MagnifyingGlass } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchFonts } from "@/lib/studio/font-search";
import { FONT_SPRITE, fontSpriteOffset } from "@/lib/studio/font-sprite";
import { FONT_CATEGORIES, nearestFontWeight, STUDIO_FONTS, type FontCategory, type FontId } from "@/lib/studio/fonts";
import { cn } from "@/lib/utils";

import { FIELD_CLASS, LABEL_CLASS } from "../image/controls";
import { INPUT_CLASS } from "../video/inspector/fields";

const PREVIEW_WEIGHT = 400;

const CHIP_CLASS = "h-6 shrink-0 rounded-[--radius] px-2 text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function fontFace(id: FontId): { fontFamily: string; fontWeight: number } {
  return { fontFamily: `"${STUDIO_FONTS[id].family}", system-ui, sans-serif`, fontWeight: nearestFontWeight(id, PREVIEW_WEIGHT) };
}

interface FontPickerProps {
  label: string;
  value: FontId | null;
  mixedLabel: string;
  onChange: (id: FontId) => void;
  disabled?: boolean;
  layout?: "inline" | "stacked";
}

function spriteStyle(id: FontId): CSSProperties {
  const mask = `url("${FONT_SPRITE.src}")`;
  const position = `0 -${fontSpriteOffset(id)}px`;
  const size = `${FONT_SPRITE.width}px auto`;
  return { width: FONT_SPRITE.width, height: FONT_SPRITE.row, maskImage: mask, WebkitMaskImage: mask, maskPosition: position, WebkitMaskPosition: position, maskSize: size, WebkitMaskSize: size, maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" };
}

function FontOption({ id, selected, active, category, onPick, onHover }: { id: FontId; selected: boolean; active: boolean; category: string | null; onPick: () => void; onHover: () => void }) {
  return (
    <li
      id={`font-${id}`}
      role="option"
      aria-selected={selected}
      data-active={active || undefined}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onHover}
      onClick={onPick}
      className={cn("flex h-8 cursor-pointer items-center justify-between gap-2 rounded-[--radius] px-2 text-foreground", active && "bg-muted", selected && "ring-1 ring-inset ring-border-strong")}
    >
      <span className="sr-only">{STUDIO_FONTS[id].family}</span>
      <span aria-hidden data-font-sprite={id} className="min-w-0 max-w-full shrink overflow-hidden bg-current" style={spriteStyle(id)} />
      {category ? (
        <span aria-hidden className="shrink-0 text-2xs text-muted-foreground">
          {category}
        </span>
      ) : null}
    </li>
  );
}

export function FontPicker({ label, value, mixedLabel, onChange, disabled, layout = "inline" }: FontPickerProps) {
  const t = useTranslations("studio.fontPicker");
  const labelId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FontCategory | null>(null);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const categoryName = useCallback((id: FontCategory) => t(`categories.${id}`), [t]);
  const found = useMemo(() => searchFonts(query, category, categoryName), [query, category, categoryName]);
  const current = Math.min(active, Math.max(0, found.length - 1));

  const reset = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setQuery("");
    setCategory(null);
    setActive(Math.max(0, value ? searchFonts("", null, categoryName).indexOf(value) : 0));
  };

  const pick = (id: FontId) => {
    onChange(id);
    setOpen(false);
  };

  const move = (index: number) => {
    setActive(index);
    list.current?.querySelector(`#font-${found[index]}`)?.scrollIntoView({ block: "nearest" });
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (found.length > 0) move(event.key === "ArrowDown" ? Math.min(current + 1, found.length - 1) : Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && found[current]) {
      event.preventDefault();
      pick(found[current]);
    }
  };

  const chip = (id: FontCategory | null, name: string) => (
    <button
      key={id ?? "all"}
      type="button"
      aria-pressed={category === id}
      onClick={() => {
        setCategory(id);
        setActive(0);
      }}
      className={cn(CHIP_CLASS, category === id ? "bg-primary text-primary-foreground shadow-button-primary hover:bg-[hsl(var(--primary-hover))]" : "bg-muted text-muted-foreground hover:text-foreground")}
    >
      {name}
    </button>
  );

  return (
    <div className={layout === "inline" ? "flex min-w-0 items-center gap-1.5" : "space-y-1"}>
      <span id={labelId} className={layout === "inline" ? LABEL_CLASS : "block text-2xs text-muted-foreground"}>
        {label}
      </span>
      <Popover open={open} onOpenChange={reset}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-labelledby={labelId}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-haspopup="listbox"
            disabled={disabled}
            className={cn(layout === "inline" ? FIELD_CLASS : INPUT_CLASS, "flex items-center justify-between gap-1 text-left")}
          >
            {value ? (
              <span className="min-w-0 truncate" style={fontFace(value)}>
                {STUDIO_FONTS[value].family}
              </span>
            ) : (
              <span className="min-w-0 truncate italic text-muted-foreground">{mixedLabel}</span>
            )}
            <CaretDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-2 p-2">
          <div className="relative">
            <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              autoFocus
              value={query}
              aria-label={t("search")}
              aria-controls={listId}
              aria-activedescendant={found[current] ? `font-${found[current]}` : undefined}
              placeholder={t("search")}
              spellCheck={false}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              className="h-8 w-full min-w-0 rounded-[--radius] border border-control-edge bg-card pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-muted [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <div role="group" aria-label={label} className="flex flex-wrap gap-1">
            {chip(null, t("all"))}
            {FONT_CATEGORIES.map((id) => chip(id, categoryName(id)))}
          </div>
          <ul ref={list} id={listId} role="listbox" aria-labelledby={labelId} className="max-h-64 overflow-y-auto">
            {found.map((id, index) => (
              <FontOption key={id} id={id} selected={id === value} active={index === current} category={category ? null : categoryName(STUDIO_FONTS[id].category)} onPick={() => pick(id)} onHover={() => setActive(index)} />
            ))}
          </ul>
          {found.length === 0 ? (
            <p role="status" className="px-2 py-3 text-center text-xs text-muted-foreground">
              {t("empty", { query: query.trim() })}
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
