import { describe, expect, it } from "vitest";

import { subscribeAnswered, subscribeSent, subscribesDropped } from "./subscribe-ledger";

const answerAt = (lead_version: number) => ({ entry_id: "e-1", lead_id: "lead-1", lead_version, lead_name: "Ana" });

describe("subscribe ledger", () => {
  it("counts every subscribe sent and folds the fields each re-read waits for", () => {
    const first = subscribeSent(undefined, { leadId: "lead-1", fields: ["blocked"] });
    const second = subscribeSent(first, { leadId: "lead-1", fields: ["name", "optedOut"] });

    expect(second).toEqual({ awaiting: 2, reread: { leadId: "lead-1", fields: ["blocked", "name", "optedOut"] } });
  });

  it("keeps the re-read when a plain subscribe joins it", () => {
    const reread = subscribeSent(undefined, { leadId: "lead-1", fields: ["blocked"] });

    expect(subscribeSent(reread)).toEqual({ awaiting: 2, reread: { leadId: "lead-1", fields: ["blocked"] } });
  });

  it("starts over when the re-read is about another lead", () => {
    const held = subscribeSent(undefined, { leadId: "lead-1", fields: ["blocked"] });

    expect(subscribeSent(held, { leadId: "lead-2", fields: ["name"] })).toEqual({
      awaiting: 2,
      reread: { leadId: "lead-2", fields: ["name"] },
    });
  });

  it("vouches every answer of overlapping re-reads, not only the first", () => {
    let pending = subscribeSent(undefined, { leadId: "lead-1", fields: ["blocked"] });
    pending = subscribeSent(pending, { leadId: "lead-1", fields: ["optedOut"] });

    const first = subscribeAnswered(pending, answerAt(5));
    expect(first.answer.lead_version).toBeUndefined();
    expect(first.pending).toEqual({ awaiting: 1, reread: { leadId: "lead-1", fields: ["blocked", "optedOut"] } });

    const second = subscribeAnswered(first.pending, answerAt(5));
    expect(second.answer.lead_version).toBeUndefined();
    expect(second.pending).toBeUndefined();
  });

  it("trusts an answer nobody re-read and settles the count", () => {
    const answer = answerAt(4);
    const settled = subscribeAnswered(subscribeSent(undefined), answer);

    expect(settled.answer).toBe(answer);
    expect(settled.pending).toBeUndefined();
    expect(subscribeAnswered(undefined, answer)).toEqual({ answer, pending: undefined });
  });

  it("keeps the fields a closed socket still owes for the answers after the reconnect", () => {
    const pending = subscribeSent(undefined, { leadId: "lead-1", fields: ["blocked"] });

    const dropped = subscribesDropped(pending);
    expect(dropped).toEqual({ awaiting: 0, reread: { leadId: "lead-1", fields: ["blocked"] } });

    const resent = subscribeSent(dropped);
    expect(subscribeAnswered(resent, answerAt(4)).answer.lead_version).toBeUndefined();
    expect(subscribesDropped(subscribeSent(undefined))).toBeUndefined();
  });
});
