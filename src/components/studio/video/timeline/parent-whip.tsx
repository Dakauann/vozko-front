"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import { TreeStructure } from "@/components/icons";
import type { Clip } from "@/lib/studio/document";
import { takesParent } from "@/lib/studio/parenting";
import { findClip } from "@/lib/studio/timeline";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor } from "../editor-context";
import { useClipLabeler } from "../use-clip-label";

interface Whip {
  pointerId: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export function clipUnder(x: number, y: number): string | null {
  const element = document.elementFromPoint(x, y);
  return element instanceof HTMLElement ? (element.closest<HTMLElement>("[data-clip-id]")?.dataset.clipId ?? null) : null;
}

export function ParentWhip({ clip, locked }: { clip: Clip; locked: boolean }) {
  const t = useTranslations("studio.video.parenting");
  const { store, commands } = useVideoEditor();
  const label = useClipLabeler();
  const parent = useEditorState((s) => (clip.parentId ? (findClip(s.document, clip.parentId)?.clip ?? null) : null));
  const [whip, setWhip] = useState<Whip | null>(null);
  const active = useRef<Whip | null>(null);
  if (!takesParent(clip.type) || (locked && !parent)) return null;
  const title = parent ? t("whipFollowing", { name: label(parent) }) : t("whip");

  const update = (next: Whip | null) => {
    active.current = next;
    setWhip(next);
  };

  const begin = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    if (event.button !== 0 || locked) return;
    event.preventDefault();
    if (event.altKey) {
      if (clip.parentId) commands.setParent([clip.id], null, true);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    update({ pointerId: event.pointerId, from: point, to: point });
  };

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const current = active.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    update({ ...current, to: { x: event.clientX, y: event.clientY } });
  };

  const finish = (event: ReactPointerEvent<HTMLElement>) => {
    const current = active.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    update(null);
    const target = clipUnder(event.clientX, event.clientY);
    if (!target || target === clip.id) return;
    const selection = store.getState().selection;
    const ids = selection.includes(clip.id) ? selection.filter((id) => id !== target) : [clip.id];
    commands.setParent(ids, target, !event.shiftKey);
  };

  return (
    <>
      <span
        role="button"
        tabIndex={-1}
        aria-label={title}
        title={title}
        data-parent-whip={clip.id}
        data-parented={parent ? "true" : undefined}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => update(null)}
        className={cn(
          "pointer-events-auto flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full",
          locked ? "cursor-default" : "cursor-alias hover:bg-muted",
          parent ? "text-primary" : "text-muted-foreground",
        )}
      >
        <TreeStructure className="h-3 w-3" aria-hidden />
      </span>
      {whip
        ? createPortal(
            <svg aria-hidden className="pointer-events-none fixed inset-0 z-[1000] h-screen w-screen">
              <line x1={whip.from.x} y1={whip.from.y} x2={whip.to.x} y2={whip.to.y} stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 3" />
              <circle cx={whip.to.x} cy={whip.to.y} r={3.5} fill="hsl(var(--primary))" />
            </svg>,
            document.body,
          )
        : null}
    </>
  );
}
