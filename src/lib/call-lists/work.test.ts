import { describe, expect, it } from "vitest";

import {
  closeBlocker,
  dialItem,
  followItemCall,
  heldItem,
  listDialBlocker,
  reservationLive,
  restorePlan,
  trackItemCall,
  workStage,
  type ItemDial,
} from "./work";
import type { CallListItem } from "./types";

const NOW = new Date("2026-10-08T12:00:00Z");

function item(overrides: Partial<CallListItem> = {}): CallListItem {
  return {
    id: "i1",
    listId: "l1",
    leadId: "lead-1",
    phone: "5511987654321",
    position: 1,
    state: "reserved",
    reservedBy: "u1",
    reservedUntil: "2026-10-08T12:10:00Z",
    closable: false,
    createdAt: "2026-10-07T12:00:00Z",
    updatedAt: "2026-10-08T11:55:00Z",
    ...overrides,
  };
}

function dialed(target: CallListItem = item(), requestId = "r1"): ItemDial {
  return dialItem(target, requestId);
}

function through(dial: ItemDial, ...calls: Parameters<typeof followItemCall>[1][]): ItemDial {
  return calls.reduce<ItemDial>((current, call) => followItemCall(current, call, null), dial);
}

const ringing = { status: "ringing" as const, requestId: "r1" };
const answered = { status: "answered" as const, requestId: "r1", callId: "call-1" };
const completed = { status: "ended" as const, requestId: "r1", callId: "call-1", reason: "completed", durationSeconds: 134 };

describe("dialItem", () => {
  it("remembers only the item and the request it placed", () => {
    expect(dialItem(item({ lastCallId: "old", closable: true }), "r1")).toEqual({ itemId: "i1", requestId: "r1", track: { seen: null, ended: null } });
  });
});

describe("followItemCall", () => {
  it("follows only the call the dial requested, whatever number the server echoes", () => {
    const dial = dialed();
    expect(followItemCall(dial, { status: "ringing", requestId: "other" }, null)).toBe(dial);
    expect(followItemCall(dial, { status: "ringing" }, null)).toBe(dial);
    expect(followItemCall(dial, ringing, null).track.seen).toEqual({ status: "ringing" });
  });

  it("answers the same dial while nothing changed", () => {
    const live = followItemCall(dialed(), answered, null);
    expect(followItemCall(live, answered, null)).toBe(live);
  });
});

describe("workStage", () => {
  it("is idle without an item and ready for an item the server does not let the member close", () => {
    expect(workStage({ item: null, dial: null })).toBe("idle");
    expect(workStage({ item: item(), dial: null })).toBe("ready");
    expect(workStage({ item: item({ lastCallId: "old", disposition: "_callback" }), dial: null })).toBe("ready");
  });

  it("is ended for an item the server lets the member close, after a reload too", () => {
    expect(workStage({ item: item({ lastCallId: "rec-me", closable: true }), dial: null })).toBe("ended");
  });

  it("is calling while the requested call is live, and ended after it", () => {
    expect(workStage({ item: item(), dial: through(dialed(), ringing) })).toBe("calling");
    expect(workStage({ item: item(), dial: through(dialed(), ringing, answered) })).toBe("calling");
    expect(workStage({ item: item(), dial: through(dialed(), ringing, answered, completed) })).toBe("ended");
    expect(workStage({ item: item(), dial: through(dialed(), ringing, answered, completed, null) })).toBe("ended");
  });

  it("tells a dropped connection apart from a call that never started", () => {
    expect(workStage({ item: item(), dial: through(dialed(), ringing, answered, { ...completed, reason: "connection_lost" }) })).toBe("lost");
    expect(workStage({ item: item(), dial: through(dialed(), ringing, null) })).toBe("notStarted");
  });

  it("ignores a dial made for another item", () => {
    expect(workStage({ item: item({ id: "i2" }), dial: through(dialed(), ringing) })).toBe("ready");
  });
});

describe("closeBlocker", () => {
  const base = { disposition: "interessado", callbackAt: "", anyLive: false };

  it("asks for a call first while the server does not let the member close the item", () => {
    expect(closeBlocker({ ...base, item: item() })).toBe("notCalled");
    expect(closeBlocker({ ...base, item: item({ lastCallId: "old", disposition: "_callback" }) })).toBe("notCalled");
  });

  it("waits while any call is live, even one that is not the item's", () => {
    expect(closeBlocker({ ...base, item: item({ closable: true }), anyLive: true })).toBe("callLive");
    expect(closeBlocker({ ...base, item: item(), anyLive: true })).toBe("callLive");
  });

  it("needs an outcome, and a time for a callback", () => {
    const closable = item({ closable: true });
    expect(closeBlocker({ ...base, item: closable, disposition: "" })).toBe("noOutcome");
    expect(closeBlocker({ ...base, item: closable, disposition: "_callback" })).toBe("callbackTime");
    expect(closeBlocker({ ...base, item: closable, disposition: "_callback", callbackAt: "2026-10-09T15:00" })).toBeNull();
    expect(closeBlocker({ ...base, item: closable })).toBeNull();
  });

  it("has nothing to close without an item", () => {
    expect(closeBlocker({ ...base, item: null })).toBe("notCalled");
  });
});

describe("restorePlan", () => {
  const live = item({ reservedBy: "u1" });
  const expired = item({ reservedBy: "u1", reservedUntil: "2026-10-08T11:00:00Z" });

  it("asks the queue again for a live hold while the list serves", () => {
    expect(restorePlan({ held: live, userId: "u1", now: NOW, serving: true })).toBe("next");
  });

  it("shows a live hold as it is while the list is paused", () => {
    expect(restorePlan({ held: live, userId: "u1", now: NOW, serving: false })).toBe("card");
  });

  it("shows an expired hold only when the server still lets the member close it", () => {
    expect(restorePlan({ held: { ...expired, closable: true }, userId: "u1", now: NOW, serving: true })).toBe("card");
    expect(restorePlan({ held: expired, userId: "u1", now: NOW, serving: true })).toBe("none");
    expect(restorePlan({ held: null, userId: "u1", now: NOW, serving: true })).toBe("none");
  });
});

describe("listDialBlocker", () => {
  const trunk = { id: "t1", name: "Matriz" };

  it("puts the call service first, then the server's line refusal", () => {
    expect(listDialBlocker({ readiness: "noPermission", trunks: [trunk], trunkRefusal: undefined, trunk })).toBe("noPermission");
    expect(listDialBlocker({ readiness: null, trunks: [], trunkRefusal: "unauthorized", trunk: null })).toBe("unauthorized");
    expect(listDialBlocker({ readiness: null, trunks: [], trunkRefusal: undefined, trunk: null })).toBe("no_dialable_trunk");
  });

  it("lets a ready line through", () => {
    expect(listDialBlocker({ readiness: null, trunks: [trunk], trunkRefusal: undefined, trunk })).toBeNull();
  });
});

describe("reservations", () => {
  it("is live only for its holder before it expires", () => {
    expect(reservationLive(item(), "u1", NOW)).toBe(true);
    expect(reservationLive(item(), "u2", NOW)).toBe(false);
    expect(reservationLive(item({ reservedUntil: "2026-10-08T11:59:59Z" }), "u1", NOW)).toBe(false);
    expect(reservationLive(item({ state: "pending" }), "u1", NOW)).toBe(false);
  });

  it("finds the item a member holds among the reserved ones", () => {
    const mine = item({ id: "mine" });
    expect(heldItem([item({ id: "other", reservedBy: "u2" }), mine], "u1")).toBe(mine);
    expect(heldItem([item({ id: "other", reservedBy: "u2" })], "u1")).toBeNull();
    expect(heldItem([mine], "")).toBeNull();
  });
});

describe("trackItemCall", () => {
  const idle = { seen: null, ended: null };

  it("follows the item's call from ringing to its end", () => {
    const ring = trackItemCall(idle, { status: "ringing" }, null);
    expect(ring).toEqual({ seen: { status: "ringing" }, ended: null });
    const answer = trackItemCall(ring, { status: "answered", callId: "call-1" }, null);
    expect(answer.ended).toBeNull();
    const ended = trackItemCall(answer, { status: "ended", callId: "call-1", reason: "completed", durationSeconds: 134 }, null);
    expect(ended.ended).toEqual({ callId: "call-1", reason: "completed", durationSeconds: 134 });
  });

  it("keeps the end once the call session clears the call", () => {
    const ended = { seen: { status: "ended" as const, callId: "call-1", reason: "completed" }, ended: { callId: "call-1", reason: "completed" } };
    expect(trackItemCall(ended, null, null)).toEqual({ seen: null, ended: { callId: "call-1", reason: "completed" } });
  });

  it("reads a call the server refused before it started as never started, with the refusal", () => {
    const ring = trackItemCall(idle, { status: "ringing" }, null);
    expect(trackItemCall(ring, null, "call_list_item_unavailable")).toEqual({ seen: null, ended: { reason: "call_list_item_unavailable" } });
    expect(trackItemCall(ring, null, null).ended).toEqual({ reason: "dial_failed" });
  });

  it("reads a started call that left the session without its end as ended, with no invented reason", () => {
    const answer = trackItemCall(idle, { status: "answered", callId: "call-1" }, null);
    expect(trackItemCall(answer, null, null).ended).toEqual({ callId: "call-1" });
  });

  it("forgets the last end when a new call starts", () => {
    const ended = { seen: null, ended: { callId: "call-1", reason: "completed" } };
    expect(trackItemCall(ended, { status: "ringing" }, null)).toEqual({ seen: { status: "ringing" }, ended: null });
  });

  it("answers the same track when nothing changed, so a render can tell", () => {
    const ring = trackItemCall(idle, { status: "ringing" }, null);
    expect(trackItemCall(ring, { status: "ringing" }, null)).toBe(ring);
    expect(trackItemCall(idle, null, null)).toBe(idle);
  });
});
