import { describe, expect, it } from "vitest";

import { emptyCampaignDraft } from "@/lib/carrier-messaging/campaigns";
import { campaignFixture } from "@/lib/carrier-messaging/test-fixtures";

import {
  addVariant,
  audienceCount,
  draftOf,
  duplicateVariant,
  editorSteps,
  removeVariant,
  scheduleIncomplete,
  scheduleModeOf,
  withChannel,
  withoutSchedule,
  withScheduleMode,
} from "./editor-state";

describe("withChannel", () => {
  it("starts the message over when the channel changes", () => {
    const rcs = { ...emptyCampaignDraft("rcs"), name: "Black Friday", sender_id: "snd-1", fallback: { sms: { route_id: "rt-1", text: "Oi", bindings: [] } } };
    const sms = withChannel(rcs, "sms");
    expect(sms).toMatchObject({ name: "Black Friday", channel: "sms", sender_id: "", fallback: {} });
    expect(sms.variants).toEqual([{ name: "", text: "", bindings: [] }]);
  });

  it("keeps the draft when the channel stays", () => {
    const draft = emptyCampaignDraft("rcs");
    expect(withChannel(draft, "rcs")).toBe(draft);
  });
});

describe("variants", () => {
  it("names the variants by letter once an A/B test starts", () => {
    const two = addVariant(emptyCampaignDraft("sms"));
    expect(two.variants.map((variant) => variant.name)).toEqual(["A", "B"]);
    expect(two.variants[1]).toEqual({ name: "B", text: "", bindings: [] });
  });

  it("stops at four variants", () => {
    let draft = emptyCampaignDraft("rcs");
    for (let i = 0; i < 6; i += 1) draft = addVariant(draft);
    expect(draft.variants).toHaveLength(4);
  });

  it("duplicates a variant with a fresh name", () => {
    const draft = duplicateVariant(addVariant(emptyCampaignDraft("sms")), 0);
    expect(draft.variants.map((variant) => variant.name)).toEqual(["A", "C", "B"]);
  });

  it("removes a variant but never the last one", () => {
    const one = removeVariant(addVariant(emptyCampaignDraft("sms")), 0);
    expect(one.variants).toHaveLength(1);
    expect(removeVariant(one, 0).variants).toHaveLength(1);
  });
});

describe("schedule", () => {
  it("reads the schedule mode from the draft", () => {
    expect(scheduleModeOf(emptyCampaignDraft("rcs"))).toBe("now");
    expect(scheduleModeOf({ ...emptyCampaignDraft("rcs"), scheduled_at: "2026-11-01T12:00:00Z" })).toBe("once");
    expect(scheduleModeOf({ ...emptyCampaignDraft("rcs"), recurrence: { frequency: "daily", time: "09:00", timezone: "America/Sao_Paulo" } })).toBe("recurring");
  });

  it("switches modes cleanly", () => {
    const recurring = withScheduleMode(emptyCampaignDraft("rcs"), "recurring", "America/Sao_Paulo");
    expect(recurring.recurrence).toEqual({ frequency: "weekly", time: "09:00", weekdays: [1], timezone: "America/Sao_Paulo" });
    expect(recurring.scheduled_at).toBeNull();
    expect(withScheduleMode(recurring, "now", "UTC")).toMatchObject({ recurrence: null, scheduled_at: null });
  });

  it("clears both schedule fields for sending now or leaving ready", () => {
    const once = { ...emptyCampaignDraft("sms"), name: "Natal", scheduled_at: "2026-11-01T12:00:00Z" };
    expect(withoutSchedule(once)).toMatchObject({ name: "Natal", scheduled_at: null, recurrence: null });
  });

  it("knows when Agendar still misses its time", () => {
    const draft = emptyCampaignDraft("sms");
    expect(scheduleIncomplete(draft)).toBe(true);
    expect(scheduleIncomplete({ ...draft, scheduled_at: "2026-11-01T12:00:00Z" })).toBe(false);
    expect(scheduleIncomplete(withScheduleMode(draft, "recurring", "UTC"))).toBe(false);
  });
});

describe("audienceCount", () => {
  it("counts the audience the way the selection describes it", () => {
    expect(audienceCount(null)).toBeNull();
    expect(audienceCount({ mode: "ids", ids: ["a", "b"] })).toBe(2);
    expect(audienceCount({ mode: "first_n", limit: 500 })).toBe(500);
    expect(audienceCount({ mode: "all_matching", expectedCount: 1200 })).toBe(1200);
    expect(audienceCount({ mode: "all_matching" })).toBeNull();
  });
});

describe("editorSteps and draftOf", () => {
  it("offers the fallback step for RCS only", () => {
    expect(editorSteps("rcs")).toEqual(["channel", "message", "fallback", "audience", "review", "send"]);
    expect(editorSteps("sms")).toEqual(["channel", "message", "audience", "review", "send"]);
  });

  it("drops the identity fields of a saved campaign", () => {
    const draft = draftOf(campaignFixture());
    expect(draft).not.toHaveProperty("id");
    expect(draft).not.toHaveProperty("status");
    expect(draft.name).toBe(campaignFixture().name);
  });
});
