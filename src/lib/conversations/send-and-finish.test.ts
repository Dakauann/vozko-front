import { describe, expect, it } from "vitest";

import type { Outbox, OutboxItem } from "./outbox";
import { finishDecision, watchFinish } from "./send-and-finish";

function item(requestId: string, state: OutboxItem["state"] = "pending", entryId = "e1", kind: "text" | "resend" = "text"): OutboxItem {
  return {
    requestId,
    entryId,
    entryType: "whatsapp",
    payload: kind === "text" ? { kind: "text", text: "oi", signed: false } : { kind: "resend", messageId: "m1" },
    state,
    queuedAt: "2026-10-18T12:00:00Z",
  };
}

describe("watchFinish", () => {
  it("watches every send still on its way for that conversation", () => {
    const outbox: Outbox = [item("r1"), item("r2", "failed"), item("r3", "pending", "e2"), item("r4", "pending", "e1", "resend")];
    expect(watchFinish(outbox, "e1", "whatsapp")).toEqual({ entryId: "e1", entryType: "whatsapp", requestIds: ["r1"] });
  });
});

describe("finishDecision", () => {
  const watch = { entryId: "e1", entryType: "whatsapp" as const, requestIds: ["r1", "r2"] };

  it("waits while a watched send is still pending", () => {
    expect(finishDecision([item("r1"), item("r9")], watch)).toBe("wait");
  });

  it("finishes once every watched send was accepted by the server", () => {
    expect(finishDecision([item("r9")], watch)).toBe("finish");
  });

  it("finishes nothing when a watched send failed", () => {
    expect(finishDecision([item("r1", "failed")], watch)).toBe("abandon");
    expect(finishDecision([item("r2", "failed"), item("r1")], watch)).toBe("abandon");
  });

  it("finishes nothing when no send was ever queued", () => {
    expect(finishDecision([], { ...watch, requestIds: [] })).toBe("abandon");
  });
});
