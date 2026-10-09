import { describe, expect, it } from "vitest";

import { readLeadSummary, sharedNumberOf, sharedNumberOfShown, type LeadDetailSummary } from "../detail-summary";

describe("readLeadSummary", () => {
  it("reads the counts and the other holders of each shared number", () => {
    const summary = readLeadSummary({
      dealsCount: 0,
      memoriesCount: 4,
      sharedNumbers: [
        {
          number: "551141990000",
          holders: [
            { leadId: "lead-2", name: "João Souza", number: "5511900023301" },
            { leadId: "lead-3" },
          ],
          more: true,
        },
      ],
    });

    expect(summary).toEqual({
      dealsCount: 0,
      memoriesCount: 4,
      sharedNumbers: [
        {
          number: "551141990000",
          holders: [{ leadId: "lead-2", name: "João Souza", number: "5511900023301" }, { leadId: "lead-3" }],
          more: true,
        },
      ],
    });
  });

  it("keeps the deal count absent when the viewer may not see deals", () => {
    const summary = readLeadSummary({ memoriesCount: 0, sharedNumbers: [] });
    expect(summary).not.toBeNull();
    expect(summary).not.toHaveProperty("dealsCount");
  });

  it("refuses an answer without the memory count or the shared numbers", () => {
    expect(readLeadSummary(null)).toBeNull();
    expect(readLeadSummary({ sharedNumbers: [] })).toBeNull();
    expect(readLeadSummary({ memoriesCount: 2 })).toBeNull();
    expect(readLeadSummary({ memoriesCount: -1, sharedNumbers: [] })).toBeNull();
    expect(readLeadSummary({ dealsCount: "3", memoriesCount: 2, sharedNumbers: [] })).toBeNull();
  });

  it("drops a holder without a lead id and a shared number without holders", () => {
    const summary = readLeadSummary({
      memoriesCount: 1,
      sharedNumbers: [
        { number: "551141990000", holders: [{ name: "Sem id" }, { leadId: "lead-2", name: "João" }], more: false },
        { number: "5511900010142", holders: [], more: false },
        { holders: [{ leadId: "lead-4" }], more: false },
      ],
    });
    expect(summary?.sharedNumbers).toEqual([{ number: "551141990000", holders: [{ leadId: "lead-2", name: "João" }], more: false }]);
  });
});

describe("sharedNumberOf", () => {
  const summary: LeadDetailSummary = {
    memoriesCount: 0,
    sharedNumbers: [{ number: "551141990000", holders: [{ leadId: "lead-2", name: "João" }], more: false }],
  };

  it("finds the holders of the exact stored number", () => {
    expect(sharedNumberOf(summary, "551141990000")?.holders).toEqual([{ leadId: "lead-2", name: "João" }]);
  });

  it("finds nothing for another number, an edited number or no summary", () => {
    expect(sharedNumberOf(summary, "5511900010142")).toBeUndefined();
    expect(sharedNumberOf(summary, "(11) 4199-0000")).toBeUndefined();
    expect(sharedNumberOf(undefined, "551141990000")).toBeUndefined();
    expect(sharedNumberOf(summary, "")).toBeUndefined();
  });
});

describe("sharedNumberOfShown", () => {
  const summary: LeadDetailSummary = {
    memoriesCount: 0,
    sharedNumbers: [{ number: "551141990000", holders: [{ leadId: "lead-2", name: "João" }], more: false }],
  };

  it("finds the holders while the field still shows the stored number", () => {
    expect(sharedNumberOfShown(summary, "551141990000", "+55 (11) 4199-0000")?.holders).toEqual([{ leadId: "lead-2", name: "João" }]);
    expect(sharedNumberOfShown(summary, "551141990000", " +55 (11) 4199-0000 ")?.holders).toHaveLength(1);
  });

  it("finds nothing once the field is edited, or for a number that was never stored", () => {
    expect(sharedNumberOfShown(summary, "551141990000", "+55 (11) 4199-0001")).toBeUndefined();
    expect(sharedNumberOfShown(summary, undefined, "+55 (11) 4199-0000")).toBeUndefined();
  });
});
