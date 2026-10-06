"use client";

import { memo, useEffect, useState } from "react";

import type { Clip } from "@/lib/studio/document";
import { planFilmstrip, tileWidth, type FilmstripTile } from "@/lib/studio/filmstrip";
import type { Span } from "@/lib/studio/timeline-view";

import { useVideoEditor } from "../editor-context";
import { useAssetUrl } from "../use-asset";

const VIDEO_ASPECT = 16 / 9;

function FrameTile({ assetId, tile, heightPx }: { assetId: string; tile: FilmstripTile; heightPx: number }) {
  const { frames } = useVideoEditor();
  const [loaded, setLoaded] = useState<{ key: string; url: string | null } | null>(null);
  const key = `${assetId}:${tile.sourceMs}:${heightPx}`;
  const cached = frames.cached(assetId, tile.sourceMs, heightPx);

  useEffect(() => {
    if (cached) return;
    const controller = new AbortController();
    void frames.request(assetId, tile.sourceMs, heightPx, controller.signal).then((url) => {
      if (!controller.signal.aborted) setLoaded({ key, url });
    });
    return () => controller.abort();
  }, [frames, assetId, tile.sourceMs, heightPx, key, cached]);

  const url = cached ?? (loaded?.key === key ? loaded.url : null);
  return (
    <div className="absolute inset-y-0 overflow-hidden border-r border-background bg-muted" style={{ left: tile.leftPx, width: tile.widthPx }}>
      {url ? <img src={url} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" /> : null}
    </div>
  );
}

interface FilmstripProps {
  clip: Clip;
  widthPx: number;
  heightPx: number;
  span: Span;
  sourceDurationMs?: number;
}

export const VideoFilmstrip = memo(function VideoFilmstrip({ clip, widthPx, heightPx, span, sourceDurationMs }: FilmstripProps) {
  if (!clip.assetId) return null;
  const tiles = planFilmstrip({
    clipWidthPx: widthPx,
    heightPx,
    aspect: VIDEO_ASPECT,
    trimInMs: clip.trimInMs,
    durationMs: clip.durationMs,
    visibleFromPx: span.fromPx,
    visibleToPx: span.toPx,
    sourceDurationMs,
  });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {tiles.map((tile) => (
        <FrameTile key={tile.index} assetId={clip.assetId!} tile={tile} heightPx={heightPx} />
      ))}
    </div>
  );
});

export const ImageFilmstrip = memo(function ImageFilmstrip({ clip, widthPx, heightPx, span }: FilmstripProps) {
  const url = useAssetUrl(clip.assetId);
  if (!url) return null;
  const width = tileWidth(heightPx, 1);
  const first = Math.floor(span.fromPx / width);
  const last = Math.ceil(Math.min(widthPx, span.toPx) / width);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: Math.max(0, last - first) }, (_, i) => first + i).map((index) => (
        <div key={index} className="absolute inset-y-0 overflow-hidden border-r border-background" style={{ left: index * width, width: Math.min(width, widthPx - index * width) }}>
          <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
});
