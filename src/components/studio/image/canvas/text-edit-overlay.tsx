"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { DEFAULT_LINE_HEIGHT } from "@/components/studio/canvas/layer-node";
import { STUDIO_LIMITS, type CanvasSize, type Layer } from "@/lib/studio/document";
import { cssFontOf, DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT } from "@/lib/studio/fonts";
import type { Viewport } from "@/lib/studio/viewport";

import { useEditorUi, useImageDoc, useImageEditor } from "../editor-state";

interface TextEditorProps {
  layer: Layer;
  canvas: CanvasSize;
  viewport: Viewport;
  onDone: (text: string) => void;
}

function TextEditor({ layer, canvas, viewport, onDone }: TextEditorProps) {
  const t = useTranslations("studio.image.canvas");
  const [value, setValue] = useState(layer.text ?? "");
  const area = useRef<HTMLTextAreaElement>(null);
  const finished = useRef(false);
  const latest = useRef(value);
  const done = useRef(onDone);

  useEffect(() => {
    latest.current = value;
    done.current = onDone;
  }, [value, onDone]);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    done.current(latest.current);
  };

  useEffect(() => {
    area.current?.focus();
    area.current?.select();
    return () => {
      if (!finished.current) {
        finished.current = true;
        done.current(latest.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [value, viewport.scale]);

  const tr = layer.transform;
  const scale = viewport.scale;
  const width = tr.w * canvas.width * scale;
  const height = tr.h * canvas.height * scale;
  const centerX = tr.x * canvas.width * scale + viewport.x;
  const centerY = tr.y * canvas.height * scale + viewport.y;
  const fontPx = (layer.fontSize ?? 0) * canvas.height * scale;

  return (
    <div
      className="pointer-events-none absolute flex items-center"
      style={{ left: centerX - width / 2, top: centerY - height / 2, width, minHeight: height, transform: `rotate(${tr.rotation}deg)`, transformOrigin: "50% 50%" }}
    >
      <textarea
        ref={area}
        aria-label={t("editText")}
        value={value}
        maxLength={STUDIO_LIMITS.maxTextRunes}
        onChange={(event) => setValue(event.target.value)}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) {
            event.preventDefault();
            event.stopPropagation();
            finish();
          }
        }}
        spellCheck={false}
        className="pointer-events-auto block w-full select-text resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent p-0 outline outline-2 outline-offset-2 outline-primary"
        style={{
          font: cssFontOf(layer.fontId ?? DEFAULT_FONT_ID, layer.fontWeight || DEFAULT_FONT_WEIGHT, Boolean(layer.italic), fontPx),
          lineHeight: layer.lineHeight || DEFAULT_LINE_HEIGHT,
          letterSpacing: `${(layer.letterSpacing ?? 0) * fontPx}px`,
          color: layer.fill || "#000000",
          textAlign: layer.align || "left",
          opacity: tr.opacity,
        }}
      />
    </div>
  );
}

export function TextEditOverlay() {
  const { commands } = useImageEditor();
  const id = useEditorUi((s) => s.editingTextId);
  const viewport = useEditorUi((s) => s.viewport);
  const layer = useImageDoc((s) => (id ? s.document.layers.find((l) => l.id === id) : undefined));
  const canvas = useImageDoc((s) => s.document.canvas);
  if (!id || !layer) return null;
  return <TextEditor key={id} layer={layer} canvas={canvas} viewport={viewport} onDone={(text) => commands.finishTextEdit(id, text)} />;
}
