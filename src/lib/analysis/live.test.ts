import { describe, expect, it } from "vitest";

import type { Analysis } from "./types";
import { effectiveAnalysis, withLiveRead } from "./live";
import type { InboxEntry } from "@/lib/conversations/types";
import type { LiveRead } from "@/lib/live-decisions/types";

const ANALYSIS: Analysis = {
  id: "a1",
  entryId: "e1",
  entryType: "whatsapp",
  interest: "interested",
  productInterest: "consulta",
  disposition: "pending",
  sentiment: "positive",
  qualification: "hot_lead",
  nextAction: "continue",
  summary: "Cliente quer agendar.",
  attendanceQuality: 80,
  messageCount: 6,
  createdAt: "2026-09-28T12:00:00Z",
};

const READ: LiveRead = {
  interest: "not_interested",
  disposition: "declined",
  sentiment: "negative",
  qualification: "cold_lead",
  nextAction: "close",
  attendanceQuality: 36,
  decidedAt: "2026-09-28T12:10:00Z",
};

function entry(latest: Analysis | null, read: LiveRead | null): InboxEntry {
  return { entry_id: "e1", entry_type: "unofficial_whatsapp", latest_analysis: latest, live_read: read } as InboxEntry;
}

describe("effectiveAnalysis", () => {
  it("keeps the analysis when there is no newer read", () => {
    expect(effectiveAnalysis(entry(ANALYSIS, null))).toBe(ANALYSIS);
    expect(effectiveAnalysis(entry(ANALYSIS, { ...READ, decidedAt: "2026-09-28T11:00:00Z" }))).toBe(ANALYSIS);
  });

  it("updates the labels and quality from a newer read and keeps the summary", () => {
    const got = effectiveAnalysis(entry(ANALYSIS, READ));
    expect(got).toMatchObject({
      qualification: "cold_lead",
      interest: "not_interested",
      sentiment: "negative",
      disposition: "declined",
      nextAction: "close",
      attendanceQuality: 36,
      summary: "Cliente quer agendar.",
      productInterest: "consulta",
      messageCount: 6,
      createdAt: READ.decidedAt,
    });
  });

  it("shows the read alone before the first summary exists", () => {
    const got = effectiveAnalysis(entry(null, READ));
    expect(got).toMatchObject({ entryId: "e1", qualification: "cold_lead", attendanceQuality: 36, summary: "" });
  });

  it("ignores a read with unknown labels", () => {
    expect(effectiveAnalysis(entry(ANALYSIS, { ...READ, qualification: "lukewarm" }))).toBe(ANALYSIS);
    expect(effectiveAnalysis(entry(null, { attendanceQuality: 0, decidedAt: READ.decidedAt }))).toBeNull();
  });
});

describe("withLiveRead", () => {
  const subject = { entryId: "e1", entryType: "whatsapp" as const };

  it("is the same merge the inbox uses", () => {
    expect(withLiveRead(ANALYSIS, READ, subject)).toEqual(effectiveAnalysis(entry(ANALYSIS, READ)));
    expect(withLiveRead(ANALYSIS, null, subject)).toBe(ANALYSIS);
  });
});
