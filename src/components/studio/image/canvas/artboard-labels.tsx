"use client";

import type Konva from "konva";
import { useRef } from "react";
import { Group, Rect, Text } from "react-konva";

import type { Artboard } from "@/lib/studio/document";
import type { Point } from "@/lib/studio/viewport";

import { SELECTION_COLOR } from "./artboard-view";

export const LABEL_PX = 12;
export const LABEL_GAP_PX = 6;

const IDLE_COLOR = "#6b7280";
const ACTIVE_COLOR = "#1f2937";
const COMPONENT_COLOR = "#7c3aed";
const BADGE_PX = 7;
const BADGE_GAP_PX = 5;

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
  const labels = useRef(new Map<string, Konva.Group>());
  const moving = useRef<{ move: ArtboardMove; anchor: string } | null>(null);

  const shiftOf = (node: Konva.Node, move: ArtboardMove, anchor: string): Point => {
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
        const color = chosen ? SELECTION_COLOR : artboard.component ? COMPONENT_COLOR : artboard.id === activeId ? ACTIVE_COLOR : IDLE_COLOR;
        const indent = artboard.component ? (BADGE_PX * Math.SQRT2 + BADGE_GAP_PX) / scale : 0;
        return (
          <Group
            key={artboard.id}
            ref={(node) => {
              if (node) labels.current.set(artboard.id, node);
              else labels.current.delete(artboard.id);
            }}
            x={artboard.x}
            y={labelTop(artboard, scale)}
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
              const shift = shiftOf(event.target, session.move, session.anchor);
              followLabels(session.move, session.anchor, shift);
              onMove(session.move, shift);
            }}
            onDragEnd={(event) => {
              const session = moving.current;
              moving.current = null;
              if (session) onMoveEnd(session.move, shiftOf(event.target, session.move, session.anchor));
            }}
          >
            {artboard.component ? <Rect x={(BADGE_PX * Math.SQRT2) / 2 / scale} y={(LABEL_PX / 2) / scale} offsetX={BADGE_PX / 2 / scale} offsetY={BADGE_PX / 2 / scale} width={BADGE_PX / scale} height={BADGE_PX / scale} rotation={45} fill={color} /> : null}
            <Text
              x={indent}
              text={names.get(artboard.id) ?? ""}
              fontSize={LABEL_PX / scale}
              fontFamily="Inter, system-ui, sans-serif"
              fontStyle={chosen || artboard.id === activeId ? "600" : "normal"}
              fill={color}
              width={Math.max(artboard.canvas.width - indent, 1)}
              wrap="none"
              ellipsis
            />
          </Group>
        );
      })}
    </>
  );
}
