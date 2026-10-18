"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { PaintBrush } from "@/components/icons";
import { PIXEL_RANGES } from "@/lib/studio/pixel-surface";
import { isBrushTool, PIXEL_TOOL_KEYS, PIXEL_TOOLS, type PixelTool } from "@/lib/studio/pixel-tools";
import type { PixelEditIssue } from "@/lib/studio/pixel-edits";
import { layerById } from "@/lib/studio/layers";
import { artboardById } from "@/lib/studio/artboards";

import { ColorField, NumberField, OUTLINE_BUTTON_CLASS, SwitchToggle, ToggleButton } from "./controls";
import { useEditorUi, useImageDoc, useImageEditor } from "./editor-state";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const GLYPHS: Record<Exclude<PixelTool, "brush">, { d: string; dashed?: boolean }[]> = {
  eraser: [{ d: "M8.5 20 3.8 15.3a1.6 1.6 0 0 1 0-2.3l8.7-8.7a1.6 1.6 0 0 1 2.3 0l5.2 5.2a1.6 1.6 0 0 1 0 2.3L12 20Z" }, { d: "M8.2 8.6 15.4 15.8" }, { d: "M12 20h8" }],
  rect: [{ d: "M4 5h16v14H4Z", dashed: true }],
  ellipse: [{ d: "M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7Z", dashed: true }],
  lasso: [{ d: "M7.5 16.5C4.8 15.3 3.5 13.4 3.5 11.2 3.5 7.5 7.4 4.5 12.2 4.5S20.5 7.2 20.5 10.6c0 3.5-3.9 6.1-8.6 6.1-1.6 0-3 .4-3.8 1.1" }, { d: "M8.1 17.8c-.9.8-.4 2.2 1 2.7" }],
};

function PixelToolGlyph({ tool, className }: { tool: PixelTool; className?: string }) {
  if (tool === "brush") return <PaintBrush className={className} aria-hidden />;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {GLYPHS[tool].map(({ d, dashed }) => (
        <path key={d} d={d} {...STROKE} strokeDasharray={dashed ? "2.5 2" : undefined} />
      ))}
    </svg>
  );
}

export function PixelToolButtons() {
  const t = useTranslations("studio.image.pixels.tools");
  const { commands } = useImageEditor();
  const current = useEditorUi((s) => s.pixelTool);
  return (
    <div role="group" aria-label={t("label")} className="flex items-center gap-0.5">
      {PIXEL_TOOLS.map((tool) => (
        <ToggleButton key={tool} label={`${t(tool)} (${PIXEL_TOOL_KEYS[tool]})`} pressed={current === tool} onClick={() => commands.pixel.setTool(current === tool ? null : tool)}>
          <PixelToolGlyph tool={tool} className="h-4 w-4" />
        </ToggleButton>
      ))}
    </div>
  );
}

function percent(value: number): number {
  return Math.round(value * 100);
}

function BrushOptions({ tool }: { tool: "brush" | "eraser" }) {
  const t = useTranslations("studio.image.pixels.options");
  const { commands } = useImageEditor();
  const brush = useEditorUi((s) => s.brush);
  const set = commands.pixel.setBrush;
  const onPhoto = useImageDoc((s) => {
    const id = s.selection.length === 1 ? s.selection[0] : null;
    return id !== null && s.document.artboards.some((a) => layerById(a, id)?.type === "image");
  });
  return (
    <>
      <div className="w-40">
        <NumberField label={t("size")} value={brush.size} min={PIXEL_RANGES.size[0]} max={PIXEL_RANGES.size[1]} suffix="px" onCommit={(size) => set({ size })} />
      </div>
      <div className="w-36">
        <NumberField label={t("hardness")} value={percent(brush.hardness)} min={0} max={100} suffix="%" onCommit={(value) => set({ hardness: value / 100 })} />
      </div>
      <div className="w-36">
        <NumberField label={t("opacity")} value={percent(brush.opacity)} min={1} max={100} suffix="%" onCommit={(value) => set({ opacity: value / 100 })} />
      </div>
      {tool === "brush" ? (
        <div className="w-44">
          <ColorField label={t("color")} value={brush.color} onCommit={(color) => set({ color })} />
        </div>
      ) : null}
      {tool === "eraser" && onPhoto ? (
        <div role="group" aria-label={t("eraserMode")} className="flex items-center gap-0.5">
          <ToggleButton label={`${t("hide")} (X)`} pressed={!brush.restore} onClick={() => set({ restore: false })}>
            <span className="px-1 text-xs">{t("hide")}</span>
          </ToggleButton>
          <ToggleButton label={`${t("restore")} (X)`} pressed={brush.restore} onClick={() => set({ restore: true })}>
            <span className="px-1 text-xs">{t("restore")}</span>
          </ToggleButton>
        </div>
      ) : null}
      <SwitchToggle label={t("pressure")} checked={brush.pressure} onChange={(pressure) => set({ pressure })} />
    </>
  );
}

function SelectionOptions() {
  const t = useTranslations("studio.image.pixels.options");
  const tr = useTranslations("studio.image.pixels.refusals");
  const { commands } = useImageEditor();
  const selection = useEditorUi((s) => s.pixelSelection);
  const target = useImageDoc((s) => {
    const home = selection ? artboardById(s.document, selection.artboardId) : undefined;
    const id = s.selection.length === 1 ? s.selection[0] : null;
    return home && id ? (layerById(home, id)?.type ?? null) : null;
  });
  const [issue, setIssue] = useState<PixelEditIssue | null>(null);
  if (!selection) return null;
  const run = (action: () => PixelEditIssue | null) => setIssue(action());
  const pixels = target === "paint" || target === "image";
  return (
    <>
      <div className="w-36">
        <NumberField label={t("feather")} value={selection.feather} min={PIXEL_RANGES.feather[0]} max={PIXEL_RANGES.feather[1]} suffix="px" onCommit={commands.pixel.setFeather} />
      </div>
      <ToggleButton label={`${t("invert")} (Ctrl+Shift+I)`} pressed={selection.invert} onClick={commands.pixel.invert}>
        <span className="px-1 text-xs">{t("invert")}</span>
      </ToggleButton>
      <button type="button" className={OUTLINE_BUTTON_CLASS} disabled={!pixels} onClick={() => run(commands.pixel.erase)}>
        {target === "image" ? t("hideInside") : t("eraseInside")}
      </button>
      {target === "image" ? (
        <button type="button" className={OUTLINE_BUTTON_CLASS} onClick={() => run(commands.pixel.reveal)}>
          {t("revealInside")}
        </button>
      ) : null}
      <button type="button" className={OUTLINE_BUTTON_CLASS} onClick={() => run(commands.pixel.fill)}>
        {t("fill")}
      </button>
      <button type="button" className={OUTLINE_BUTTON_CLASS} disabled={!pixels} onClick={() => run(commands.pixel.crop)}>
        {t("crop")}
      </button>
      <button type="button" className={OUTLINE_BUTTON_CLASS} disabled={!pixels} onClick={() => run(commands.pixel.copyToLayer)}>
        {`${t("copy")} (Ctrl+J)`}
      </button>
      <button type="button" className={OUTLINE_BUTTON_CLASS} onClick={commands.pixel.deselect}>
        {`${t("deselect")} (Esc)`}
      </button>
      {issue ? (
        <span role="status" className="text-xs text-muted-foreground">
          {tr(issue)}
        </span>
      ) : null}
    </>
  );
}

export function PixelOptions() {
  const t = useTranslations("studio.image.pixels.options");
  const tool = useEditorUi((s) => s.pixelTool);
  const selected = useEditorUi((s) => s.pixelSelection !== null);
  if (!tool && !selected) return null;
  return (
    <div role="toolbar" aria-label={t("label")} className="flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-card px-2">
      {isBrushTool(tool) ? <BrushOptions tool={tool} /> : null}
      <SelectionOptions />
    </div>
  );
}
