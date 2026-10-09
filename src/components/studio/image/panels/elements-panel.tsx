"use client";

import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { MagnifyingGlass } from "@/components/icons";
import { STUDIO_ICON_IDS, STUDIO_ICONS } from "@/components/studio/canvas/icon-catalog";
import { useSvgFeedback } from "@/components/studio/canvas/vector/use-svg-feedback";
import { VectorGlyph } from "@/components/studio/canvas/vector-glyph";
import { newIconLayer, newShapeLayer, type CanvasSize, type Layer, type ShapeKind } from "@/lib/studio/document";
import { squareTransform } from "@/lib/studio/geometry";
import { VECTOR_PRESET_IDS, vectorPresetLayer } from "@/lib/studio/vector-presets";

import { FIELD_CLASS } from "../controls";
import { useActiveCanvas, useImageEditor } from "../editor-state";
import { PanelHeading } from "./panel-heading";

type ShapeChoice = { id: string; shape: Exclude<ShapeKind, "path">; extra?: Partial<Layer>; preview: ReactNode };

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const SHAPES: ShapeChoice[] = [
  { id: "rect", shape: "rect", preview: <rect x="5" y="9" width="30" height="22" rx="2" fill="currentColor" /> },
  { id: "rounded", shape: "rect", extra: { radius: 0.4 }, preview: <rect x="5" y="9" width="30" height="22" rx="8" fill="currentColor" /> },
  { id: "ellipse", shape: "ellipse", preview: <circle cx="20" cy="20" r="13" fill="currentColor" /> },
  { id: "triangle", shape: "triangle", preview: <path d="M20 7 34 32H6Z" fill="currentColor" /> },
  { id: "star", shape: "star", preview: <path d="m20 5 4.4 9.6 10.4 1.1-7.8 7 2.2 10.3L20 27.7 10.8 33l2.2-10.3-7.8-7 10.4-1.1Z" fill="currentColor" /> },
  { id: "line", shape: "line", preview: <path d="M6 20h28" {...STROKE} /> },
  { id: "arrow", shape: "arrow", preview: <path d="M6 20h27m-7-7 7 7-7 7" {...STROKE} /> },
  { id: "doubleArrow", shape: "arrow", extra: { arrowStart: true }, preview: <path d="M7 20h26m-7-7 7 7-7 7M14 13l-7 7 7 7" {...STROKE} /> },
];

const SHAPE_SHARE = 0.3;
const LINE_SHARE = 0.5;
const LINE_HEIGHT_SHARE = 0.05;
const ICON_SHARE = 0.2;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function shapeLayer(choice: ShapeChoice, canvas: CanvasSize): Layer {
  const line = choice.shape === "line" || choice.shape === "arrow";
  const transform = line ? squareTransform(canvas, LINE_SHARE, LINE_HEIGHT_SHARE) : squareTransform(canvas, SHAPE_SHARE);
  return { ...newShapeLayer(choice.shape, transform), ...choice.extra };
}

export function ElementsPanel() {
  const t = useTranslations("studio.image.panels.elements");
  const ti = useTranslations("studio.image.icons");
  const tv = useTranslations("studio.vectors");
  const svgFeedback = useSvgFeedback();
  const svgInput = useRef<HTMLInputElement>(null);
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    svgFeedback.imported(commands.importSvg(await file.text(), file.name.replace(/\.svg$/i, "")));
  };
  const { commands } = useImageEditor();
  const canvas = useActiveCanvas();
  const [query, setQuery] = useState("");

  const icons = useMemo(() => {
    const needle = normalize(query.trim());
    return STUDIO_ICON_IDS.filter((id) => needle === "" || normalize(`${id} ${ti(id)}`).includes(needle));
  }, [query, ti]);

  return (
    <div className="space-y-4">
      <PanelHeading title={t("title")} />
      <section className="space-y-2">
        <h3 className="legend text-muted-foreground">{t("shapes")}</h3>
        <ul className="grid grid-cols-4 gap-1.5">
          {SHAPES.map((choice) => (
            <li key={choice.id}>
              <button
                type="button"
                aria-label={t(`shape.${choice.id}`)}
                title={t(`shape.${choice.id}`)}
                onClick={() => commands.insert([shapeLayer(choice, canvas)])}
                className="flex aspect-square w-full items-center justify-center rounded-[--radius] border border-border bg-card text-foreground transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden>
                  {choice.preview}
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="legend text-muted-foreground">{tv("title")}</h3>
          <button type="button" onClick={() => svgInput.current?.click()} className="rounded-[--radius] px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {tv("svg.import")}
          </button>
          <input ref={svgInput} type="file" accept=".svg,image/svg+xml" className="hidden" aria-label={tv("svg.import")} onChange={importFile} />
        </div>
        <ul className="grid grid-cols-4 gap-1.5">
          {VECTOR_PRESET_IDS.map((id) => (
            <li key={id}>
              <button
                type="button"
                aria-label={tv(`names.${id}`)}
                title={tv(`names.${id}`)}
                onClick={() => commands.insert([vectorPresetLayer(id, canvas)])}
                className="flex aspect-square w-full items-center justify-center rounded-[--radius] border border-border bg-card text-foreground transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <VectorGlyph id={id} className="h-8 w-8" />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="legend text-muted-foreground">{t("icons")}</h3>
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} aria-label={t("search")} className={`${FIELD_CLASS} pl-7`} />
        </div>
        {icons.length === 0 ? <p className="text-xs text-muted-foreground">{t("noIcons")}</p> : null}
        <ul className="grid grid-cols-5 gap-1">
          {icons.map((id) => {
            const Glyph = STUDIO_ICONS[id];
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-label={ti(id)}
                  title={ti(id)}
                  onClick={() => commands.insert([newIconLayer(id, "#111111", squareTransform(canvas, ICON_SHARE))])}
                  className="flex aspect-square w-full items-center justify-center rounded-[--radius] text-foreground transition-colors hover:bg-muted active:bg-[hsl(var(--accent-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Glyph size={22} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
