"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { removeClipMarker, updateClipMarker, type ClipMarkerResult } from "@/lib/studio/clip-marker-edits";
import { placedClipMarkers, type PlacedClipMarker } from "@/lib/studio/clip-markers";
import type { Clip } from "@/lib/studio/document";
import { formatTimecode, msToPx } from "@/lib/studio/timeline-view";
import { cn } from "@/lib/utils";

import { useVideoEditor } from "../editor-context";
import { labelHex } from "../label-colors";
import { MarkerEditor } from "./marker-editor";
import { useMarkerLabel } from "./marker-flag";

interface ClipMarkerTicksProps {
  clip: Clip;
  pxPerSecond: number;
  locked: boolean;
}

function ClipMarkerTick({ clip, placed, pxPerSecond, locked }: ClipMarkerTicksProps & { placed: PlacedClipMarker }) {
  const t = useTranslations("studio.video.timeline.markers");
  const { store, view, playback } = useVideoEditor();
  const describe = useMarkerLabel();
  const [open, setOpen] = useState(false);
  const { marker } = placed;
  const left = msToPx(placed.startMs - clip.startMs, pxPerSecond);
  const width = msToPx(placed.endMs - placed.startMs, pxPerSecond);
  const color = labelHex(marker.color);
  const label = marker.beat ? t("beatAt", { time: formatTimecode(placed.startMs) }) : describe(marker, placed.startMs, placed.endMs);
  const run = (result: ClipMarkerResult) => {
    if (!result.ok) return result.reason;
    store.getState().apply(() => result.document);
    return null;
  };
  return (
    <>
      {width > 0 ? <span aria-hidden className="pointer-events-none absolute bottom-0 z-[2] h-1 rounded-t-[2px] opacity-80" style={{ left, width, background: color ?? "hsl(var(--foreground))" }} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            title={marker.note ? `${label}\n${marker.note}` : label}
            data-clip-marker-id={marker.id}
            onPointerDown={(event) => event.stopPropagation()}
            className={cn(
              "absolute z-[5] w-[3px] -translate-x-1/2 rounded-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              marker.beat ? "bottom-0 h-1/3" : "inset-y-0",
              !color && "bg-foreground/70",
            )}
            style={{ left, ...(color ? { background: color } : {}) }}
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <MarkerEditor
            title={marker.beat ? t("beatAt", { time: formatTimecode(placed.startMs) }) : t("clipTitle", { time: formatTimecode(placed.startMs) })}
            marker={marker}
            startMs={placed.startMs}
            endMs={placed.endMs}
            disabled={locked}
            playheadMs={() => view.getState().playheadMs}
            onGoTo={() => playback.seek(placed.startMs)}
            onRemove={() => {
              setOpen(false);
              run(removeClipMarker(store.getState().document, clip.id, marker.id));
            }}
            onPatch={(patch) => run(updateClipMarker(store.getState().document, clip.id, marker.id, patch))}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

export function ClipMarkerTicks({ clip, pxPerSecond, locked }: ClipMarkerTicksProps) {
  const placed = placedClipMarkers(clip);
  if (placed.length === 0) return null;
  return (
    <>
      {placed.map((entry) => (
        <ClipMarkerTick key={entry.marker.id} clip={clip} placed={entry} pxPerSecond={pxPerSecond} locked={locked} />
      ))}
    </>
  );
}
