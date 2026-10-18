"use client";

import { useTranslations } from "next-intl";

import { Trash } from "@/components/icons";
import { KEY_TOLERANCE_MS } from "@/lib/studio/keyframe-edit";
import type { MorphKeyframe, VertexPin } from "@/lib/studio/morph-keys";
import { pathVertices, vertexIndex, vertexPin } from "@/lib/studio/path-morph";
import { formatTimecode } from "@/lib/studio/timeline-view";
import { cn } from "@/lib/utils";

import { ToolButton } from "../tool-button";
import { SelectField } from "./fields";

const AUTO = "auto";

interface PathKeyListProps {
  keys: readonly MorphKeyframe[];
  startMs: number;
  localMs: number | null;
  disabled: boolean;
  onSeek: (atMs: number) => void;
  onVertex: (atMs: number, pin: VertexPin | null) => void;
  onRemove: (atMs: number) => void;
}

export function PathGlyph({ path, pin, className }: { path: string; pin?: VertexPin; className?: string }) {
  return (
    <svg aria-hidden viewBox="-0.15 -0.15 1.3 1.3" className={cn("h-6 w-6 shrink-0 overflow-visible text-foreground", className)}>
      <path d={path} fill="currentColor" fillOpacity={0.2} stroke="currentColor" strokeWidth={0.06} strokeLinejoin="round" />
      {pin ? <circle cx={pin.x} cy={pin.y} r={0.1} className="fill-primary" /> : null}
    </svg>
  );
}

function PathKeyRow({ frame, startMs, current, disabled, onSeek, onVertex, onRemove }: Omit<PathKeyListProps, "keys" | "localMs"> & { frame: MorphKeyframe; current: boolean }) {
  const t = useTranslations("studio.video.morph");
  const time = formatTimecode(startMs + frame.atMs);
  const count = pathVertices(frame.path).length;
  const chosen = frame.firstVertex ? String(vertexIndex(frame.path, frame.firstVertex)) : AUTO;
  const options = [{ value: AUTO, label: t("auto") }, ...Array.from({ length: count }, (_, index) => ({ value: String(index), label: t("point", { index: index + 1 }) }))];
  return (
    <li className={cn("flex items-end gap-1.5 rounded-md p-1", current && "bg-muted")}>
      <button
        type="button"
        aria-label={t("seekKey", { time })}
        aria-current={current || undefined}
        onClick={() => onSeek(frame.atMs)}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-1 text-2xs tabular-nums text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PathGlyph path={frame.path} pin={frame.firstVertex} />
        {time}
      </button>
      <div className="min-w-0 flex-1">
        <SelectField<string> label={t("firstVertex")} value={chosen} options={options} disabled={disabled} onChange={(value) => onVertex(frame.atMs, value === AUTO ? null : vertexPin(frame.path, Number(value)))} />
      </div>
      <ToolButton size="sm" label={t("removeKey", { time })} icon={<Trash className="h-3.5 w-3.5" />} disabled={disabled} onClick={() => onRemove(frame.atMs)} />
    </li>
  );
}

export function PathKeyList({ keys, localMs, ...rest }: PathKeyListProps) {
  const t = useTranslations("studio.video.morph");
  if (keys.length === 0) return <p className="text-2xs text-muted-foreground">{t("empty")}</p>;
  return (
    <ul className="space-y-0.5" aria-label={t("keys")}>
      {keys.map((frame) => (
        <PathKeyRow key={frame.atMs} frame={frame} current={localMs !== null && Math.abs(frame.atMs - localMs) <= KEY_TOLERANCE_MS} {...rest} />
      ))}
    </ul>
  );
}
