"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { IMAGE_PRESETS, STUDIO_LIMITS, type CanvasSize } from "@/lib/studio/document";
import { canvasSizeIssue } from "@/lib/studio/validate";
import { cn } from "@/lib/utils";

import { FIELD_CLASS, ICON_BUTTON_CLASS, Notice, PRIMARY_BUTTON_CLASS } from "./controls";
import { useActiveCanvas, useImageEditor } from "./editor-state";

export function ResizeForm({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("studio.image.resize");
  const tp = useTranslations("studio.presets");
  const { commands } = useImageEditor();
  const canvas = useActiveCanvas();
  const [width, setWidth] = useState(String(canvas.width));
  const [height, setHeight] = useState(String(canvas.height));
  const custom: CanvasSize = { width: Number(width), height: Number(height) };
  const invalid = canvasSizeIssue(custom) !== null;

  const apply = (size: CanvasSize) => {
    commands.resize(size);
    setWidth(String(size.width));
    setHeight(String(size.height));
    onDone?.();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {IMAGE_PRESETS.map((preset) => {
          const current = preset.width === canvas.width && preset.height === canvas.height;
          return (
            <li key={preset.id}>
              <button
                type="button"
                aria-current={current || undefined}
                onClick={() => apply(preset)}
                className={cn(ICON_BUTTON_CLASS, "h-9 w-full justify-between", current && "bg-muted")}
              >
                <span>{tp(preset.id)}</span>
                <span className="tabular-nums text-muted-foreground">{t("dimensions", { width: preset.width, height: preset.height })}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="space-y-2 border-t border-border pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) apply(custom);
        }}
      >
        <p className="legend text-muted-foreground">{t("custom")}</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>{t("width")}</span>
            <input type="number" inputMode="numeric" value={width} min={STUDIO_LIMITS.minCanvasSide} max={STUDIO_LIMITS.maxCanvasSide} onChange={(event) => setWidth(event.target.value)} className={FIELD_CLASS} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>{t("height")}</span>
            <input type="number" inputMode="numeric" value={height} min={STUDIO_LIMITS.minCanvasSide} max={STUDIO_LIMITS.maxCanvasSide} onChange={(event) => setHeight(event.target.value)} className={FIELD_CLASS} />
          </label>
        </div>
        {invalid ? (
          <Notice tone="fault" title={t("outOfRange", { min: STUDIO_LIMITS.minCanvasSide, max: STUDIO_LIMITS.maxCanvasSide })} />
        ) : null}
        <button type="submit" disabled={invalid} className={cn(PRIMARY_BUTTON_CLASS, "w-full")}>
          {t("apply")}
        </button>
      </form>
    </div>
  );
}
