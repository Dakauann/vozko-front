"use client";

import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Buildings, MagnifyingGlass, MapPin, X } from "@/components/icons";
import { useLeadSection } from "@/hooks/use-lead-section";
import type { LeadFilter } from "@/lib/leads/filters";
import {
  LEAD_SEARCH_DEBOUNCE_MS,
  committedLeadSearch,
  leadSearchOptions,
  withPickedPlace,
  type LeadSearchOption,
} from "@/lib/leads/search";
import { cn } from "@/lib/utils";

export interface LeadSearchBoxProps {
  search: string;
  onSearchChange: (search: string) => void;
  filter: LeadFilter;
  onPickPlace: (filter: LeadFilter) => void;
  resultCount?: number | null;
}

const GROUP_ICON: Record<LeadSearchOption["kind"], ReactNode> = {
  leads: <MagnifyingGlass weight="bold" className="h-3.5 w-3.5" />,
  district: <MapPin weight="fill" className="h-3.5 w-3.5" />,
  city: <Buildings weight="fill" className="h-3.5 w-3.5" />,
};

const GROUP_LABEL_KEY: Record<LeadSearchOption["kind"], string> = {
  leads: "search.groups.leads",
  district: "search.groups.districts",
  city: "search.groups.cities",
};

export function LeadSearchBox({ search, onSearchChange, filter, onPickPlace, resultCount = null }: LeadSearchBoxProps) {
  const t = useTranslations("leadsPage");
  const baseId = useId();
  const listboxId = `${baseId}-places`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [draft, setDraft] = useState(search);
  const [shownSearch, setShownSearch] = useState(search);
  const [suggestFor, setSuggestFor] = useState(committedLeadSearch(search));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [committed, setCommitted] = useState(search);

  if (shownSearch !== search) {
    setShownSearch(search);
    if (search !== committed) {
      setCommitted(search);
      setDraft(search);
      setSuggestFor(committedLeadSearch(search));
    }
  }

  useEffect(() => {
    const next = committedLeadSearch(draft);
    if (next === committed && next === suggestFor) return;
    const timer = setTimeout(() => {
      setSuggestFor(next);
      if (next === committed) return;
      setCommitted(next);
      onSearchChange(next);
    }, LEAD_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, committed, suggestFor, onSearchChange]);

  const places = useLeadSection("places", { filter, place: suggestFor }, { enabled: open && suggestFor !== "" });
  const options = leadSearchOptions(draft, committedLeadSearch(draft) === suggestFor ? places.data ?? null : null);
  const expanded = open && options.length > 0;

  const commitNow = (value: string) => {
    const next = committedLeadSearch(value);
    setSuggestFor(next);
    if (next === committed) return;
    setCommitted(next);
    onSearchChange(next);
  };

  const clear = () => {
    setDraft("");
    setOpen(false);
    setActive(-1);
    commitNow("");
  };

  const choose = (option: LeadSearchOption) => {
    setOpen(false);
    setActive(-1);
    if (option.kind === "leads") {
      commitNow(draft);
      return;
    }
    setDraft("");
    setSuggestFor("");
    setCommitted("");
    onPickPlace(withPickedPlace(filter, option));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (options.length === 0) return;
        event.preventDefault();
        setOpen(true);
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((current) => {
          if (current < 0) return step > 0 ? 0 : options.length - 1;
          return (current + step + options.length) % options.length;
        });
        return;
      }
      case "Enter": {
        event.preventDefault();
        const picked = expanded && active >= 0 ? options[active] : undefined;
        if (picked) {
          choose(picked);
          return;
        }
        setOpen(false);
        commitNow(draft);
        return;
      }
      case "Escape": {
        event.preventDefault();
        if (expanded) {
          setOpen(false);
          setActive(-1);
          return;
        }
        clear();
        return;
      }
      case "Tab":
        setOpen(false);
        setActive(-1);
    }
  };

  const announcement = search !== "" && resultCount !== null ? t("search.results", { count: resultCount }) : "";

  return (
    <div className="relative w-full">
      <ElevatedInput
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        placeholder={t("search.placeholder")}
        aria-label={t("search.label")}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        icon={<MagnifyingGlass weight="bold" className="h-4 w-4" />}
        controlSize="sm"
        className="w-full"
        inputClassName={draft !== "" ? "pr-8" : undefined}
      />
      {draft !== "" ? (
        <button
          type="button"
          onClick={clear}
          aria-label={t("search.clear")}
          title={t("search.clear")}
          className="absolute inset-y-0 right-1.5 my-auto flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <X weight="bold" className="h-3 w-3" />
        </button>
      ) : null}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      <ul
        id={listboxId}
        role="listbox"
        aria-label={t("search.label")}
        hidden={!expanded}
        className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-md"
      >
        {options.map((option, index) => {
          const firstOfGroup = index === 0 || options[index - 1].kind !== option.kind;
          return (
            <li key={option.id} role="presentation">
              {firstOfGroup ? (
                <div aria-hidden="true" className="px-2 pb-1 pt-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(GROUP_LABEL_KEY[option.kind])}
                </div>
              ) : null}
              <div
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground",
                  index === active && "bg-muted",
                )}
              >
                <span className="shrink-0 text-muted-foreground">{GROUP_ICON[option.kind]}</span>
                {option.kind === "leads" ? (
                  <span className="min-w-0 truncate">{t("search.searchLeads", { query: option.query })}</span>
                ) : (
                  <>
                    <span className="min-w-0 truncate">
                      {option.name}
                      <span className="text-muted-foreground">, {option.context}</span>
                    </span>
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                      {t("search.leadsCount", { count: option.count })}
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })}
        {places.isError && suggestFor !== "" ? (
          <li role="presentation" className="px-2 py-1.5 text-xs text-muted-foreground">
            {t("search.suggestionsFailed")}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
