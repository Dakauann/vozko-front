"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import {
  ANIMATION_FPS,
  ANIMATION_RANGES,
  ANIMATION_WIDTHS,
  animationSize,
  GIF_DITHERS,
  isAnimation,
  isFrame,
  VIDEO_EXPORT_FORMATS,
  withFormat,
  type AnimationExportRequest,
  type GifDither,
  type VideoExportFormat,
  type VideoExportRequest,
} from "@/lib/studio/animated-export";
import type { CanvasSize } from "@/lib/studio/document";
import { formatTimecode } from "@/lib/studio/timeline-view";
import type { TimeSpan } from "@/lib/studio/work-area";

import { NumberField, SliderField } from "../inspector/fields";

const FORMAT_LABELS: Record<VideoExportFormat, string> = { mp4: "MP4", gif: "GIF", webp: "WebP", png: "PNG", jpeg: "JPEG" };
const DITHER_KEYS: Record<GifDither, string> = { none: "ditherNone", diffusion: "ditherDiffusion", ordered: "ditherOrdered" };

type Loop = "forever" | "count";

type Scope = "film" | "area";

export interface ExportMoment {
  area: TimeSpan | null;
  useArea: boolean;
  onUseArea: (useArea: boolean) => void;
  frameMs: number;
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-2xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function AnimationFields({ request, canvas, onChange }: { request: AnimationExportRequest; canvas: CanvasSize; onChange: (request: VideoExportRequest) => void }) {
  const t = useTranslations("studio.video.export");
  const widths = [...new Set([...ANIMATION_WIDTHS.filter((w) => w < canvas.width), canvas.width])];
  const size = animationSize(canvas, request.width);
  const loop: Loop = request.loop === 0 ? "forever" : "count";
  const patch = (change: Partial<AnimationExportRequest>) => onChange({ ...request, ...change } as AnimationExportRequest);
  return (
    <>
      <Group label={t("width")}>
        <ElevatedPillToggle<string>
          aria-label={t("width")}
          value={String(request.width)}
          onChange={(value) => patch({ width: Number(value) })}
          options={widths.map((w) => ({ value: String(w), label: w === canvas.width ? t("widthOriginal") : String(w) }))}
        />
        <div className="w-32">
          <NumberField label={t("widthExact")} unit="px" min={ANIMATION_RANGES.width[0]} max={canvas.width} value={request.width} onCommit={(width) => patch({ width: Math.round(width) })} />
        </div>
        <p className="text-2xs text-muted-foreground">{t("size", { width: size.width, height: size.height })}</p>
      </Group>
      <Group label={t("fps")}>
        <ElevatedPillToggle<string> aria-label={t("fps")} value={String(request.fps)} onChange={(value) => patch({ fps: Number(value) })} options={ANIMATION_FPS.map((fps) => ({ value: String(fps), label: String(fps) }))} />
        <div className="w-32">
          <NumberField label={t("fpsExact")} min={ANIMATION_RANGES.fps[0]} max={ANIMATION_RANGES.fps[1]} value={request.fps} onCommit={(fps) => patch({ fps: Math.round(fps) })} />
        </div>
      </Group>
      <Group label={t("loop")}>
        <div className="flex items-end gap-2">
          <ElevatedPillToggle<Loop>
            aria-label={t("loop")}
            value={loop}
            onChange={(value) => patch({ loop: value === "forever" ? 0 : 1 })}
            options={[
              { value: "forever", label: t("loopForever") },
              { value: "count", label: t("loopCount") },
            ]}
          />
          {loop === "count" ? (
            <div className="w-20">
              <NumberField label={t("plays")} value={request.loop} min={1} max={ANIMATION_RANGES.loop[1]} onCommit={(plays) => patch({ loop: Math.round(plays) })} />
            </div>
          ) : null}
        </div>
      </Group>
      {request.format === "gif" ? (
        <>
          <SliderField
            label={t("colors")}
            value={request.colors}
            fallback={request.colors}
            min={ANIMATION_RANGES.colors[0]}
            max={ANIMATION_RANGES.colors[1]}
            step={1}
            valueText={String(request.colors)}
            onChange={(colors) => patch({ colors })}
            onCommit={() => undefined}
            onStart={() => undefined}
          />
          <Group label={t("dither")}>
            <ElevatedPillToggle<GifDither> aria-label={t("dither")} value={request.dither} onChange={(dither) => patch({ dither })} options={GIF_DITHERS.map((dither) => ({ value: dither, label: t(DITHER_KEYS[dither]) }))} />
            <p className="text-2xs text-muted-foreground">{t(`ditherHint.${request.dither}`)}</p>
          </Group>
        </>
      ) : (
        <QualityField quality={request.quality} onChange={(quality) => patch({ quality })} />
      )}
    </>
  );
}

function QualityField({ quality, onChange }: { quality: number; onChange: (quality: number) => void }) {
  const t = useTranslations("studio.video.export");
  return (
    <SliderField
      label={t("quality")}
      value={Math.round(quality * 100)}
      fallback={80}
      min={ANIMATION_RANGES.quality[0] * 100}
      max={100}
      step={1}
      valueText={`${Math.round(quality * 100)}%`}
      onChange={(percent) => onChange(percent / 100)}
      onCommit={() => undefined}
      onStart={() => undefined}
    />
  );
}

function RangeFields({ moment }: { moment: ExportMoment }) {
  const t = useTranslations("studio.video.export");
  const { area } = moment;
  if (!area) return <p className="text-2xs text-muted-foreground">{t("rangeHint")}</p>;
  return (
    <Group label={t("range")}>
      <ElevatedPillToggle<Scope>
        aria-label={t("range")}
        value={moment.useArea ? "area" : "film"}
        onChange={(scope) => moment.onUseArea(scope === "area")}
        options={[
          { value: "film", label: t("rangeFilm") },
          { value: "area", label: t("rangeArea", { from: formatTimecode(area.startMs), to: formatTimecode(area.endMs) }) },
        ]}
      />
    </Group>
  );
}

export function ExportSettings({ request, canvas, moment, onChange }: { request: VideoExportRequest; canvas: CanvasSize; moment: ExportMoment; onChange: (request: VideoExportRequest) => void }) {
  const t = useTranslations("studio.video.export");
  return (
    <div className="space-y-3">
      <Group label={t("format")}>
        <ElevatedPillToggle<VideoExportFormat>
          aria-label={t("format")}
          value={request.format}
          onChange={(format) => onChange(withFormat(request, format, canvas))}
          options={VIDEO_EXPORT_FORMATS.map((format) => ({ value: format, label: FORMAT_LABELS[format] }))}
        />
      </Group>
      <p className="text-xs text-muted-foreground">{t(`hints.${request.format}`)}</p>
      {isFrame(request) ? <p className="text-xs font-medium text-foreground">{t("frameAt", { time: formatTimecode(moment.frameMs) })}</p> : <RangeFields moment={moment} />}
      {request.format === "jpeg" ? <QualityField quality={request.quality} onChange={(quality) => onChange({ ...request, quality })} /> : null}
      {isAnimation(request) ? <AnimationFields request={request} canvas={canvas} onChange={onChange} /> : null}
    </div>
  );
}
