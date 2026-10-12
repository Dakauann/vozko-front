import type { IssueCode } from "./validate";
import { GLITCH_SLOTS_PER_SECOND, keyedParams, vfxIssue, vfxLook, type Vfx, type VfxKind, type VfxLook, type VfxParam } from "./vfx";
import { lookReach, type FrameSize } from "./vfx-shapes";

export const STILL_VFX_KINDS = [
  "grain",
  "lightLeak",
  "vignette",
  "chromaticAberration",
  "glitch",
  "lensFlare",
  "glow",
  "mosaic",
  "posterize",
  "mirror",
  "offset",
  "directionalBlur",
  "zoomBlur",
  "spinBlur",
  "waveWarp",
  "ripple",
  "twirl",
  "bulge",
  "cornerPin",
  "fractalNoise",
  "gradientRamp",
  "fourColorGradient",
] as const satisfies readonly VfxKind[];

export type StillVfxKind = (typeof STILL_VFX_KINDS)[number];

export interface StillLook extends VfxLook {
  kind: StillVfxKind;
}

const MOTION_ONLY: ReadonlySet<VfxParam> = new Set(["flicker"]);

const FROZEN: Partial<Record<VfxParam, number>> = { frequency: GLITCH_SLOTS_PER_SECOND, flicker: 0 };

export function isStillKind(kind: string): kind is StillVfxKind {
  return (STILL_VFX_KINDS as readonly string[]).includes(kind);
}

export function stillParams(kind: VfxKind): VfxParam[] {
  return keyedParams(kind).filter((name) => !MOTION_ONLY.has(name));
}

function frozenValues(look: VfxLook): VfxLook["values"] {
  const frozen = Object.entries(FROZEN).filter(([name]) => name in look.values);
  return { ...look.values, ...Object.fromEntries(frozen) };
}

export function stillLook(vfx: Vfx & { kind: StillVfxKind }): StillLook {
  const look = vfxLook(vfx, 0);
  return { ...look, kind: vfx.kind, timeMs: 0, values: frozenValues(look) };
}

export function stillLooks(list: readonly Vfx[] | undefined): StillLook[] {
  return (list ?? []).flatMap((vfx) => (!vfx.hidden && isStillKind(vfx.kind) ? [stillLook({ ...vfx, kind: vfx.kind })] : []));
}

export function stillReach(looks: readonly VfxLook[], frame: FrameSize): number {
  return Math.max(0, ...looks.map((look) => lookReach(look, frame)));
}

function stillIssue(vfx: Vfx): IssueCode | null {
  if (!isStillKind(vfx.kind)) return "unknown";
  if (vfx.offsetMs !== undefined) return "invalid";
  if (Object.values(vfx.keyframes ?? {}).some((lane) => (lane?.length ?? 0) > 0)) return "invalid";
  const allowed = stillParams(vfx.kind);
  return Object.entries(vfx.params ?? {}).every(([name, value]) => value === undefined || allowed.includes(name as VfxParam)) ? null : "invalid";
}

export function stillVfxIssue(list: readonly Vfx[]): IssueCode | null {
  const shared = vfxIssue(list);
  if (shared) return shared;
  for (const vfx of list) {
    const issue = stillIssue(vfx);
    if (issue) return issue;
  }
  return null;
}
