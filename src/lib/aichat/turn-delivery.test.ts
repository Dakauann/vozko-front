import { describe, expect, it } from "vitest";

import { applyTurnEvent } from "./turn-events";
import type { UIMessage } from "./ui-message";

const user: UIMessage = { id: "u1", role: "user", content: "monte o anúncio", createdAt: "2026-10-10T12:00:00Z" };
const working: UIMessage = {
  id: "a1",
  role: "assistant",
  content: "",
  createdAt: "2026-10-10T12:00:01Z",
  segments: [
    { kind: "text", text: "Vou olhar", streaming: true },
    { kind: "tool", name: "studio_read", summary: "", ok: true, running: true },
  ],
};
const delivered: UIMessage = { id: "m9", clientId: "c1", role: "user", content: "use o azul", createdAt: "2026-10-10T12:00:05Z" };

describe("a delivered queued message", () => {
  it("closes the reply so far, joins the conversation and opens the next reply", () => {
    const out = applyTurnEvent([user, working], { kind: "delivered", messages: [delivered] });
    expect(out.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(out[1].segments).toEqual([
      { kind: "text", text: "Vou olhar", streaming: false },
      { kind: "tool", name: "studio_read", summary: "", ok: true, running: false },
    ]);
    expect(out[2]).toEqual(delivered);
    expect(out[3]).toMatchObject({ role: "assistant", content: "", segments: [] });
    const next = applyTurnEvent(out, { kind: "delta", text: "Pronto, azul." });
    expect(next[3].segments).toEqual([{ kind: "text", text: "Pronto, azul.", streaming: true }]);
    expect(next[1].segments?.[0]).toEqual({ kind: "text", text: "Vou olhar", streaming: false });
  });

  it("replaces an empty reply instead of leaving a blank bubble behind", () => {
    const empty: UIMessage = { id: "a2", role: "assistant", content: "", createdAt: "2026-10-10T12:00:02Z", segments: [] };
    const out = applyTurnEvent([user, empty], { kind: "delivered", messages: [delivered] });
    expect(out.map((m) => m.id)).toEqual(["u1", "m9", expect.stringContaining("m9")]);
  });

  it("changes nothing when the message is already in the conversation", () => {
    const moved: UIMessage = { ...delivered, id: "q-c1" };
    const reply: UIMessage = { id: "a3", role: "assistant", content: "", createdAt: "2026-10-10T12:00:06Z", segments: [] };
    const start = [user, moved, reply];
    expect(applyTurnEvent(start, { kind: "delivered", messages: [delivered] })).toBe(start);
  });
});
