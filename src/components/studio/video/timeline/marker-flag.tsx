"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Marker } from "@/lib/studio/document";
import { markerEndMs, updateMarker } from "@/lib/studio/markers";
import { formatTimecode, msToPx } from "@/lib/studio/timeline-view";

import { useVideoEditor } from "../editor-context";
import { labelHex } from "../label-colors";
import { MarkerEditor } from "./marker-editor";

export function useMarkerLabel(): (marker: Marker, startMs: number, endMs: number) => string {
  const t = useTranslations("studio.video.timeline.markers");
  return (marker, startMs, endMs) => {
    const time = endMs > startMs ? t("span", { from: formatTimecode(startMs), to: formatTimecode(endMs) }) : formatTimecode(startMs);
    return marker.label ? t("named", { label: marker.label, time }) : t("unnamed", { time });
  };
}

export function MarkerFlag({ marker, pxPerSecond }: { marker: Marker; pxPerSecond: number }) {
  const t = useTranslations("studio.video.timeline.markers");
  const { store, view, commands, playback } = useVideoEditor();
  const describe = useMarkerLabel();
  const [open, setOpen] = useState(false);
  const endMs = markerEndMs(marker);
  const label = describe(marker, marker.atMs, endMs);
  const color = labelHex(marker.color);
  const left = msToPx(marker.atMs, pxPerSecond);

  return (
    <>
      {endMs > marker.atMs ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 z-[30] h-1.5 rounded-b-[2px] opacity-70"
          style={{ left, width: msToPx(endMs - marker.atMs, pxPerSecond), background: color ?? "hsl(var(--plate-3))" }}
        />
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            title={marker.note ? `${label}\n${marker.note}` : label}
            data-marker-id={marker.id}
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute top-0 z-[32] h-3 w-2.5 -translate-x-1/2 [clip-path:polygon(0_0,100%_0,100%_70%,50%_100%,0_70%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ left, background: color ?? "hsl(var(--plate-3))" }}
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <MarkerEditor
            title={t("title", { time: formatTimecode(marker.atMs) })}
            marker={marker}
            startMs={marker.atMs}
            endMs={endMs}
            playheadMs={() => view.getState().playheadMs}
            onGoTo={() => playback.seek(marker.atMs)}
            onRemove={() => {
              setOpen(false);
              commands.removeMarker(marker.id);
            }}
            onPatch={(patch) => {
              const result = updateMarker(store.getState().document, marker.id, patch);
              if (!result.ok) return result.reason;
              store.getState().apply(() => result.document);
              return null;
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

export function LaneMarkers({ markers, pxPerSecond }: { markers: readonly Marker[]; pxPerSecond: number }) {
  return (
    <>
      {markers.map((marker) => {
        const color = labelHex(marker.color);
        const endMs = markerEndMs(marker);
        return (
          <span key={marker.id} aria-hidden>
            {endMs > marker.atMs ? (
              <span
                className="pointer-events-none absolute inset-y-0 z-[4] border-r border-dashed opacity-[0.12]"
                style={{ left: msToPx(marker.atMs, pxPerSecond), width: msToPx(endMs - marker.atMs, pxPerSecond), background: color ?? "hsl(var(--foreground))" }}
              />
            ) : null}
            <span className="pointer-events-none absolute inset-y-0 z-[5] w-px bg-border-strong" style={{ left: msToPx(marker.atMs, pxPerSecond), ...(color ? { background: color } : {}) }} />
          </span>
        );
      })}
    </>
  );
}
