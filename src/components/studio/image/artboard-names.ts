"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { artboardNames } from "@/lib/studio/artboards";

import { useImageDoc } from "./editor-state";

export function useArtboardNames(): ReadonlyMap<string, string> {
  const t = useTranslations("studio.image.artboards");
  const artboards = useImageDoc((s) => s.document.artboards);
  return useMemo(() => artboardNames(artboards, (position) => t("untitled", { number: position })), [artboards, t]);
}
