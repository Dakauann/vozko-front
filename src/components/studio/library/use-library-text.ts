"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";

import { labelText, libraryLocale } from "@/lib/studio/library/catalog";
import type { LibraryLabel, LibrarySlot } from "@/lib/studio/library/model";

export interface LibraryText {
  locale: string;
  label: (label: LibraryLabel) => string;
  sample: (slot: LibrarySlot) => string;
}

export function useLibraryText(): LibraryText {
  const translate = useTranslations();
  const locale = useLocale();
  const label = useCallback((value: LibraryLabel) => labelText(value, (key) => translate(key), libraryLocale(locale)), [translate, locale]);
  const sample = useCallback((slot: LibrarySlot) => label(slot.sample), [label]);
  return { locale, label, sample };
}
