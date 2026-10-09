"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export interface OutcomeOption {
  code: string;
  label: string;
  isDurable?: boolean;
  icon?: ReactNode;
}

export type OutcomeOptionsLayout = "list" | "chips";

const OPTION_CLASS: Record<OutcomeOptionsLayout, { base: string; on: string; off: string }> = {
  list: {
    base: "flex w-full items-center justify-between gap-3 rounded-[--radius] border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    on: "border-primary-edge bg-muted text-foreground",
    off: "border-border text-muted-foreground hover:text-foreground",
  },
  chips: {
    base: "inline-flex h-8 items-center gap-1.5 rounded-[--radius] border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
    on: "border-primary-edge bg-primary text-primary-foreground shadow-button-primary",
    off: "border-border bg-card text-foreground hover:bg-muted",
  },
};

export function OutcomeOptions({
  label,
  outcomes,
  selected,
  onSelect,
  onConfirm,
  layout = "list",
  disabled = false,
}: {
  label: string;
  outcomes: readonly OutcomeOption[];
  selected: string;
  onSelect: (code: string) => void;
  onConfirm?: () => void;
  layout?: OutcomeOptionsLayout;
  disabled?: boolean;
}) {
  const t = useTranslations("crm.outcomeCapture");
  const style = OPTION_CLASS[layout];

  return (
    <ul className={layout === "list" ? "space-y-1.5" : "flex flex-wrap gap-1.5"} role="radiogroup" aria-label={label}>
      {outcomes.map((outcome) => {
        const on = selected === outcome.code;
        return (
          <li key={outcome.code}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onSelect(outcome.code)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && onConfirm) onConfirm();
              }}
              className={cn(style.base, on ? style.on : style.off)}
            >
              {outcome.icon ? <span aria-hidden className="inline-flex [&_svg]:h-3.5 [&_svg]:w-3.5">{outcome.icon}</span> : null}
              <span>{outcome.label}</span>
              {outcome.isDurable && layout === "list" ? (
                <span className="text-2xs font-semibold uppercase tracking-wide text-healthy-ink">{t("durable")}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
