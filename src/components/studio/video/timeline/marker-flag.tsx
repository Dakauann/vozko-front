"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Marker } from "@/lib/studio/document";
import { renameMarker } from "@/lib/studio/markers";
import { formatTimecode, msToPx } from "@/lib/studio/timeline-view";

import { useVideoEditor } from "../editor-context";

export function MarkerFlag({ marker, pxPerSecond }: { marker: Marker; pxPerSecond: number }) {
  const t = useTranslations("studio.video.timeline.markers");
  const { store, commands, playback } = useVideoEditor();
  const [open, setOpen] = useState(false);
  const label = marker.label ? t("named", { label: marker.label, time: formatTimecode(marker.atMs) }) : t("unnamed", { time: formatTimecode(marker.atMs) });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute top-0 z-[32] h-3 w-2.5 -translate-x-1/2 bg-[hsl(var(--plate-3))] [clip-path:polygon(0_0,100%_0,100%_70%,50%_100%,0_70%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ left: msToPx(marker.atMs, pxPerSecond) }}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2 p-3">
        <p className="text-xs font-semibold text-foreground">{t("title", { time: formatTimecode(marker.atMs) })}</p>
        <label className="block space-y-1">
          <span className="block text-2xs text-muted-foreground">{t("label")}</span>
          <input
            defaultValue={marker.label ?? ""}
            maxLength={64}
            onBlur={(event) => store.getState().apply((doc) => renameMarker(doc, marker.id, event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="h-8 w-full rounded-[--radius] border border-control-edge bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" title={t("goTo")} onClick={() => playback.seek(marker.atMs)} />
          <Button
            variant="ghost"
            size="sm"
            title={t("remove")}
            onClick={() => {
              setOpen(false);
              commands.removeMarker(marker.id);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
