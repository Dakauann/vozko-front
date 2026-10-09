"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, CaretUp } from "@/components/icons";
import { cn } from "@/lib/utils";

import { MAP_PANEL_PLACEMENT } from "./map-layout";

export interface MapPanelProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export function MapPanel({ title, children, actions, defaultExpanded = false, className }: MapPanelProps) {
  const t = useTranslations("leadMap.panel");
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bodyId = useId();
  const titleId = useId();

  return (
    <aside
      aria-labelledby={titleId}
      data-expanded={expanded ? "true" : "false"}
      className={cn(
        "z-20 flex flex-col border-border bg-card text-card-foreground shadow-lg",
        "absolute inset-x-0 bottom-0 max-h-[70%] rounded-t-xl border-t",
        MAP_PANEL_PLACEMENT,
        "sm:rounded-[--radius] sm:border sm:border-border-strong sm:shadow-lg",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 sm:sr-only">
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
        </h2>
        {actions}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
        >
          {expanded ? <CaretDown size={16} aria-hidden="true" /> : <CaretUp size={16} aria-hidden="true" />}
          <span className="sr-only">{expanded ? t("collapse") : t("expand")}</span>
        </button>
      </div>
      <div id={bodyId} className={cn("min-h-0 flex-1 overflow-y-auto px-3.5", !expanded && "max-sm:hidden")}>
        {children}
      </div>
    </aside>
  );
}
