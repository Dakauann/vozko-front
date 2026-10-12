import type { MediaFrame } from "@/lib/media-generation/types";

import { takeBackStreamed, type Streamed as StreamedPart } from "./retract";
import { finishTool, startTool, type Segment } from "./segments";
import type { ActionCard, ChatChart, ChatMedia, PendingAction, ToolSubject } from "./types";
import type { UIMessage } from "./ui-message";

export type TurnEvent =
  | { kind: "reasoning"; text: string }
  | { kind: "reasoning_done" }
  | { kind: "delta"; text: string }
  | { kind: "retract"; text: string; reasoning: string }
  | { kind: "tool_start"; name: string; frame?: MediaFrame }
  | { kind: "tool"; name: string; summary: string; ok: boolean; subject?: ToolSubject }
  | { kind: "chart"; chart: ChatChart }
  | { kind: "card"; card: ActionCard }
  | { kind: "media"; media: ChatMedia }
  | { kind: "proposal"; action: PendingAction }
  | { kind: "delivered"; messages: UIMessage[] }
  | { kind: "finalize" };

type Streamed = "thinking" | "text";

function streamedPart(seg: Segment): StreamedPart<Segment> | null {
  if (seg.kind === "text") return { channel: "text", text: seg.text, withText: (text) => ({ ...seg, text }) };
  if (seg.kind === "thinking") return { channel: "reasoning", text: seg.text, withText: (text) => ({ ...seg, text }) };
  return null;
}

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

function isBlankReply(m: UIMessage | undefined): boolean {
  return !!m && m.role === "assistant" && !m.content && !m.pending && (m.segments ?? []).length === 0;
}

function deliver(messages: UIMessage[], arrived: UIMessage[]): UIMessage[] {
  const known = new Set(messages.flatMap((m) => [m.id, m.clientId].filter((key): key is string => !!key)));
  const fresh = arrived.filter((m) => !known.has(m.id) && !(m.clientId && known.has(m.clientId)));
  if (fresh.length === 0) return messages;
  const closed = patchLastReply(messages, (m) => ({ ...m, segments: finalize(m.segments ?? []) }));
  const kept = isBlankReply(closed[closed.length - 1]) ? closed.slice(0, -1) : closed;
  const last = fresh[fresh.length - 1];
  const reply: UIMessage = { id: `a-after-${last.id}`, role: "assistant", content: "", createdAt: last.createdAt, segments: [] };
  return [...kept, ...fresh, reply];
}

function nextSegments(segs: Segment[], event: Exclude<TurnEvent, { kind: "proposal" } | { kind: "delivered" }>): Segment[] {
  switch (event.kind) {
    case "reasoning":
      return streamInto(segs, "thinking", event.text);
    case "reasoning_done":
      return settleStream(segs, "thinking");
    case "delta":
      return streamInto(segs, "text", event.text);
    case "retract":
      return takeBackStreamed(segs, event, streamedPart);
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
  if (event.kind === "delivered") return deliver(messages, event.messages);
  return patchLastReply(messages, (m) => ({ ...m, segments: nextSegments(m.segments ?? [], event) }));
}
