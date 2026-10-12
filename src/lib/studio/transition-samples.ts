import { emptyVideoDocument, newOverlayClip, newShapeLayer, type Clip, type ShapeKind, type Transform, type VideoDocument } from "./document";
import { edgeTransition, type EdgeTransitionKind } from "./edge-transitions";
import { addTransition, TRANSITION_SPECS, type VisualTransitionKind } from "./transitions";

const CLIP_MS = 1000;
const CUT_PROGRESS = 0.4;
const EDGE_PROGRESS = 0.6;
const BACKDROP = "#1d2433";
const FROM_FILL = "#3b5b8c";
const TO_FILL = "#e46a4f";
const MARK_FILL = "#f2c14e";

function sampleClip(id: string, shape: Exclude<ShapeKind, "path">, fill: string, startMs: number, transform: Transform): Clip {
  const layer = { ...newShapeLayer(shape, transform), id: `l-${id}`, fill };
  return { ...newOverlayClip(layer, startMs, CLIP_MS, transform), id };
}

const FULL: Transform = { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 };
const FROM_BOX: Transform = { x: 0.5, y: 0.5, w: 0.78, h: 0.72, rotation: 0, opacity: 1 };
const TO_BOX: Transform = { x: 0.5, y: 0.5, w: 0.62, h: 0.86, rotation: 0, opacity: 1 };
const MARK: Transform = { x: 0.5, y: 0.5, w: 0.5, h: 0.6, rotation: 0, opacity: 1 };

export function transitionSample(kind: VisualTransitionKind): { doc: VideoDocument; atMs: number } {
  const base = emptyVideoDocument("landscape", BACKDROP);
  base.tracks = [{ id: "t-sample", kind: "visual", clips: [sampleClip("sample-from", "rect", FROM_FILL, 0, FROM_BOX), sampleClip("sample-to", "ellipse", TO_FILL, CLIP_MS, TO_BOX)] }];
  base.durationMs = 2 * CLIP_MS;
  const durationMs = TRANSITION_SPECS[kind].durationMs;
  const placed = addTransition(base, { fromClipId: "sample-from", toClipId: "sample-to", kind, durationMs });
  if (!placed.ok) throw new Error(`no sample for ${kind}: ${placed.reason}`);
  const doc = { ...placed.document, tracks: placed.document.tracks.map((track) => ({ ...track, transitions: track.transitions?.map((transition) => ({ ...transition, id: "sample-transition" })) })) };
  return { doc, atMs: Math.round(CLIP_MS - durationMs / 2 + durationMs * CUT_PROGRESS) };
}

export function edgeSample(kind: EdgeTransitionKind): { doc: VideoDocument; atMs: number } {
  const transition = edgeTransition({ kind });
  if (typeof transition === "string") throw new Error(`no sample for ${kind}: ${transition}`);
  const doc = emptyVideoDocument("landscape", BACKDROP);
  doc.tracks = [
    { id: "t-backdrop", kind: "visual", clips: [sampleClip("sample-backdrop", "rect", FROM_FILL, 0, FULL)] },
    { id: "t-mark", kind: "visual", clips: [{ ...sampleClip("sample-mark", "ellipse", MARK_FILL, 0, MARK), transitionIn: transition }] },
  ];
  doc.durationMs = CLIP_MS;
  return { doc, atMs: Math.round(transition.durationMs * EDGE_PROGRESS) };
}
