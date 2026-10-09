import { pendingFromStored } from "./proposal";
import type { Segment } from "./segments";
import type { ChatMessage, PendingAction } from "./types";

export type UIMessage = ChatMessage & {
  segments?: Segment[];
  pending?: PendingAction | null;
};

export function hydrate(m: ChatMessage): UIMessage {
  const pending = pendingFromStored(m.proposal);
  if (!m.reasoning && !(m.tools && m.tools.length > 0)) return { ...m, pending };
  const segments: Segment[] = [];
  if (m.reasoning) segments.push({ kind: "thinking", text: m.reasoning });
  for (const tool of m.tools ?? []) {
    segments.push({ kind: "tool", name: tool.name, summary: tool.summary, ok: tool.ok, ...(tool.subject ? { subject: tool.subject } : {}) });
    if (tool.chart) segments.push({ kind: "chart", chart: tool.chart });
    if (tool.card) segments.push({ kind: "card", card: tool.card });
    if (tool.image) segments.push({ kind: "media", media: tool.image });
  }
  if (m.content) segments.push({ kind: "text", text: m.content });
  return { ...m, segments, pending };
}
