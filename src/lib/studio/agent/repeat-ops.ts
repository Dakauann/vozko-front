import { defaultRepeat, MIRROR_SIDES, REPEAT_DIRECTIONS, REPEAT_FLIPS, REPEAT_LAYOUTS, REPEAT_MODES, REPEAT_RANGES, repeatIssue, type Repeat, type RepeatBox, type RepeatMode } from "../repeat";
import { firstProblem, outOfRange, type Patched } from "./layer-style";

export interface AgentRepeat {
  mode?: string;
  count?: number;
  shown?: number;
  radius?: number;
  start_angle?: number;
  sweep?: number;
  direction?: string;
  upright?: boolean;
  reverse_overlap?: boolean;
  rows?: number;
  columns?: number;
  gap_x?: number;
  gap_y?: number;
  layout?: string;
  offset?: number;
  flip_rows?: string;
  flip_columns?: string;
  angle?: number;
  gap?: number;
  side?: string;
}

const FIELDS: Record<RepeatMode, readonly (keyof AgentRepeat)[]> = {
  radial: ["count", "shown", "radius", "start_angle", "sweep", "direction", "upright", "reverse_overlap"],
  grid: ["rows", "columns", "gap_x", "gap_y", "layout", "offset", "flip_rows", "flip_columns"],
  mirror: ["angle", "gap", "side"],
};

const NAMES: Record<keyof AgentRepeat, keyof Repeat> = {
  mode: "mode",
  count: "count",
  shown: "shown",
  radius: "radius",
  start_angle: "startAngle",
  sweep: "sweep",
  direction: "direction",
  upright: "upright",
  reverse_overlap: "reverseOverlap",
  rows: "rows",
  columns: "columns",
  gap_x: "gapX",
  gap_y: "gapY",
  layout: "layout",
  offset: "offset",
  flip_rows: "flipRows",
  flip_columns: "flipColumns",
  angle: "angle",
  gap: "gap",
  side: "side",
};

function choice(name: string, value: string | undefined, allowed: readonly string[]): string | null {
  return value === undefined || allowed.includes(value) ? null : `repeat.${name} precisa ser um de: ${allowed.join(", ")}`;
}

function whole(name: string, value: number | undefined, least: number): string | null {
  return value === undefined || (Number.isInteger(value) && value >= least) ? null : `repeat.${name} é um número inteiro a partir de ${least}`;
}

function compact(repeat: Repeat): Repeat {
  return Object.fromEntries(Object.entries(repeat).filter(([, v]) => v !== undefined && v !== "" && v !== false)) as unknown as Repeat;
}

export function repeatOf(input: AgentRepeat, current: Repeat | undefined, box: RepeatBox): Patched<Repeat> {
  const mode = (input.mode ?? current?.mode) as RepeatMode | undefined;
  if (!mode || !(REPEAT_MODES as readonly string[]).includes(mode)) return { ok: false, reason: `repeat.mode precisa ser um de: ${REPEAT_MODES.join(", ")}` };
  const foreign = (Object.keys(input) as (keyof AgentRepeat)[]).find((key) => key !== "mode" && input[key] !== undefined && !FIELDS[mode].includes(key));
  if (foreign) return { ok: false, reason: `repeat.${foreign} não vale para mode ${mode}; campos de ${mode}: ${FIELDS[mode].join(", ")}` };
  const problem = firstProblem(
    whole("count", input.count, 2),
    whole("shown", input.shown, 1),
    whole("rows", input.rows, 1),
    whole("columns", input.columns, 1),
    outOfRange("repeat.radius", input.radius, REPEAT_RANGES.radius),
    outOfRange("repeat.start_angle", input.start_angle, REPEAT_RANGES.startAngle),
    outOfRange("repeat.sweep", input.sweep, REPEAT_RANGES.sweep),
    outOfRange("repeat.gap_x", input.gap_x, REPEAT_RANGES.gap),
    outOfRange("repeat.gap_y", input.gap_y, REPEAT_RANGES.gap),
    outOfRange("repeat.offset", input.offset, REPEAT_RANGES.offset),
    outOfRange("repeat.angle", input.angle, REPEAT_RANGES.angle),
    outOfRange("repeat.gap", input.gap, REPEAT_RANGES.gap),
    choice("direction", input.direction, REPEAT_DIRECTIONS),
    choice("layout", input.layout, REPEAT_LAYOUTS),
    choice("flip_rows", input.flip_rows, ["none", ...REPEAT_FLIPS]),
    choice("flip_columns", input.flip_columns, ["none", ...REPEAT_FLIPS]),
    choice("side", input.side, MIRROR_SIDES),
  );
  if (problem) return { ok: false, reason: problem };
  const base: Repeat = current && current.mode === mode ? current : defaultRepeat(mode, box);
  const merged: Repeat = { ...base, mode };
  for (const key of FIELDS[mode]) {
    const value = input[key];
    if (value === undefined) continue;
    Object.assign(merged, { [NAMES[key]]: value === "none" ? undefined : value });
  }
  if (mode === "grid" && input.layout !== undefined) merged.offset = input.layout === "grid" ? undefined : (input.offset ?? (merged.offset || 0.5));
  if (mode === "radial" && merged.sweep === 360) merged.sweep = undefined;
  if (mode === "radial" && merged.shown === merged.count) merged.shown = undefined;
  if (mode === "grid" && merged.layout === "grid") merged.layout = undefined;
  if (mode === "radial" && merged.direction === "cw") merged.direction = undefined;
  if (mode === "mirror" && merged.side === "end") merged.side = undefined;
  const repeat = compact(merged);
  const code = repeatIssue(repeat);
  if (!code) return { ok: true, value: repeat };
  if ((repeat.rows ?? 1) * (repeat.columns ?? 1) < 2 && mode === "grid") return { ok: false, reason: "repeat.rows vezes repeat.columns precisa dar pelo menos 2" };
  if ((repeat.shown ?? 0) > (repeat.count ?? 0)) return { ok: false, reason: "repeat.shown não pode passar de repeat.count" };
  return { ok: false, reason: "repeat.offset vale só para layout brick-row ou brick-column" };
}

export function agentRepeat(repeat: Repeat): AgentRepeat {
  const out: AgentRepeat = {};
  for (const [agent, field] of Object.entries(NAMES) as [keyof AgentRepeat, keyof Repeat][]) {
    const value = repeat[field];
    if (value !== undefined && value !== "" && value !== false) Object.assign(out, { [agent]: typeof value === "number" ? Math.round(value * 1000) / 1000 : value });
  }
  return out;
}
