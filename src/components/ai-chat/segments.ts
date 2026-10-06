import type { ActionCard, ChatChart, ChatMedia } from "@/lib/aichat/types";
import type { MediaFrame } from "@/lib/media-generation/types";

export type Segment =
  | { kind: "thinking"; text: string; streaming?: boolean }
  | { kind: "tool"; name: string; summary: string; ok: boolean; running?: boolean; frame?: MediaFrame }
  | { kind: "chart"; chart: ChatChart }
  | { kind: "card"; card: ActionCard; live?: boolean }
  | { kind: "media"; media: ChatMedia }
  | { kind: "text"; text: string; streaming?: boolean };

export function startTool(segs: Segment[], name: string, frame?: MediaFrame): Segment[] {
  return [...segs, { kind: "tool", name, summary: "", ok: true, running: true, ...(frame ? { frame } : {}) }];
}

export function finishTool(segs: Segment[], name: string, summary: string, ok: boolean): Segment[] {
  const index = segs.findIndex((s) => s.kind === "tool" && s.running && s.name === name);
  if (index < 0) return [...segs, { kind: "tool", name, summary, ok }];
  const started = segs[index];
  const frame = started.kind === "tool" ? started.frame : undefined;
  const settled: Segment = { kind: "tool", name, summary, ok, ...(frame ? { frame } : {}) };
  return segs.map((s, i) => (i === index ? settled : s));
}

export function isThinkingBetweenSteps(segs: Segment[]): boolean {
  if (segs.some((s) => s.kind === "tool" && s.running)) return false;
  const last = segs[segs.length - 1];
  if (!last) return true;
  if ((last.kind === "text" || last.kind === "thinking") && last.streaming) return false;
  return true;
}

export type Block = Exclude<Segment, { kind: "chart" }> | { kind: "charts"; charts: ChatChart[] };

export function layoutSegments(segs: Segment[]): Block[] {
  const blocks: Block[] = [];
  let tools: Block[] = [];
  let charts: ChatChart[] = [];

  const flush = () => {
    blocks.push(...tools);
    if (charts.length > 0) blocks.push({ kind: "charts", charts });
    tools = [];
    charts = [];
  };

  for (const seg of segs) {
    if (seg.kind === "chart") charts.push(seg.chart);
    else if (seg.kind === "tool") tools.push(seg);
    else {
      flush();
      blocks.push(seg);
    }
  }
  flush();
  return blocks;
}
