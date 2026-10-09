"use client";

import { useTranslations } from "next-intl";

import { ArrowRight, ArrowsLeftRight, Circle, Minus, Square, Star, TextHOne, TextHTwo, TextT, type Icon } from "@/components/icons";
import { VectorGlyph } from "@/components/studio/canvas/vector-glyph";
import { TEXT_STYLE_PRESETS } from "@/lib/studio/text-presets";
import { newIconLayer, newShapeLayer, newTextLayer, VIDEO_ASPECT_SIZES, type Layer, type ShapeKind, type TextPreset, type VideoAspect } from "@/lib/studio/document";
import { VECTOR_PRESET_IDS, vectorPresetLayer, type VectorPresetId } from "@/lib/studio/vector-presets";

import { useEditorState, useVideoEditor } from "../editor-context";
import { IconGrid } from "../icon-grid";

const OVERLAY_INK = "#ffffff";

const TEXT_PRESETS: { preset: TextPreset; icon: Icon; box: { w: number; h: number }; className: string }[] = [
  { preset: "heading", icon: TextHOne, box: { w: 0.85, h: 0.14 }, className: "text-base font-bold" },
  { preset: "subheading", icon: TextHTwo, box: { w: 0.8, h: 0.1 }, className: "text-sm font-semibold" },
  { preset: "body", icon: TextT, box: { w: 0.8, h: 0.08 }, className: "text-xs" },
];

type ShapeOption = { id: string; shape: Exclude<ShapeKind, "path">; icon: Icon; both?: boolean };

const SHAPES: ShapeOption[] = [
  { id: "rect", shape: "rect", icon: Square },
  { id: "ellipse", shape: "ellipse", icon: Circle },
  { id: "triangle", shape: "triangle", icon: TextT },
  { id: "star", shape: "star", icon: Star },
  { id: "line", shape: "line", icon: Minus },
  { id: "arrow", shape: "arrow", icon: ArrowRight },
  { id: "doubleArrow", shape: "arrow", icon: ArrowsLeftRight, both: true },
];

function shapeLayer(option: ShapeOption): Layer {
  const layer = newShapeLayer(option.shape);
  if (option.shape === "line" || option.shape === "arrow") return { ...layer, stroke: OVERLAY_INK, arrowStart: Boolean(option.both) };
  return layer;
}

function vectorLayer(id: VectorPresetId, aspect: VideoAspect): Layer {
  const layer = vectorPresetLayer(id, VIDEO_ASPECT_SIZES[aspect]);
  return layer.strokeWidth ? { ...layer, stroke: OVERLAY_INK } : layer;
}

export function ElementsPanel() {
  const t = useTranslations("studio.video.elements");
  const tv = useTranslations("studio.vectors");
  const { commands } = useVideoEditor();
  const aspect = useEditorState((s) => s.document.canvas.aspect);

  const addText = (preset: (typeof TEXT_PRESETS)[number]) => {
    const layer = newTextLayer(t(`samples.${preset.preset}`), preset.preset, { x: 0.5, y: 0.5, w: preset.box.w, h: preset.box.h, rotation: 0, opacity: 1 });
    commands.insertLayer({ ...layer, fill: OVERLAY_INK });
  };

  return (
    <div className="space-y-4 p-3">
      <section className="space-y-2">
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t("styles")}</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_STYLE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => commands.insertTextPreset(preset, t(`styleSamples.${preset}`))}
              className="flex h-12 flex-col items-start justify-center rounded-[--radius] border border-border bg-card px-2 text-left transition-colors hover:border-control-edge hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-xs font-semibold text-foreground">{t(`styleNames.${preset}`)}</span>
              <span className="truncate text-2xs text-muted-foreground">{t(`styleSamples.${preset}`)}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t("text")}</h3>
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.preset}
            type="button"
            onClick={() => addText(preset)}
            className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-foreground transition-colors hover:border-control-edge hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <preset.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className={preset.className}>{t(`presets.${preset.preset}`)}</span>
          </button>
        ))}
      </section>
      <section className="space-y-2">
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t("shapes")}</h3>
        <div className="grid grid-cols-4 gap-1.5">
          {SHAPES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-label={t(`shapeNames.${option.id}`)}
              title={t(`shapeNames.${option.id}`)}
              onClick={() => commands.insertLayer(shapeLayer(option))}
              className="flex aspect-square items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:border-control-edge hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {option.shape === "triangle" ? (
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
                  <path d="M8 2.5 14 13.5H2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              ) : (
                <option.icon className="h-4 w-4" aria-hidden />
              )}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{tv("title")}</h3>
        <div className="grid grid-cols-4 gap-1.5">
          {VECTOR_PRESET_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-label={tv(`names.${id}`)}
              title={tv(`names.${id}`)}
              onClick={() => commands.insertLayer(vectorLayer(id, aspect))}
              className="flex aspect-square items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:border-control-edge hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <VectorGlyph id={id} className="h-6 w-6" />
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t("icons")}</h3>
        <IconGrid label={t("icons")} onPick={(iconId) => commands.insertLayer(newIconLayer(iconId, OVERLAY_INK))} />
      </section>
    </div>
  );
}
