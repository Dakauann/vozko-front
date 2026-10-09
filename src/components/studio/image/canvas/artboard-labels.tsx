"use client";

import type Konva from "konva";
import { useRef } from "react";
import { Text } from "react-konva";

import type { Artboard } from "@/lib/studio/document";
import type { Point } from "@/lib/studio/viewport";

import { SELECTION_COLOR } from "./artboard-view";

export const LABEL_PX = 12;
export const LABEL_GAP_PX = 6;

const IDLE_COLOR = "#6b7280";
const ACTIVE_COLOR = "#1f2937";

export function labelTop(artboard: Artboard, scale: number): number {
  return artboard.y - (LABEL_PX + LABEL_GAP_PX) / scale;
}

export interface ArtboardMove {
  ids: string[];
  start: Map<string, Point>;
}

interface ArtboardLabelsProps {
  artboards: readonly Artboard[];
  names: ReadonlyMap<string, string>;
  selected: ReadonlySet<string>;
  activeId: string;
  renamingId: string | null;
  scale: number;
  onSelect: (id: string, additive: boolean) => void;
  onRename: (id: string) => void;
  onMoveStart: (id: string) => ArtboardMove;
  onMove: (move: ArtboardMove, shift: Point) => void;
  onMoveEnd: (move: ArtboardMove, shift: Point) => void;
}

export function ArtboardLabels({ artboards, names, selected, activeId, renamingId, scale, onSelect, onRename, onMoveStart, onMove, onMoveEnd }: ArtboardLabelsProps) {
  const labels = useRef(new Map<string, Konva.Text>());
  const moving = useRef<{ move: ArtboardMove; anchor: string } | null>(null);

  const shiftOf = (node: Konva.Text, move: ArtboardMove, anchor: string): Point => {
    const start = move.start.get(anchor)!;
    return { x: node.x() - start.x, y: node.y() - (start.y - (LABEL_PX + LABEL_GAP_PX) / scale) };
  };

  const followLabels = (move: ArtboardMove, anchor: string, shift: Point) => {
    for (const id of move.ids) {
      if (id === anchor) continue;
      const start = move.start.get(id);
      const label = labels.current.get(id);
      if (start && label) label.position({ x: start.x + shift.x, y: start.y + shift.y - (LABEL_PX + LABEL_GAP_PX) / scale });
    }
  };

  return (
    <>
      {artboards.map((artboard) => {
        const chosen = selected.has(artboard.id);
        return (
          <Text
            key={artboard.id}
            ref={(node) => {
              if (node) labels.current.set(artboard.id, node);
              else labels.current.delete(artboard.id);
            }}
            x={artboard.x}
            y={labelTop(artboard, scale)}
            text={names.get(artboard.id) ?? ""}
            fontSize={LABEL_PX / scale}
            fontFamily="Inter, system-ui, sans-serif"
            fontStyle={chosen || artboard.id === activeId ? "600" : "normal"}
            fill={chosen ? SELECTION_COLOR : artboard.id === activeId ? ACTIVE_COLOR : IDLE_COLOR}
            width={artboard.canvas.width}
            wrap="none"
            ellipsis
            visible={renamingId !== artboard.id}
            draggable
            onMouseDown={(event) => {
              if (event.evt.button !== 0) return;
              event.cancelBubble = true;
              onSelect(artboard.id, event.evt.shiftKey);
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              onSelect(artboard.id, false);
            }}
            onDblClick={() => onRename(artboard.id)}
            onDblTap={() => onRename(artboard.id)}
            onDragStart={() => {
              moving.current = { move: onMoveStart(artboard.id), anchor: artboard.id };
            }}
            onDragMove={(event) => {
              const session = moving.current;
              if (!session) return;
              const shift = shiftOf(event.target as Konva.Text, session.move, session.anchor);
              followLabels(session.move, session.anchor, shift);
              onMove(session.move, shift);
            }}
            onDragEnd={(event) => {
              const session = moving.current;
              moving.current = null;
              if (session) onMoveEnd(session.move, shiftOf(event.target as Konva.Text, session.move, session.anchor));
            }}
          />
        );
      })}
    </>
  );
}
