"use client";

import type { RefObject } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { ArrowDown, ArrowUp, MagnifyingGlass, Spinner, X } from "@/components/icons";
import { panelSettleTransition } from "@/lib/motion/tokens";

const SMALL_ROUND = "flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted transition-colors";

export function ThreadSearchBar({
  inputRef,
  value,
  searching,
  totalItems,
  currentIndex,
  hasResults,
  onChange,
  onPrevious,
  onNext,
  onClose,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  searching: boolean;
  totalItems: number;
  currentIndex: number;
  hasResults: boolean;
  onChange: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const tCrm = useTranslations("crm");
  const t = useTranslations("crmConversation.thread.search");

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={panelSettleTransition}
      className="relative z-[30] overflow-hidden border-b border-border bg-card shadow-sm"
    >
      <div className="flex items-center gap-2 px-3 ">
        <MagnifyingGlass weight="bold" className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter") {
              if (e.shiftKey) onPrevious();
              else onNext();
            }
          }}
          placeholder={tCrm("searchMessagesPlaceholder")}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />

        {searching && <Spinner className="h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />}

        {value.trim().length >= 2 && !searching && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-2xs font-medium text-muted-foreground tabular-nums">
              {totalItems > 0 ? `${currentIndex + 1}/${totalItems}` : t("noResults")}
            </span>
            <button type="button" onClick={onPrevious} disabled={!hasResults} aria-label={t("previous")} className={`${SMALL_ROUND} disabled:opacity-30`}>
              <ArrowUp weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button type="button" onClick={onNext} disabled={!hasResults} aria-label={t("next")} className={`${SMALL_ROUND} disabled:opacity-30`}>
              <ArrowDown weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        <button type="button" onClick={onClose} aria-label={t("close")} className={`${SMALL_ROUND} flex-shrink-0`}>
          <X weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </motion.div>
  );
}
