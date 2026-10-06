import { MOTION_DISTANCE, type Clip, type Motion, type MotionEdge, type Transform } from "./document";
import type { ClipPatch } from "./timeline";

export const DEFAULT_MOTION_MS = 500;

const DIRECTION: Record<MotionEdge, [number, number]> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

function eased(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.pow(1 - clamped, 3);
}

export function motionOffset(clip: Pick<Clip, "durationMs" | "motionIn" | "motionOut">, localMs: number): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  const add = (motion: Motion | undefined, progress: number) => {
    if (!motion) return;
    const [x, y] = DIRECTION[motion.edge];
    const amount = MOTION_DISTANCE * eased(progress);
    dx += x * amount;
    dy += y * amount;
  };
  if (clip.motionIn) add(clip.motionIn, localMs / clip.motionIn.durationMs);
  if (clip.motionOut) add(clip.motionOut, (clip.durationMs - localMs) / clip.motionOut.durationMs);
  return { dx: dx === 0 ? 0 : dx, dy: dy === 0 ? 0 : dy };
}

export function movedTransform(transform: Transform, offset: { dx: number; dy: number }): Transform {
  if (offset.dx === 0 && offset.dy === 0) return transform;
  return { ...transform, x: transform.x + offset.dx, y: transform.y + offset.dy };
}

export const ENTRANCE_PRESETS = ["none", "fade", "slideUp", "slideDown", "slideLeft", "slideRight"] as const;
export const EXIT_PRESETS = ["none", "fade", "slideUp", "slideDown", "slideLeft", "slideRight"] as const;

export type MotionPreset = (typeof ENTRANCE_PRESETS)[number];
export type MotionSide = "in" | "out";

const ENTRANCE_EDGE: Partial<Record<MotionPreset, MotionEdge>> = { slideUp: "bottom", slideDown: "top", slideLeft: "right", slideRight: "left" };
const EXIT_EDGE: Partial<Record<MotionPreset, MotionEdge>> = { slideUp: "top", slideDown: "bottom", slideLeft: "left", slideRight: "right" };

export function motionPresetPatch(side: MotionSide, preset: MotionPreset, durationMs: number = DEFAULT_MOTION_MS): ClipPatch {
  const edge = (side === "in" ? ENTRANCE_EDGE : EXIT_EDGE)[preset];
  const fade = preset === "none" ? 0 : Math.round(durationMs);
  const motion = edge ? { edge, durationMs: Math.round(durationMs) } : undefined;
  return side === "in" ? { motionIn: motion, fadeInMs: fade } : { motionOut: motion, fadeOutMs: fade };
}

export function presetOf(clip: Pick<Clip, "motionIn" | "motionOut" | "fadeInMs" | "fadeOutMs">, side: MotionSide): MotionPreset | "custom" {
  const motion = side === "in" ? clip.motionIn : clip.motionOut;
  const fade = side === "in" ? clip.fadeInMs : clip.fadeOutMs;
  if (!motion) return fade > 0 ? "fade" : "none";
  const edges = side === "in" ? ENTRANCE_EDGE : EXIT_EDGE;
  const preset = (Object.keys(edges) as MotionPreset[]).find((key) => edges[key] === motion.edge);
  return preset && fade === motion.durationMs ? preset : "custom";
}
