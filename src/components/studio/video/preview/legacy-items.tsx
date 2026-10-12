"use client";

import type { ReactNode } from "react";

import { tiltMatrix } from "@/lib/studio/clip-tilt";
import type { CanvasSize } from "@/lib/studio/document";
import { cssMatrix3d, scaledHomography, type Lens } from "@/lib/studio/perspective";
import { boxStyle, type VisualItem } from "@/lib/studio/playback";
import { haloNodeOf } from "@/lib/studio/scene/video-scene";

import { OverlayStage } from "./overlay-stage";
import { PreviewMedia } from "./preview-media";

interface LegacyItemsProps {
  items: readonly VisualItem[];
  canvas: CanvasSize;
  frame: CanvasSize;
  lens: Lens;
  playing: boolean;
  rate: number;
}

function overlayGroups(items: readonly VisualItem[]): [number, VisualItem[]][] {
  const groups = new Map<number, VisualItem[]>();
  for (const item of items) {
    if (item.type !== "overlay" || item.tilt) continue;
    groups.set(item.trackIndex, [...(groups.get(item.trackIndex) ?? []), item]);
  }
  return [...groups.entries()];
}

function Tilted({ item, canvas, frame, lens, children }: { item: VisualItem; canvas: CanvasSize; frame: CanvasSize; lens: Lens; children: ReactNode }) {
  if (!item.tilt) return children;
  const t = item.transform;
  const matrix = tiltMatrix(lens, { x: t.x * canvas.width, y: t.y * canvas.height, width: t.w * canvas.width, height: t.h * canvas.height, rotation: t.rotation }, item.tilt);
  const unit = canvas.width / frame.width;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ transformOrigin: "0 0", transform: cssMatrix3d(scaledHomography(matrix, unit, unit)), zIndex: item.trackIndex + 1 }} aria-hidden>
      {children}
    </div>
  );
}

function LegacyGroup({ item, canvas, frame, lens, playing, rate }: Omit<LegacyItemsProps, "items"> & { item: VisualItem }) {
  if (!item.group || !item.active) return null;
  const inner = { width: frame.width * item.transform.w, height: frame.height * item.transform.h };
  return (
    <div className="pointer-events-none absolute overflow-hidden" style={{ ...boxStyle(item), isolation: "isolate" }} aria-hidden>
      <LegacyItems items={item.group.items} canvas={canvas} frame={inner} lens={lens} playing={playing} rate={rate} />
    </div>
  );
}

export function LegacyItems({ items, canvas, frame, lens, playing, rate }: LegacyItemsProps) {
  return (
    <>
      {items
        .filter((item) => item.type !== "overlay" && item.type !== "effect" && item.type !== "null" && item.type !== "group")
        .map((item) => (
          <Tilted key={item.clipId} item={item} canvas={canvas} frame={frame} lens={lens}>
            <PreviewMedia item={item} playing={playing} rate={rate} halo={haloNodeOf(item, canvas.width, canvas.height)} haloRatio={(frame.width / canvas.width) * (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1)} />
          </Tilted>
        ))}
      {items
        .filter((item) => item.type === "group")
        .map((item) => (
          <Tilted key={item.clipId} item={item} canvas={canvas} frame={frame} lens={lens}>
            <LegacyGroup item={item} canvas={canvas} frame={frame} lens={lens} playing={playing} rate={rate} />
          </Tilted>
        ))}
      {overlayGroups(items).map(([trackIndex, group]) => (
        <OverlayStage key={trackIndex} items={group} canvas={canvas} frame={frame} zIndex={trackIndex + 1} />
      ))}
      {items
        .filter((item) => item.type === "overlay" && item.tilt)
        .map((item) => (
          <Tilted key={item.clipId} item={item} canvas={canvas} frame={frame} lens={lens}>
            <OverlayStage items={[item]} canvas={canvas} frame={frame} zIndex={item.trackIndex + 1} />
          </Tilted>
        ))}
    </>
  );
}
