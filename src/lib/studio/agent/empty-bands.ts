import { BACKGROUND_SHARE } from "./alignment";
import { area, type Box, type SceneGround } from "./scene";
import { inkBox, isText, type TextMeasure } from "./text-ink";

export type BandAxis = "x" | "y";

export interface EmptyBand {
  axis: BandAxis;
  from: number;
  to: number;
}

const EMPTY_BAND_SHARE = 0.25;
const FAINT_OPACITY = 0.1;
const FOCAL_REACH = 0.03;

interface Filled {
  id: string;
  box: Box;
}

const SPANS: Record<BandAxis, (b: Box) => [number, number]> = {
  x: (b) => [b.left, b.right],
  y: (b) => [b.top, b.bottom],
};

function onCanvas(b: Box): Box | null {
  const clipped = { left: Math.max(0, b.left), right: Math.min(1, b.right), top: Math.max(0, b.top), bottom: Math.min(1, b.bottom) };
  return clipped.right > clipped.left && clipped.bottom > clipped.top ? clipped : null;
}

function filledBoxes(scene: SceneGround, measure: TextMeasure): Filled[] {
  return scene.elements.flatMap((el) => {
    if (el.opacity < FAINT_OPACITY) return [];
    const box = onCanvas(isText(el) ? inkBox(scene, el, measure) : el.box);
    if (!box || (!el.media && area(box) >= BACKGROUND_SHARE)) return [];
    return [{ id: el.id, box }];
  });
}

function gaps(spans: readonly [number, number][]): [number, number][] {
  const found: [number, number][] = [];
  let reached = 0;
  for (const [low, high] of [...spans].sort((a, b) => a[0] - b[0])) {
    if (low > reached) found.push([reached, low]);
    reached = Math.max(reached, high);
  }
  if (reached < 1) found.push([reached, 1]);
  return found;
}

function framesFocal(gap: [number, number], filled: readonly Filled[], focal: ReadonlySet<string>, span: (b: Box) => [number, number]): boolean {
  return filled.some(({ id, box }) => {
    if (!focal.has(id)) return false;
    const [low, high] = span(box);
    return Math.abs(high - gap[0]) <= FOCAL_REACH || Math.abs(low - gap[1]) <= FOCAL_REACH;
  });
}

export function emptyBands(scene: SceneGround, measure: TextMeasure, focal: ReadonlySet<string>): EmptyBand[] {
  const filled = filledBoxes(scene, measure);
  if (filled.length === 0) return [];
  return (Object.keys(SPANS) as BandAxis[]).flatMap((axis) => {
    const span = SPANS[axis];
    const open = gaps(filled.map(({ box }) => span(box))).filter((gap) => gap[1] - gap[0] >= EMPTY_BAND_SHARE && !framesFocal(gap, filled, focal, span));
    if (open.length === 0) return [];
    const [from, to] = open.reduce((wide, gap) => (gap[1] - gap[0] > wide[1] - wide[0] ? gap : wide));
    return [{ axis, from, to }];
  });
}
