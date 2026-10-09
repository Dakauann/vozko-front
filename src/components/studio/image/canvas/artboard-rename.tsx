"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { artboardById } from "@/lib/studio/artboards";
import { STUDIO_LIMITS, type Artboard } from "@/lib/studio/document";
import type { Viewport } from "@/lib/studio/viewport";

import { useArtboardNames } from "../artboard-names";
import { useEditorUi, useImageDoc, useImageEditor } from "../editor-state";
import { LABEL_GAP_PX, LABEL_PX } from "./artboard-labels";

const FIELD_HEIGHT_PX = 22;
const MIN_FIELD_PX = 120;

function RenameField({ artboard, name, viewport, onDone, onCancel }: { artboard: Artboard; name: string; viewport: Viewport; onDone: (name: string) => void; onCancel: () => void }) {
  const t = useTranslations("studio.image.artboards");
  const [value, setValue] = useState(name);
  const field = useRef<HTMLInputElement>(null);
  const settled = useRef(false);

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  const finish = (save: boolean) => {
    if (settled.current) return;
    settled.current = true;
    if (save) onDone(value);
    else onCancel();
  };

  const left = viewport.x + artboard.x * viewport.scale;
  const top = viewport.y + artboard.y * viewport.scale - LABEL_GAP_PX - FIELD_HEIGHT_PX + (FIELD_HEIGHT_PX - LABEL_PX) / 2;
  return (
    <input
      ref={field}
      aria-label={t("rename")}
      value={value}
      maxLength={STUDIO_LIMITS.maxLayerNameRunes}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(true);
        if (event.key === "Escape") finish(false);
      }}
      className="absolute z-10 rounded-sm border border-primary bg-card px-1 text-xs font-semibold text-foreground outline-none"
      style={{ left, top, height: FIELD_HEIGHT_PX, width: Math.max(MIN_FIELD_PX, artboard.canvas.width * viewport.scale) }}
    />
  );
}

export function ArtboardRename() {
  const { ui, commands } = useImageEditor();
  const names = useArtboardNames();
  const id = useEditorUi((s) => s.renamingArtboardId);
  const viewport = useEditorUi((s) => s.viewport);
  const artboard = useImageDoc((s) => (id ? artboardById(s.document, id) : undefined));
  if (!id || !artboard) return null;
  return (
    <RenameField
      key={id}
      artboard={artboard}
      name={artboard.name ?? names.get(id) ?? ""}
      viewport={viewport}
      onDone={(name) => commands.finishRenamingArtboard(id, name)}
      onCancel={() => ui.setState({ renamingArtboardId: null })}
    />
  );
}
