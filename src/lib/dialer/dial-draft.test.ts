import { describe, expect, it } from "vitest";

import { EMPTY_DIAL_DRAFT, draftFromPreset, withDialNumber } from "@/lib/dialer/dial-draft";

describe("dial draft", () => {
  it("starts empty and without a lead", () => {
    expect(EMPTY_DIAL_DRAFT).toEqual({ number: "" });
  });

  it("takes the number and the lead from a preset", () => {
    expect(draftFromPreset({ phoneNumber: "5584999990000", leadId: "lead-1", trunkId: "t1" })).toEqual({
      number: "5584999990000",
      leadId: "lead-1",
    });
    expect(draftFromPreset({ phoneNumber: "100" })).toEqual({ number: "100" });
  });

  it("takes the lead revision with the lead, never without it", () => {
    expect(draftFromPreset({ phoneNumber: "100", leadId: "lead-1", leadRevision: 4 })).toEqual({
      number: "100",
      leadId: "lead-1",
      leadRevision: 4,
    });
    expect(draftFromPreset({ phoneNumber: "100", leadRevision: 4 })).toEqual({ number: "100" });
    expect(withDialNumber(draftFromPreset({ phoneNumber: "100", leadId: "lead-1", leadRevision: 4 }), "1001")).toEqual({ number: "1001" });
  });

  it("keeps the preset lead while the number is still the preset number", () => {
    const draft = draftFromPreset({ phoneNumber: "100", leadId: "lead-1" });
    expect(withDialNumber(draft, "100")).toEqual({ number: "100", leadId: "lead-1" });
  });

  it("drops the lead as soon as the number changes, even if it is typed back", () => {
    const edited = withDialNumber(draftFromPreset({ phoneNumber: "100", leadId: "lead-1" }), "1001");
    expect(edited).toEqual({ number: "1001" });
    expect(withDialNumber(edited, "100")).toEqual({ number: "100" });
  });
});
