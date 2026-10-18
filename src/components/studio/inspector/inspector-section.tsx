"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ArrowCounterClockwise, CaretRight } from "@/components/icons";
import { DEFAULT_INSPECTOR_GROUP, matchesSearch, searchText, type InspectorGroupId } from "@/lib/studio/inspector-layout";
import { cn } from "@/lib/utils";

import { useInheritedGroup, useInspectorStore, useInspectorValue } from "./inspector-context";

const LABEL_SELECTOR = "label, legend, dt, h4, [aria-label]";
const HIT = "data-search-hit";

interface SectionToggle {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

interface SectionReset {
  onReset: () => void;
  disabled?: boolean;
  label?: string;
}

interface InspectorSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  id?: string;
  group?: InspectorGroupId;
  summary?: string | null;
  toggle?: SectionToggle;
  reset?: SectionReset;
  defaultOpen?: boolean;
}

function nameOf(element: Element): string {
  return element.getAttribute("aria-label") ?? element.textContent ?? "";
}

function markHits(body: HTMLElement, query: string): number {
  let hits = 0;
  body.querySelectorAll(LABEL_SELECTOR).forEach((element) => {
    const hit = query !== "" && matchesSearch(query, [nameOf(element)]);
    if (hit) {
      hits += 1;
      element.setAttribute(HIT, "true");
    } else {
      element.removeAttribute(HIT);
    }
  });
  return hits;
}

export function InspectorSection({ title, children, className, action, id, group, summary, toggle, reset, defaultOpen = true }: InspectorSectionProps) {
  const t = useTranslations("studio.inspector");
  const store = useInspectorStore();
  const inherited = useInheritedGroup();
  const resolvedGroup = group ?? inherited ?? DEFAULT_INSPECTOR_GROUP;
  const memoryKey = id ?? title;
  const instance = useId();
  const titleId = `${instance}-title`;
  const bodyId = `${instance}-body`;
  const body = useRef<HTMLDivElement>(null);
  const marked = useRef(false);
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const [matched, setMatched] = useState(true);
  const storedOpen = useInspectorValue(store, (s) => s.isOpen(memoryKey, defaultOpen), localOpen);
  const active = useInspectorValue(store, (s) => s.activeGroup(), null);
  const query = useInspectorValue(store, (s) => s.query(), "");
  const searching = searchText(query) !== "";
  const open = searching || storedOpen;
  const hidden = searching ? !matched : active !== null && active !== resolvedGroup;

  useLayoutEffect(() => {
    if (!store) return;
    store.register(instance, resolvedGroup);
    return () => store.unregister(instance);
  }, [store, instance, resolvedGroup]);

  useLayoutEffect(() => {
    const root = body.current;
    if (!root || (!searching && !marked.current)) return;
    const hits = markHits(root, searching ? query : "");
    marked.current = searching;
    const next = !searching || matchesSearch(query, [title]) || hits > 0;
    setMatched(next);
    store?.setMatched(instance, next);
  }, [searching, query, title, store, instance, children]);

  const flip = () => {
    if (searching) return;
    if (store) store.setOpen(memoryKey, !storedOpen);
    else setLocalOpen(!storedOpen);
  };

  return (
    <section aria-labelledby={titleId} hidden={hidden} data-inspector-group={resolvedGroup} className={cn("border-b border-border last:border-b-0", className)}>
      <div className="flex min-h-9 items-center gap-1 py-1 pl-1.5 pr-3">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={flip}
            className="flex w-full min-w-0 items-center gap-1.5 rounded-[--radius] px-1.5 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CaretRight aria-hidden className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none", open && "rotate-90")} />
            <span id={titleId} className="shrink-0 truncate text-xs font-semibold leading-[1.3] tracking-[-0.005em] text-foreground">
              {title}
            </span>
            {!open && summary ? <span className="readout min-w-0 flex-1 truncate text-2xs text-muted-foreground">{summary}</span> : null}
          </button>
        </h3>
        {action}
        {reset ? (
          <button
            type="button"
            aria-label={reset.label ?? t("reset", { section: title })}
            title={reset.label ?? t("reset", { section: title })}
            disabled={reset.disabled}
            onClick={reset.onReset}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
          >
            <ArrowCounterClockwise className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {toggle ? (
          <ElevatedSwitch
            aria-label={toggle.label ?? t("enable", { section: title })}
            title={toggle.label ?? t("enable", { section: title })}
            checked={toggle.checked}
            disabled={toggle.disabled}
            onCheckedChange={toggle.onChange}
          />
        ) : null}
      </div>
      <div
        ref={body}
        id={bodyId}
        hidden={!open}
        className="space-y-2 px-3 pb-3 [&_[data-search-hit]]:font-semibold [&_[data-search-hit]]:text-foreground [&_[data-search-hit]]:underline [&_[data-search-hit]]:decoration-primary [&_[data-search-hit]]:underline-offset-2"
      >
        {children}
      </div>
    </section>
  );
}
