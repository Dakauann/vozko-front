"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { STUDIO_LIMITS, type Marker } from "@/lib/studio/document";
import type { MarkerPatch } from "@/lib/studio/markers";

import { NumberField } from "../inspector/fields";
import { LabelColorPicker } from "../label-colors";

const MS = 1000;

export type MarkerEditRefusal = "taken" | "outside" | "locked" | "missing";

interface MarkerEditorProps {
  title: string;
  marker: Marker;
  startMs: number;
  endMs: number;
  disabled?: boolean;
  onPatch: (patch: MarkerPatch) => MarkerEditRefusal | null;
  onRemove: () => void;
  onGoTo: () => void;
  playheadMs: () => number;
}

const FIELD = "w-full rounded-[--radius] border border-control-edge bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function MarkerEditor({ title, marker, startMs, endMs, disabled, onPatch, onRemove, onGoTo, playheadMs }: MarkerEditorProps) {
  const t = useTranslations("studio.video.timeline.markers");
  const [refusal, setRefusal] = useState<MarkerEditRefusal | null>(null);
  const patch = (change: MarkerPatch) => setRefusal(onPatch(change));
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <label className="block space-y-1">
        <span className="block text-2xs text-muted-foreground">{t("label")}</span>
        <input
          defaultValue={marker.label ?? ""}
          maxLength={STUDIO_LIMITS.maxMarkerLabelRunes}
          disabled={disabled}
          onBlur={(event) => {
            if (event.target.value.trim() !== (marker.label ?? "")) patch({ label: event.target.value });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className={`${FIELD} h-8`}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t("time")} unit="s" step={0.1} decimals={2} min={0} max={STUDIO_LIMITS.maxVideoMs / MS} value={startMs / MS} disabled={disabled} onCommit={(seconds) => patch({ atMs: Math.round(seconds * MS) })} />
        <NumberField label={t("duration")} unit="s" step={0.1} decimals={2} min={0} max={STUDIO_LIMITS.maxVideoMs / MS} value={(endMs - startMs) / MS} disabled={disabled} onCommit={(seconds) => patch({ durationMs: Math.round(seconds * MS) })} />
      </div>
      <p className="text-2xs text-muted-foreground">{t("durationHint")}</p>
      <LabelColorPicker label={t("color")} value={marker.color} disabled={disabled} onChange={(color) => patch({ color: color ?? null })} />
      <label className="block space-y-1">
        <span className="block text-2xs text-muted-foreground">{t("note")}</span>
        <textarea
          defaultValue={marker.note ?? ""}
          maxLength={STUDIO_LIMITS.maxMarkerNoteRunes}
          rows={3}
          disabled={disabled}
          onBlur={(event) => {
            if (event.target.value.trim() !== (marker.note ?? "")) patch({ note: event.target.value });
          }}
          className={`${FIELD} resize-y py-1.5`}
        />
      </label>
      {refusal ? (
        <p role="alert" className="text-2xs text-destructive">
          {t(refusal)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" title={t("toPlayhead")} disabled={disabled} onClick={() => patch({ atMs: playheadMs() })} />
        <Button variant="outline" size="sm" title={t("goTo")} onClick={onGoTo} />
        <Button variant="ghost" size="sm" title={t("remove")} disabled={disabled} onClick={onRemove} />
      </div>
    </div>
  );
}
