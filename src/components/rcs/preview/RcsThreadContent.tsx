"use client";

import { useTranslations } from "next-intl";

import type { RcsContent } from "@/lib/rcs/types";

import { accentStyle } from "./palette";
import { CarouselView, RichCardView, SuggestionChips } from "./RcsMessageView";

export function RcsThreadCards({ content }: { content: RcsContent }) {
  const t = useTranslations("rcs.preview");
  const cards = content.cards ?? [];
  if (cards.length === 0) return null;
  return (
    <div style={accentStyle(undefined)} className="w-[min(320px,70vw)] max-w-full overflow-hidden px-3">
      {cards.length === 1 ? <RichCardView card={cards[0]} platform="android" label={t("richCard")} fluid /> : <CarouselView cards={cards} platform="android" />}
    </div>
  );
}

export function RcsThreadSuggestions({ content }: { content: RcsContent }) {
  const suggestions = content.suggestions ?? [];
  if (suggestions.length === 0) return null;
  return (
    <div style={accentStyle(undefined)} className="mt-2 max-w-[min(320px,70vw)] overflow-hidden px-3">
      <SuggestionChips suggestions={suggestions} platform="android" />
    </div>
  );
}
