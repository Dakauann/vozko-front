export type PerceptionLevel = "erro" | "aviso";

export type UnitPoint = [number, number];

export type PerceptionTone = "ok" | "bad";

export const PERCEPTION_INKS: Record<PerceptionTone, string> = { ok: "#22c55e", bad: "#ff2d55" };

export const PERCEPTION_AREA_ALPHA = 0.28;

export const PERCEPTION_LINE_SHARE = 1 / 250;

export const PERCEPTION_GUIDE_DASH: readonly [number, number] = [4, 3];

export const PERCEPTION_GUIDE_TICK = 4;

export type PerceptionShape =
  | { kind: "arrow"; from: UnitPoint; to: UnitPoint; tone: PerceptionTone }
  | { kind: "segment"; from: UnitPoint; to: UnitPoint; tone: PerceptionTone }
  | { kind: "guide"; from: UnitPoint; to: UnitPoint; tone: PerceptionTone }
  | { kind: "area"; points: UnitPoint[]; tone: PerceptionTone }
  | { kind: "ring"; at: UnitPoint; tone: PerceptionTone };

export interface PerceptionFinding {
  kind: string;
  level: PerceptionLevel;
  ids: string[];
  text: string;
}

export function guideTicks(from: UnitPoint, to: UnitPoint, length: number): [[UnitPoint, UnitPoint], [UnitPoint, UnitPoint]] {
  const span = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const nx = (-(to[1] - from[1]) / span) * length;
  const ny = ((to[0] - from[0]) / span) * length;
  const tick = ([x, y]: UnitPoint): [UnitPoint, UnitPoint] => [
    [x - nx, y - ny],
    [x + nx, y + ny],
  ];
  return [tick(from), tick(to)];
}

export function findingLines(findings: readonly PerceptionFinding[]): string[] {
  return [...findings.filter((f) => f.level === "erro"), ...findings.filter((f) => f.level === "aviso")].map((f) => `${f.level}: ${f.text}`);
}

const DIRECTIONS = ["para a direita", "para baixo e à direita", "para baixo", "para baixo e à esquerda", "para a esquerda", "para cima e à esquerda", "para cima", "para cima e à direita"];

export function directionWord(angle: number): string {
  const sector = Math.round((((angle % 360) + 360) % 360) / 45) % 8;
  return DIRECTIONS[sector];
}

export function rounded(value: number, digits = 0): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
