import { describe, expect, it } from "vitest";

import { applyTurnEvent, type TurnEvent } from "./turn-events";
import type { ActionCard, ChatChart, ChatMedia, PendingAction } from "./types";
import type { UIMessage } from "./ui-message";

const user: UIMessage = { id: "u1", role: "user", content: "faz o card", createdAt: "2026-10-08T12:00:00Z" };
const reply: UIMessage = { id: "a1", role: "assistant", content: "", createdAt: "2026-10-08T12:00:01Z", segments: [] };

function play(events: TurnEvent[], start: UIMessage[] = [user, reply]): UIMessage[] {
  return events.reduce(applyTurnEvent, start);
}

function segmentsOf(messages: UIMessage[]) {
  return messages[messages.length - 1].segments;
}

describe("applyTurnEvent", () => {
  it("joins streamed text and reasoning into one live segment each", () => {
    const out = play([
      { kind: "reasoning", text: "pen" },
      { kind: "reasoning", text: "sando" },
      { kind: "reasoning_done" },
      { kind: "delta", text: "Ol" },
      { kind: "delta", text: "á" },
    ]);
    expect(segmentsOf(out)).toEqual([
      { kind: "thinking", text: "pensando", streaming: false },
      { kind: "text", text: "Olá", streaming: true },
    ]);
  });

  it("starts a new text segment after a tool step", () => {
    const out = play([
      { kind: "delta", text: "Vou ler" },
      { kind: "tool_start", name: "studio_read" },
      { kind: "tool", name: "studio_read", summary: "ok", ok: true },
      { kind: "delta", text: "Pronto" },
    ]);
    expect(segmentsOf(out)).toEqual([
      { kind: "text", text: "Vou ler", streaming: true },
      { kind: "tool", name: "studio_read", summary: "ok", ok: true },
      { kind: "text", text: "Pronto", streaming: true },
    ]);
  });

  it("keeps the frame a running media tool started with", () => {
    const out = play([
      { kind: "tool_start", name: "generate_image", frame: "story" },
      { kind: "tool", name: "generate_image", summary: "ok", ok: true },
    ]);
    expect(segmentsOf(out)).toEqual([{ kind: "tool", name: "generate_image", summary: "ok", ok: true, frame: "story" }]);
  });

  it("appends charts, live cards and media in order", () => {
    const chart = { type: "bar", title: "Vendas" } as unknown as ChatChart;
    const card = { kind: "navigation" } as unknown as ActionCard;
    const media = { kind: "image", url: "https://cdn/x.png" } as unknown as ChatMedia;
    const out = play([
      { kind: "chart", chart },
      { kind: "card", card },
      { kind: "media", media },
    ]);
    expect(segmentsOf(out)).toEqual([
      { kind: "chart", chart },
      { kind: "card", card, live: true },
      { kind: "media", media },
    ]);
  });

  it("puts a proposal on the reply that made it", () => {
    const action: PendingAction = { id: "act-1", toolName: "create_label", summary: "Criar etiqueta" };
    const out = play([{ kind: "proposal", action }]);
    expect(out[1].pending).toEqual(action);
    expect(out[0]).toBe(user);
  });

  it("finalizing stops every live segment and running tool", () => {
    const out = play([
      { kind: "reasoning", text: "a" },
      { kind: "tool_start", name: "studio_edit_image" },
      { kind: "delta", text: "b" },
      { kind: "finalize" },
    ]);
    expect(segmentsOf(out)).toEqual([
      { kind: "thinking", text: "a", streaming: false },
      { kind: "tool", name: "studio_edit_image", summary: "", ok: true, running: false },
      { kind: "text", text: "b", streaming: false },
    ]);
  });

  it("patches the latest reply only", () => {
    const older: UIMessage = { id: "a0", role: "assistant", content: "antes", createdAt: "2026-10-08T11:00:00Z" };
    const out = play([{ kind: "delta", text: "novo" }], [older, user, reply]);
    expect(out[0]).toBe(older);
    expect(segmentsOf(out)).toEqual([{ kind: "text", text: "novo", streaming: true }]);
  });

  it("leaves a conversation with no reply untouched", () => {
    const start = [user];
    expect(play([{ kind: "delta", text: "x" }], start)).toEqual(start);
  });
});
