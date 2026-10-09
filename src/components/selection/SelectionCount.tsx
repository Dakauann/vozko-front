"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { wideSize, type WideSelection, type WideSelectionMode } from "@/lib/selection/bulk-state";

export interface SelectionOffer {
  count: number;
  mode: Extract<WideSelectionMode, "all_matching" | "everyone">;
}

const WIDE_LABEL: Record<WideSelectionMode, string> = {
  all_matching: "allMatchingSelected",
  everyone: "everyoneSelected",
  first_n: "quantitySelected",
};

export const SELECTION_LINK =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-[13px] font-medium text-primary-ink underline underline-offset-[3px] hover:decoration-2 active:text-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60";

export function SelectionCount({
  namespace,
  picked,
  wide,
  counting,
  offer,
  onSelectAll,
  onClear,
  modes,
}: {
  namespace: string;
  picked: number;
  wide: WideSelection | null;
  counting: boolean;
  offer: SelectionOffer | null;
  onSelectAll: () => void;
  onClear: () => void;
  modes?: ReactNode;
}) {
  const t = useTranslations(namespace);

  if (wide) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="whitespace-nowrap text-sm font-semibold text-primary-ink" aria-live="polite">
          {t(WIDE_LABEL[wide.mode], { count: wideSize(wide), matched: wide.matched })}
        </span>
        <button type="button" onClick={onClear} className={SELECTION_LINK}>
          {t("clearSelection")}
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {picked > 0 ? (
        <span className="whitespace-nowrap text-sm font-semibold text-primary-ink" aria-live="polite">
          {t("selectedCount", { count: picked })}
        </span>
      ) : null}
      {offer ? (
        <button
          type="button"
          onClick={onSelectAll}
          disabled={counting}
          aria-busy={counting}
          className={SELECTION_LINK}
        >
          {counting ? t("counting") : t(offer.mode === "everyone" ? "selectEveryone" : "selectAllMatching", { count: offer.count })}
        </button>
      ) : null}
      {modes}
    </span>
  );
}
