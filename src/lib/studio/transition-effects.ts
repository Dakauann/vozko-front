import type { ClipTransition } from "./edge-transitions";
import { ease } from "./keyframes";
import type { MotionSide } from "./motion";
import type { RevealField } from "./reveal-field";
import { optionValue, TRANSITION_SPECS, type IrisShape, type SplitOrientation, type TransitionDirection, type TransitionShape } from "./transitions";

const TRANSITION_BLUR_PX = 40;
const WHIP_BLUR_PX = 60;
const CIRCLE_SEGMENTS = 64;
const ARC_STEP_DEG = 5;

export type ShapeReveal =
  | { kind: "halfPlane"; angle: number; progress: number }
  | { kind: "shape"; shape: IrisShape; originX: number; originY: number; size: number }
  | { kind: "sector"; originX: number; originY: number; startAngle: number; sweep: number; clockwise: boolean }
  | { kind: "band"; orientation: SplitOrientation; size: number };

export interface FieldReveal {
  kind: "field";
  field: RevealField;
  progress: number;
  softness: number;
}

export type Reveal = (ShapeReveal | FieldReveal) & { inverse?: boolean };

export interface Tint {
  color: string;
  amount: number;
}

export interface TransitionLook {
  dx: number;
  dy: number;
  scale: number;
  origin?: { x: number; y: number };
  opacity: number;
  blurPx: number;
  tint?: Tint;
  reveal?: Reveal;
  above: boolean;
}

export type TransitionRole = "from" | "to";

const STILL: TransitionLook = { dx: 0, dy: 0, scale: 1, opacity: 1, blurPx: 0, above: false };
const HIDDEN: TransitionLook = { ...STILL, opacity: 0 };

const VECTORS: Record<TransitionDirection, { x: number; y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

function moved(direction: TransitionDirection, amount: number): Pick<TransitionLook, "dx" | "dy"> {
  const v = VECTORS[direction];
  return { dx: v.x * amount + 0, dy: v.y * amount + 0 };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function revealFieldOf(transition: TransitionShape): RevealField | null {
  switch (transition.kind) {
    case "gradientWipe":
      return transition.mapAssetId
        ? { pattern: "image", assetId: transition.mapAssetId, reverse: optionValue(transition, "reverse") }
        : { pattern: "gradient", map: optionValue(transition, "map"), angle: optionValue(transition, "angle"), originX: optionValue(transition, "originX"), originY: optionValue(transition, "originY"), reverse: optionValue(transition, "reverse") };
    case "venetianBlinds":
      return { pattern: "blinds", angle: optionValue(transition, "angle"), size: optionValue(transition, "size") };
    case "blockDissolve":
      return { pattern: "blocks", size: optionValue(transition, "size") };
    case "radialWipe":
      return { pattern: "fan", angle: optionValue(transition, "angle"), originX: optionValue(transition, "originX"), originY: optionValue(transition, "originY") };
    default:
      return null;
  }
}

export function transitionLook(transition: TransitionShape, role: TransitionRole, t: number, solidFrom: boolean): TransitionLook {
  const raw = ease(transition.easing, clamp01(t));
  const p = clamp01(raw);
  const firstHalf = t < 0.5;
  switch (transition.kind) {
    case "dissolve":
      return role === "to" ? { ...STILL, opacity: p } : { ...STILL, opacity: solidFrom ? 1 : 1 - p };
    case "blurDissolve": {
      const blurPx = optionValue(transition, "amount") * TRANSITION_BLUR_PX * Math.sin(Math.PI * clamp01(t));
      return role === "to" ? { ...STILL, opacity: p, blurPx } : { ...STILL, opacity: solidFrom ? 1 : 1 - p, blurPx };
    }
    case "dipToColor": {
      const showing = role === "from" ? firstHalf : !firstHalf;
      return showing ? { ...STILL, tint: { color: optionValue(transition, "color"), amount: 1 - Math.abs(1 - 2 * p) } } : HIDDEN;
    }
    case "push": {
      const direction = optionValue(transition, "direction");
      return { ...STILL, ...moved(direction, role === "from" ? raw : raw - 1) };
    }
    case "slide": {
      const direction = optionValue(transition, "direction");
      if (optionValue(transition, "moving") === "out") return role === "from" ? { ...STILL, ...moved(direction, raw), above: true } : STILL;
      return role === "to" ? { ...STILL, ...moved(direction, raw - 1) } : STILL;
    }
    case "wipe":
      return role === "to" ? { ...STILL, reveal: { kind: "halfPlane", angle: optionValue(transition, "angle"), progress: p } } : STILL;
    case "iris": {
      const shape = optionValue(transition, "shape");
      const originX = optionValue(transition, "originX");
      const originY = optionValue(transition, "originY");
      if (optionValue(transition, "reverse")) return role === "from" ? { ...STILL, above: true, reveal: { kind: "shape", shape, originX, originY, size: 1 - p } } : STILL;
      return role === "to" ? { ...STILL, reveal: { kind: "shape", shape, originX, originY, size: p } } : STILL;
    }
    case "clockWipe":
      return role === "to"
        ? { ...STILL, reveal: { kind: "sector", originX: optionValue(transition, "originX"), originY: optionValue(transition, "originY"), startAngle: optionValue(transition, "angle"), sweep: p * 360, clockwise: optionValue(transition, "clockwise") } }
        : STILL;
    case "split": {
      const orientation = optionValue(transition, "orientation");
      if (optionValue(transition, "reverse")) return role === "from" ? { ...STILL, above: true, reveal: { kind: "band", orientation, size: 1 - p } } : STILL;
      return role === "to" ? { ...STILL, reveal: { kind: "band", orientation, size: p } } : STILL;
    }
    case "zoom": {
      const showing = role === "from" ? firstHalf : !firstHalf;
      if (!showing) return HIDDEN;
      const amount = optionValue(transition, "amount");
      const q = clamp01(role === "from" ? raw * 2 : (1 - raw) * 2);
      return { ...STILL, scale: 1 + amount * q, origin: { x: optionValue(transition, "originX"), y: optionValue(transition, "originY") }, blurPx: amount * TRANSITION_BLUR_PX * q };
    }
    case "whip": {
      const showing = role === "from" ? firstHalf : !firstHalf;
      if (!showing) return HIDDEN;
      const q = role === "from" ? raw * 2 : raw * 2 - 1;
      const blurPx = optionValue(transition, "amount") * WHIP_BLUR_PX * (role === "from" ? clamp01(q) : clamp01(1 - q));
      return { ...STILL, ...moved(optionValue(transition, "direction"), role === "from" ? q : q - 1), blurPx };
    }
    case "gradientWipe":
    case "venetianBlinds":
    case "blockDissolve":
    case "radialWipe": {
      const field = revealFieldOf(transition);
      return role === "to" && field ? { ...STILL, reveal: { kind: "field", field, progress: p, softness: optionValue(transition, "softness") } } : STILL;
    }
    case "constantPower":
    case "constantGain":
      return STILL;
  }
}

export function edgeLook(transition: ClipTransition, side: MotionSide, t: number): TransitionLook {
  const shaped: TransitionShape = { ...transition, moving: side };
  const local = TRANSITION_SPECS[transition.kind].sequential ? (side === "in" ? 0.5 + t / 2 : t / 2) : t;
  const role: TransitionRole = side === "in" ? "to" : "from";
  const own = transitionLook(shaped, role, local, false);
  if (own.reveal) return own;
  const other = transitionLook(shaped, role === "to" ? "from" : "to", local, false).reveal;
  return other ? { ...own, reveal: { ...other, inverse: !other.inverse } } : own;
}

type Point = [number, number];

function clipHalfPlane(polygon: Point[], nx: number, ny: number, limit: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const da = a[0] * nx + a[1] * ny - limit;
    const db = b[0] * nx + b[1] * ny - limit;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const s = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]);
    }
  }
  return out;
}

function flat(points: Point[]): number[] {
  return points.flatMap(([x, y]) => [x, y]);
}

export function revealPolygon(reveal: ShapeReveal, width: number, height: number): number[] {
  const frame: Point[] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  switch (reveal.kind) {
    case "halfPlane": {
      const radians = (reveal.angle * Math.PI) / 180;
      const nx = Math.cos(radians);
      const ny = Math.sin(radians);
      const projections = frame.map(([x, y]) => x * nx + y * ny);
      const low = Math.min(...projections);
      const high = Math.max(...projections);
      return reveal.progress <= 0 ? [] : flat(clipHalfPlane(frame, nx, ny, low + (high - low) * reveal.progress));
    }
    case "band": {
      if (reveal.size <= 0) return [];
      if (reveal.orientation === "vertical") {
        const half = (width * reveal.size) / 2;
        return flat([
          [width / 2 - half, 0],
          [width / 2 + half, 0],
          [width / 2 + half, height],
          [width / 2 - half, height],
        ]);
      }
      const half = (height * reveal.size) / 2;
      return flat([
        [0, height / 2 - half],
        [width, height / 2 - half],
        [width, height / 2 + half],
        [0, height / 2 + half],
      ]);
    }
    case "shape": {
      if (reveal.size <= 0) return [];
      const ox = reveal.originX * width;
      const oy = reveal.originY * height;
      const reachX = Math.max(ox, width - ox);
      const reachY = Math.max(oy, height - oy);
      if (reveal.shape === "box") {
        const hx = reachX * reveal.size;
        const hy = reachY * reveal.size;
        return flat([
          [ox - hx, oy - hy],
          [ox + hx, oy - hy],
          [ox + hx, oy + hy],
          [ox - hx, oy + hy],
        ]);
      }
      if (reveal.shape === "diamond") {
        const hx = 2 * reachX * reveal.size;
        const hy = 2 * reachY * reveal.size;
        return flat([
          [ox, oy - hy],
          [ox + hx, oy],
          [ox, oy + hy],
          [ox - hx, oy],
        ]);
      }
      const radius = Math.hypot(reachX, reachY) * reveal.size;
      return flat(Array.from({ length: CIRCLE_SEGMENTS }, (_, i): Point => [ox + radius * Math.cos((2 * Math.PI * i) / CIRCLE_SEGMENTS), oy + radius * Math.sin((2 * Math.PI * i) / CIRCLE_SEGMENTS)]));
    }
    case "sector": {
      if (reveal.sweep <= 0) return [];
      const ox = reveal.originX * width;
      const oy = reveal.originY * height;
      const radius = 2 * Math.hypot(width, height);
      const sign = reveal.clockwise ? 1 : -1;
      const steps = Math.max(1, Math.ceil(reveal.sweep / ARC_STEP_DEG));
      const arc = Array.from({ length: steps + 1 }, (_, i): Point => {
        const degrees = reveal.startAngle + sign * (reveal.sweep * i) / steps;
        const radians = ((degrees - 90) * Math.PI) / 180;
        return [ox + radius * Math.cos(radians), oy + radius * Math.sin(radians)];
      });
      return flat([[ox, oy], ...arc]);
    }
  }
}
