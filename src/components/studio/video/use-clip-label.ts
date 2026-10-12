"use client";

import { useTranslations } from "next-intl";

import { shownText } from "@/lib/studio/counter";
import type { Clip } from "@/lib/studio/document";

export type ClipLabeler = (clip: Clip) => string;

export function useClipLabeler(): ClipLabeler {
  const t = useTranslations("studio.video.timeline.clipTypes");
  const tv = useTranslations("studio.video.vfx.kinds");
  return (clip) => {
    if (clip.name) return clip.name;
    if (clip.type === "effect" && clip.vfx?.length) return clip.vfx.map((vfx) => tv(vfx.kind)).join(" + ");
    if (clip.type === "group") return t("group");
    if (clip.type === "overlay" && clip.layer) {
      if (clip.layer.type === "text") return shownText(clip) || t("text");
      if (clip.layer.type === "shape") return t(`shapes.${clip.layer.shape ?? "rect"}`);
      return t(clip.layer.type);
    }
    return t(clip.type);
  };
}

export function useClipLabel(clip: Clip): string {
  return useClipLabeler()(clip);
}
