"use client";

import { useMemo } from "react";

import { drawPresetTile, patternLayout, patternPlacement, patternTileSize, type Pattern } from "@/lib/studio/pattern";

import { loadAssetImage, useLoadedImage } from "./asset-images";

interface PatternFillProps {
  fillPriority: "pattern";
  fillPatternImage: HTMLImageElement;
  fillPatternRepeat: "repeat";
  fillPatternX: number;
  fillPatternY: number;
  fillPatternRotation: number;
  fillPatternScaleX: number;
  fillPatternScaleY: number;
  fillPatternOffsetX: number;
  fillPatternOffsetY: number;
}

type PatternFillState = { status: "loading" } | { status: "failed"; error: Error } | { status: "ready"; props: PatternFillProps };

const MAX_TILE_SIDE = 4096;

function tileCanvas(pattern: Pattern, picture: HTMLImageElement | null, pixelRatio: number, box: { width: number; height: number }, shift: number): PatternFillProps {
  const natural = picture ? { width: picture.naturalWidth, height: picture.naturalHeight } : null;
  const tile = patternTileSize(pattern, natural);
  const layout = patternLayout(pattern, tile.width, tile.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(MAX_TILE_SIDE, Math.max(1, Math.round(layout.width * pixelRatio)));
  canvas.height = Math.min(MAX_TILE_SIDE, Math.max(1, Math.round(layout.height * pixelRatio)));
  const sx = canvas.width / layout.width;
  const sy = canvas.height / layout.height;
  const ctx = canvas.getContext("2d")!;
  for (const point of layout.placements) {
    ctx.save();
    ctx.translate(point.x * sx, point.y * sy);
    ctx.scale(sx, sy);
    if (picture) ctx.drawImage(picture, 0, 0, tile.width, tile.height);
    else if (pattern.presetId) drawPresetTile(ctx, pattern.presetId, tile.width, pattern.color ?? "", pattern.background ?? "");
    ctx.restore();
  }
  const place = patternPlacement(pattern, layout, box, tile);
  return {
    fillPriority: "pattern",
    fillPatternImage: canvas as unknown as HTMLImageElement,
    fillPatternRepeat: "repeat",
    fillPatternX: place.x + shift,
    fillPatternY: place.y + shift,
    fillPatternRotation: place.rotation,
    fillPatternScaleX: 1 / sx,
    fillPatternScaleY: 1 / sy,
    fillPatternOffsetX: place.offsetX * sx,
    fillPatternOffsetY: place.offsetY * sy,
  };
}

const NO_PATTERN: PatternFillState = { status: "failed", error: new Error("studio pattern paint without a pattern") };
const LOADING: PatternFillState = { status: "loading" };

export function usePatternFill(pattern: Pattern | undefined, pixelRatio: number, width: number, height: number, shift: number): PatternFillState {
  const asset = pattern?.source === "asset" ? (pattern.assetId ?? "") : null;
  const loaded = useLoadedImage(asset, loadAssetImage);
  const picture = asset !== null && loaded.status === "ready" ? loaded.image : null;
  const props = useMemo(() => (pattern && (asset === null || picture) ? tileCanvas(pattern, picture, pixelRatio, { width, height }, shift) : null), [pattern, asset, picture, pixelRatio, width, height, shift]);
  const failure = asset !== null && loaded.status === "failed" ? loaded : null;
  return useMemo((): PatternFillState => {
    if (!pattern) return NO_PATTERN;
    if (failure) return failure;
    return props ? { status: "ready", props } : LOADING;
  }, [pattern, failure, props]);
}
