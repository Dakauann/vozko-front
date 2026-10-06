"use client";

import { useTranslations } from "next-intl";

import { newTextLayer, TEXT_PRESETS, type TextPreset } from "@/lib/studio/document";

import { useImageEditor } from "../editor-state";
import { PanelHeading } from "./panel-heading";

const PRESETS: { preset: TextPreset; className: string; box: number }[] = [
  { preset: "heading", className: "text-2xl font-bold", box: 0.14 },
  { preset: "subheading", className: "text-lg font-semibold", box: 0.1 },
  { preset: "body", className: "text-sm", box: 0.08 },
];

export function TextPanel() {
  const t = useTranslations("studio.image.panels.text");
  const { commands } = useImageEditor();
  return (
    <div className="space-y-3">
      <PanelHeading title={t("title")} hint={t("hint")} />
      <ul className="space-y-2">
        {PRESETS.map(({ preset, className, box }) => (
          <li key={preset}>
            <button
              type="button"
              onClick={() => commands.insert([newTextLayer(t(`defaults.${preset}`), preset, { x: 0.5, y: 0.5, w: 0.8, h: Math.max(box, TEXT_PRESETS[preset].fontSize * 1.6), rotation: 0, opacity: 1 })])}
              className="block w-full rounded-[--radius] border border-control-edge bg-card px-3 py-2 text-left text-foreground transition-colors hover:bg-muted active:bg-[hsl(var(--accent-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={className}>{t(`add.${preset}`)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
