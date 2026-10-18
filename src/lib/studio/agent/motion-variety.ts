import type { Clip, MotionEdge } from "../document";
import type { Easing, Keyframe } from "../keyframes";
import type { PerceptionFinding } from "./perception";

interface MotionVariety {
  line: string | null;
  findings: PerceptionFinding[];
}

type Axis = "horizontal" | "vertical";

interface Travel {
  axis: Axis;
  word: string;
}

interface ClipMotion {
  id: string;
  easings: Easing[];
  entrance: string[];
  travel: Travel[];
}

const ENTRANCE_MS = 1000;
const TRAVEL_MIN = 0.02;
const CONVERGENT_CLIPS = 3;
const LANE_FAMILIES = [
  ["x", "deslize"],
  ["y", "deslize"],
  ["scale", "escala"],
  ["rotation", "giro"],
  ["opacity", "fade"],
  ["blur", "foco"],
] as const;
const TRAVEL_WORDS: Record<Axis, [string, string]> = { horizontal: ["para a direita", "para a esquerda"], vertical: ["para baixo", "para cima"] };
const ENTER_FROM: Record<MotionEdge, Travel> = {
  left: { axis: "horizontal", word: "para a direita" },
  right: { axis: "horizontal", word: "para a esquerda" },
  top: { axis: "vertical", word: "para baixo" },
  bottom: { axis: "vertical", word: "para cima" },
};
const LEAVE_TO: Record<MotionEdge, Travel> = { left: ENTER_FROM.right, right: ENTER_FROM.left, top: ENTER_FROM.bottom, bottom: ENTER_FROM.top };

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function spoken(parts: readonly string[]): string {
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

function laneTravel(axis: Axis, keys: readonly Keyframe[]): Travel[] {
  const far = keys.reduce((best, key) => (Math.abs(key.value - keys[0].value) > Math.abs(best.value - keys[0].value) ? key : best), keys[0]);
  const delta = far.value - keys[0].value;
  if (Math.abs(delta) < TRAVEL_MIN) return [];
  return [{ axis, word: TRAVEL_WORDS[axis][delta > 0 ? 0 : 1] }];
}

function clipMotion(clip: Clip): ClipMotion | null {
  const lanes = LANE_FAMILIES.flatMap(([name, family]) => {
    const keys = clip.keyframes?.[name] ?? [];
    return keys.length >= 2 ? [{ name, family, keys }] : [];
  });
  const easings = [...lanes.flatMap(({ keys }) => keys.slice(0, -1).map((key) => key.easing)), ...[clip.transitionIn, clip.transitionOut, clip.textIn, clip.textOut].flatMap((part) => (part ? [part.easing] : []))];
  const entrance = [
    ...lanes.filter(({ keys }) => keys[0].atMs <= ENTRANCE_MS).map(({ family }) => family),
    ...(clip.motionIn ? ["deslize"] : []),
    ...(clip.transitionIn ? [`transição ${clip.transitionIn.kind}`] : []),
    ...(clip.textIn ? [`texto ${clip.textIn.style}`] : []),
    ...((clip.textAnimators?.length ?? 0) > 0 ? ["texto por unidade"] : []),
  ];
  const travel = [
    ...lanes.flatMap(({ name, keys }) => (name === "x" ? laneTravel("horizontal", keys) : name === "y" ? laneTravel("vertical", keys) : [])),
    ...(clip.motionIn ? [ENTER_FROM[clip.motionIn.edge]] : []),
    ...(clip.motionOut ? [LEAVE_TO[clip.motionOut.edge]] : []),
  ];
  if (easings.length === 0 && entrance.length === 0 && travel.length === 0) return null;
  return { id: clip.id, easings: unique(easings), entrance: unique(entrance), travel };
}

function convergence(motions: readonly ClipMotion[], easings: readonly Easing[], signatures: readonly string[], travel: readonly Travel[]): PerceptionFinding[] {
  if (motions.length < CONVERGENT_CLIPS) return [];
  const travellers = motions.filter((m) => m.travel.length > 0).length;
  const axes = unique(travel.map((t) => t.axis));
  const clauses = [
    ...(signatures.length === 1 && signatures[0] ? [`entram do mesmo jeito (${signatures[0]})`] : []),
    ...(easings.length === 1 ? [`usam um só easing (${easings[0]})`] : []),
    ...(travellers >= CONVERGENT_CLIPS && axes.length === 1 ? [`têm todo o trajeto no eixo ${axes[0]}`] : []),
  ];
  if (clauses.length === 0) return [];
  return [{ kind: "motion_variety", level: "aviso", ids: motions.map((m) => m.id), text: `os ${motions.length} clipes animados ${spoken(clauses)}; isso tende a ler como preset, pode ser intencional` }];
}

export function motionVariety(clips: readonly Clip[]): MotionVariety {
  const motions = clips.flatMap((clip) => clipMotion(clip) ?? []);
  if (motions.length === 0) return { line: null, findings: [] };
  const easings = unique(motions.flatMap((m) => m.easings));
  const signatures = unique(motions.map((m) => m.entrance.join(" + ")));
  const kinds = signatures.filter(Boolean);
  const travel = motions.flatMap((m) => m.travel);
  const words = unique(travel.map((t) => t.word));
  const line = [
    `variedade de movimento em ${plural(motions.length, "clipe animado", "clipes animados")}: ${plural(easings.length, "easing", "easings")}${easings.length > 0 ? ` (${easings.join(", ")})` : ""}`,
    `${plural(kinds.length, "tipo de entrada", "tipos de entrada")}${kinds.length > 0 ? ` (${kinds.join(", ")})` : ""}`,
    words.length > 0 ? `${plural(words.length, "direção de trajeto", "direções de trajeto")} (${words.join(", ")})` : "nenhum trajeto",
  ].join("; ");
  return { line, findings: convergence(motions, easings, signatures, travel) };
}
