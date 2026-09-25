import type { ChatChart } from "@/lib/aichat/types";

export type Segment =
  | { kind: "thinking"; text: string; streaming?: boolean }
  | { kind: "tool"; name: string; summary: string; ok: boolean; running?: boolean }
  | { kind: "chart"; chart: ChatChart }
  | { kind: "text"; text: string; streaming?: boolean };

export function startTool(segs: Segment[], name: string): Segment[] {
  return [...segs, { kind: "tool", name, summary: "", ok: true, running: true }];
}

export function finishTool(segs: Segment[], name: string, summary: string, ok: boolean): Segment[] {
  const settled: Segment = { kind: "tool", name, summary, ok };
  const index = segs.findIndex((s) => s.kind === "tool" && s.running && s.name === name);
  if (index < 0) return [...segs, settled];
  return segs.map((s, i) => (i === index ? settled : s));
}

export function isThinkingBetweenSteps(segs: Segment[]): boolean {
  if (segs.some((s) => s.kind === "tool" && s.running)) return false;
  const last = segs[segs.length - 1];
  if (!last) return true;
  if ((last.kind === "text" || last.kind === "thinking") && last.streaming) return false;
  return true;
}
