"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, CaretRight, Stack } from "@/components/icons";
import { cn } from "@/lib/utils";

import { useEditorUi, useImageDoc, useImageEditor } from "./editor-state";
import { Inspector } from "./inspector/inspector";
import { LayersPanel } from "./panels/layers-panel";

export const MIN_LAYERS_PX = 120;
export const MIN_INSPECTOR_PX = 160;
const KEY_STEP_PX = 24;

export function RightDock() {
  const t = useTranslations("studio.image.panels.layers");
  const { ui } = useImageEditor();
  const open = useEditorUi((s) => s.layersOpen);
  const height = useEditorUi((s) => s.layersHeight);
  const count = useImageDoc((s) => s.document.artboards.reduce((total, a) => total + a.layers.length, 0));
  const dock = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);

  const clampHeight = (value: number) => {
    const total = dock.current?.clientHeight ?? 0;
    const max = Math.max(MIN_LAYERS_PX, total - MIN_INSPECTOR_PX);
    return Math.round(Math.min(Math.max(value, MIN_LAYERS_PX), max));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!open) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startHeight: height };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const session = drag.current;
    if (!session) return;
    ui.setState({ layersHeight: clampHeight(session.startHeight + session.startY - event.clientY) });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    event.stopPropagation();
    ui.setState({ layersHeight: clampHeight(height + (event.key === "ArrowUp" ? KEY_STEP_PX : -KEY_STEP_PX)) });
  };

  return (
    <div ref={dock} className="flex w-[272px] shrink-0 flex-col border-l border-border bg-card max-xl:w-64">
      <div className="min-h-0 flex-1">
        <Inspector />
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={t("resize")}
        aria-valuenow={open ? height : 0}
        aria-valuemin={MIN_LAYERS_PX}
        tabIndex={open ? 0 : -1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          "relative h-1.5 shrink-0 border-t border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "cursor-row-resize hover:bg-muted",
        )}
      />
      <section
        data-tour="studio-image-layers"
        aria-label={t("title")}
        className="flex min-h-0 shrink-0 flex-col"
        style={open ? { height } : undefined}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls="studio-image-layers-body"
          onClick={() => ui.setState({ layersOpen: !open })}
          className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {open ? <CaretDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : <CaretRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
          <Stack className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="legend flex-1 text-foreground">{t("title")}</span>
          <span className="readout text-2xs text-muted-foreground">{count}</span>
        </button>
        {open ? (
          <div id="studio-image-layers-body" className="min-h-0 flex-1">
            <LayersPanel />
          </div>
        ) : null}
      </section>
    </div>
  );
}
