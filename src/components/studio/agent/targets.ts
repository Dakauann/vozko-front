"use client";

import type { ImageDocument, VideoDocument } from "@/lib/studio/document";
import type { AgentFocus } from "@/lib/studio/agent/batch";
import { artboardById, artboardOfLayer } from "@/lib/studio/artboards";
import { findClip } from "@/lib/studio/timeline";
import { msToPx } from "@/lib/studio/timeline-view";
import type { Viewport } from "@/lib/studio/viewport";

import type { PresencePoint, PresenceRect } from "./presence";

const CLIP_INSET_PX = 48;
const EDGE_PX = 12;

export interface PresenceTarget {
  point: PresencePoint;
  outline: PresenceRect | null;
}

function query(selector: string): HTMLElement | null {
  return typeof document === "undefined" ? null : document.querySelector<HTMLElement>(selector);
}

function quoted(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}

function within(point: PresencePoint, area: DOMRect | null): PresencePoint {
  const left = area ? area.left + EDGE_PX : EDGE_PX;
  const top = area ? area.top + EDGE_PX : EDGE_PX;
  const right = area ? area.right - EDGE_PX : window.innerWidth - EDGE_PX;
  const bottom = area ? area.bottom - EDGE_PX : window.innerHeight - EDGE_PX;
  return { x: Math.min(Math.max(point.x, left), right), y: Math.min(Math.max(point.y, top), bottom) };
}

function rectOf(element: DOMRect): PresenceRect {
  return { left: element.left, top: element.top, width: element.width, height: element.height };
}

function timelineArea(): DOMRect | null {
  return query("[data-studio-timeline]")?.getBoundingClientRect() ?? null;
}

function laneTarget(trackId: string | null, atMs: number, pxPerSecond: number): PresenceTarget | null {
  const lane = trackId ? query(`[data-studio-lanes] [data-track-id="${quoted(trackId)}"]`) : query("[data-studio-lanes] [data-track-id]");
  if (!lane) return null;
  const rect = lane.getBoundingClientRect();
  return { point: within({ x: rect.left + msToPx(atMs, pxPerSecond), y: rect.top + rect.height / 2 }, timelineArea()), outline: null };
}

export function videoTarget(focus: AgentFocus, doc: VideoDocument, pxPerSecond: number): PresenceTarget | null {
  switch (focus.kind) {
    case "clip": {
      const element = query(`[data-studio-lanes] [data-clip-id="${quoted(focus.clipId)}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        return { point: within({ x: rect.left + Math.min(rect.width / 2, CLIP_INSET_PX), y: rect.top + rect.height / 2 }, timelineArea()), outline: rectOf(rect) };
      }
      const found = findClip(doc, focus.clipId);
      return found ? laneTarget(found.track.id, found.clip.startMs, pxPerSecond) : null;
    }
    case "track":
      return laneTarget(focus.trackId, focus.atMs ?? 0, pxPerSecond);
    case "time":
      return laneTarget(null, focus.atMs, pxPerSecond);
    case "frame": {
      const frame = query("[data-studio-preview-frame]");
      if (!frame) return null;
      const rect = frame.getBoundingClientRect();
      const point = within({ x: rect.left + focus.x * rect.width, y: rect.top + focus.y * rect.height }, rect);
      if (focus.w === undefined || focus.h === undefined) return { point, outline: null };
      const width = focus.w * rect.width;
      const height = focus.h * rect.height;
      return { point, outline: { left: rect.left + focus.x * rect.width - width / 2, top: rect.top + focus.y * rect.height - height / 2, width, height } };
    }
  }
  return null;
}

function boxTarget(rect: DOMRect, viewport: Viewport, box: { x: number; y: number; width: number; height: number }): PresenceTarget {
  const { scale } = viewport;
  const left = rect.left + viewport.x + box.x * scale;
  const top = rect.top + viewport.y + box.y * scale;
  const width = box.width * scale;
  const height = box.height * scale;
  return { point: within({ x: left + width / 2, y: top + height / 2 }, rect), outline: { left, top, width, height } };
}

export function imageTarget(focus: AgentFocus, doc: ImageDocument, viewport: Viewport): PresenceTarget | null {
  const host = query("[data-studio-canvas]");
  if (!host) return null;
  const rect = host.getBoundingClientRect();
  if (focus.kind === "layer") {
    const artboard = artboardOfLayer(doc, focus.layerId);
    const layer = artboard?.layers.find((l) => l.id === focus.layerId);
    if (artboard && layer) {
      const { canvas } = artboard;
      const t = layer.transform;
      const width = t.w * canvas.width;
      const height = t.h * canvas.height;
      return boxTarget(rect, viewport, { x: artboard.x + t.x * canvas.width - width / 2, y: artboard.y + t.y * canvas.height - height / 2, width, height });
    }
  }
  if (focus.kind === "artboard") {
    const artboard = artboardById(doc, focus.artboardId);
    if (artboard) return boxTarget(rect, viewport, { x: artboard.x, y: artboard.y, width: artboard.canvas.width, height: artboard.canvas.height });
  }
  return { point: within({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, rect), outline: null };
}
