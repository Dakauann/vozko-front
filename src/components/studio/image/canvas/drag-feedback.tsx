"use client";

import { Group, Line, Rect } from "react-konva";

import { artboardById } from "@/lib/studio/artboards";

import { useEditorUi, useImageDoc } from "../editor-state";
import { LayerOutline, SELECTION_COLOR } from "./artboard-view";

const GUIDE_COLOR = "#e11d74";
const MARQUEE_FILL = "rgba(99,102,241,0.08)";

export function DragFeedback() {
  const feedback = useEditorUi((s) => s.dragFeedback);
  const scale = useEditorUi((s) => s.viewport.scale);
  const doc = useImageDoc((s) => s.document);
  if (!feedback) return null;
  const home = artboardById(doc, feedback.artboardId);
  const target = feedback.dropArtboardId ? artboardById(doc, feedback.dropArtboardId) : undefined;
  const host = feedback.hostId ? home?.layers.find((l) => l.id === feedback.hostId) : undefined;
  return (
    <>
      {target ? <Rect x={target.x} y={target.y} width={target.canvas.width} height={target.canvas.height} stroke={SELECTION_COLOR} strokeWidth={2.5 / scale} listening={false} /> : null}
      {home && host ? (
        <Group x={home.x} y={home.y} listening={false}>
          <LayerOutline layer={host} canvas={home.canvas} scale={scale} solid />
        </Group>
      ) : null}
      {home && feedback.guides ? (
        <Group x={home.x} y={home.y} listening={false}>
          {feedback.guides.vertical.map((x) => <Line key={`v${x}`} points={[x, 0, x, home.canvas.height]} stroke={GUIDE_COLOR} strokeWidth={1 / scale} />)}
          {feedback.guides.horizontal.map((y) => <Line key={`h${y}`} points={[0, y, home.canvas.width, y]} stroke={GUIDE_COLOR} strokeWidth={1 / scale} />)}
        </Group>
      ) : null}
    </>
  );
}

export function MarqueeBox() {
  const marquee = useEditorUi((s) => s.marquee);
  const scale = useEditorUi((s) => s.viewport.scale);
  if (!marquee) return null;
  return (
    <Rect
      x={Math.min(marquee.left, marquee.right)}
      y={Math.min(marquee.top, marquee.bottom)}
      width={Math.abs(marquee.right - marquee.left)}
      height={Math.abs(marquee.bottom - marquee.top)}
      fill={MARQUEE_FILL}
      stroke={SELECTION_COLOR}
      strokeWidth={1 / scale}
      listening={false}
    />
  );
}
