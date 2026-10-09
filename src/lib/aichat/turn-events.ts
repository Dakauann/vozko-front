import type { MediaFrame } from "@/lib/media-generation/types";

import { finishTool, startTool, type Segment } from "./segments";
import type { ActionCard, ChatChart, ChatMedia, PendingAction, ToolSubject } from "./types";
import type { UIMessage } from "./ui-message";

export type TurnEvent =
  | { kind: "reasoning"; text: string }
  | { kind: "reasoning_done" }
  | { kind: "delta"; text: string }
  | { kind: "tool_start"; name: string; frame?: MediaFrame }
  | { kind: "tool"; name: string; summary: string; ok: boolean; subject?: ToolSubject }
  | { kind: "chart"; chart: ChatChart }
  | { kind: "card"; card: ActionCard }
  | { kind: "media"; media: ChatMedia }
  | { kind: "proposal"; action: PendingAction }
  | { kind: "finalize" };

type Streamed = "thinking" | "text";

function patchLastReply(messages: UIMessage[], patch: (m: UIMessage) => UIMessage): UIMessage[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "assistant") continue;
    const next = [...messages];
    next[i] = patch(messages[i]);
    return next;
  }
  return messages;
}

function streamInto(segs: Segment[], kind: Streamed, text: string): Segment[] {
  const last = segs[segs.length - 1];
  if (last && last.kind === kind && last.streaming) {
    return [...segs.slice(0, -1), { ...last, text: last.text + text }];
  }
  return [...segs, { kind, text, streaming: true }];
}

function settleStream(segs: Segment[], kind: Streamed): Segment[] {
  const last = segs[segs.length - 1];
  if (last && last.kind === kind && last.streaming) {
    return [...segs.slice(0, -1), { ...last, streaming: false }];
  }
  return segs;
}

function finalize(segs: Segment[]): Segment[] {
  return segs.map((s) => {
    if (s.kind === "thinking" || s.kind === "text") return { ...s, streaming: false };
    if (s.kind === "tool" && s.running) return { ...s, running: false };
    return s;
  });
}

function nextSegments(segs: Segment[], event: Exclude<TurnEvent, { kind: "proposal" }>): Segment[] {
  switch (event.kind) {
    case "reasoning":
      return streamInto(segs, "thinking", event.text);
    case "reasoning_done":
      return settleStream(segs, "thinking");
    case "delta":
      return streamInto(segs, "text", event.text);
    case "tool_start":
      return startTool(segs, event.name, event.frame);
    case "tool":
      return finishTool(segs, event.name, event.summary, event.ok, event.subject);
    case "chart":
      return [...segs, { kind: "chart", chart: event.chart }];
    case "card":
      return [...segs, { kind: "card", card: event.card, live: true }];
    case "media":
      return [...segs, { kind: "media", media: event.media }];
    case "finalize":
      return finalize(segs);
  }
}

export function applyTurnEvent(messages: UIMessage[], event: TurnEvent): UIMessage[] {
  if (event.kind === "proposal") {
    return patchLastReply(messages, (m) => ({ ...m, pending: event.action }));
  }
  return patchLastReply(messages, (m) => ({ ...m, segments: nextSegments(m.segments ?? [], event) }));
}
