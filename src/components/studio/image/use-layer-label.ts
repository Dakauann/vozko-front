"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import type { Layer } from "@/lib/studio/document";
import { layerCaption } from "@/lib/studio/layer-list";

export type LayerLabeler = (layer: Layer) => string;

export function useLayerLabeler(): LayerLabeler {
  const t = useTranslations("studio.image.layerKinds");
  return useCallback(
    (layer: Layer) => {
      const caption = layerCaption(layer);
      return "name" in caption ? caption.name : t(caption.kind);
    },
    [t],
  );
}
