import { describe, expect, it } from "vitest";

import { parseButtonStats, parseCampaignFunnel, parseCampaignTimeline, parseOverview, parseRecipientPage, parseVariantStats } from "@/lib/carrier-messaging/analytics";
import {
  audienceAlreadyConfirmed,
  audienceNeedsConfirmation,
  confirmationOf,
  confirmedAudience,
  parseCampaign,
  parseCampaignEstimate,
  parseCampaignPage,
  parseRecurrence,
} from "@/lib/carrier-messaging/campaigns";
import { parseCarrierPrice } from "@/lib/carrier-messaging/parse";
import { parseCarrierMessage, parseCarrierSettings, parseSuppressionPage } from "@/lib/carrier-messaging/settings";
import {
  campaignFixture,
  campaignFunnelFixture,
  estimateFixture,
  overviewFixture,
  routeFixture,
  runFunnelFixture,
  settingsFixture,
  summaryFixture,
} from "@/lib/carrier-messaging/test-fixtures";
import { parseSmsRouteList } from "@/lib/sms/parse";

describe("parseCarrierPrice", () => {
  it("reads the shared price shape for the kinds of one channel", () => {
    const price = { charge_kind: "sms_segment", unit_micros: 9000, quantity: 2, total_micros: 18000 };
    expect(parseCarrierPrice(price, ["sms_segment", "sms_inbound"])).toEqual(price);
    expect(parseCarrierPrice(price, ["rcs_basic"])).toBeNull();
  });
});

describe("campaign parsers", () => {
  it("reads a campaign page", () => {
    expect(parseCampaignPage({ items: [summaryFixture()], total: 1 })).toEqual({ items: [summaryFixture()], total: 1 });
  });

  it("refuses a summary with an unknown status", () => {
    expect(parseCampaignPage({ items: [{ ...summaryFixture(), status: "archived" }], total: 1 })).toBeNull();
  });

  it("reads a campaign with variants, fallback and audience", () => {
    expect(parseCampaign(campaignFixture())).toEqual(campaignFixture());
  });

  it("reads a weekly recurrence with Go weekday numbers", () => {
    const recurrence = { frequency: "weekly", time: "09:30", weekdays: [1, 5], timezone: "America/Sao_Paulo", until: "2026-12-31" };
    expect(parseRecurrence(recurrence)).toEqual(recurrence);
    expect(parseRecurrence({ ...recurrence, weekdays: [7] })).toBeUndefined();
    expect(parseRecurrence(null)).toBeNull();
  });

  it("reads the carrier audience count that comes with the price", () => {
    const count = {
      channel: "carrier",
      source: "leads",
      matched: 1250,
      withContact: 1210,
      sendable: 1200,
      out: { no_phone: 40, opted_out: 10 },
      outTotal: 50,
      requiredVariables: 0,
      variables: [],
      blockers: [],
      selection: { selected: 1250, confirmCount: 1250, fingerprint: "fp-1" },
      list: null,
      metadataMissing: [],
    };
    expect(parseCampaignEstimate({ ...estimateFixture(), count })?.count).toEqual(count);
    expect(parseCampaignEstimate({ ...estimateFixture(), count: { ...count, matched: -1 } })).toBeNull();
  });

  it("reads an estimate and its readiness", () => {
    expect(parseCampaignEstimate(estimateFixture({ worst_case_segments: 2 }))).toEqual(estimateFixture({ worst_case_segments: 2 }));
    expect(parseCampaignEstimate({ ...estimateFixture(), ready: { sender: true } })).toBeNull();
  });
});

describe("audience confirmation", () => {
  const filtered = { mode: "all_matching" as const, filter: { groups: [] }, expectedCount: 300 };

  it("needs a count only for filtered audiences and the whole base", () => {
    expect(audienceNeedsConfirmation({ mode: "ids", ids: ["l1"] })).toBe(false);
    expect(audienceNeedsConfirmation(filtered)).toBe(true);
    expect(audienceNeedsConfirmation({ mode: "everyone" })).toBe(true);
    expect(audienceNeedsConfirmation(null)).toBe(false);
  });

  it("takes the count and fingerprint from the backend estimate, never without a fingerprint", () => {
    expect(confirmationOf({ recipients: 310, audience_fingerprint: "fp-f" })).toEqual({ count: 310, fingerprint: "fp-f" });
    expect(confirmationOf({ recipients: 310, audience_fingerprint: "" })).toBeNull();
    expect(confirmationOf({ recipients: 0, audience_fingerprint: "fp-f" })).toBeNull();
  });

  it("writes the confirmation onto the audience and knows when it is already saved", () => {
    const confirmed = confirmedAudience(filtered, { count: 310, fingerprint: "fp-f" });
    expect(confirmed).toEqual({ ...filtered, expectedCount: 310, fingerprint: "fp-f" });
    expect(audienceAlreadyConfirmed(confirmed, { count: 310, fingerprint: "fp-f" })).toBe(true);
    expect(audienceAlreadyConfirmed(filtered, { count: 300, fingerprint: "fp-f" })).toBe(false);
  });

  it("refuses an estimate without the audience fingerprint field", () => {
    const withoutFingerprint: Record<string, unknown> = { ...estimateFixture() };
    delete withoutFingerprint.audience_fingerprint;
    expect(parseCampaignEstimate(withoutFingerprint)).toBeNull();
  });
});

describe("analytics parsers", () => {
  it("reads the overview", () => {
    expect(parseOverview(overviewFixture())).toEqual(overviewFixture());
  });

  it("refuses a rate outside 0 to 1 and keeps missing rates as null", () => {
    expect(parseOverview({ ...overviewFixture(), rates: { ...overviewFixture().rates, delivery: 1.4 } })).toBeNull();
    const withoutConversion = { ...overviewFixture().rates } as Record<string, number | null>;
    delete withoutConversion.conversion;
    expect(parseOverview({ ...overviewFixture(), rates: withoutConversion })?.rates.conversion).toBeNull();
  });

  it("reads the campaign funnel, variants, buttons and timeline", () => {
    expect(parseCampaignFunnel(campaignFunnelFixture())).toEqual(campaignFunnelFixture());
    const variants = [{ variant: 0, name: "A", funnel: runFunnelFixture(), rates: campaignFunnelFixture().rates }];
    expect(parseVariantStats(variants)).toEqual(variants);
    const buttons = [
      { card: -1, index: 0, label: "Quero", kind: "reply", taps: 40, clicks: 0 },
      { card: 1, index: 0, label: "Ver site", kind: "open_url", taps: 30, clicks: 28 },
    ];
    expect(parseButtonStats(buttons)).toEqual(buttons);
    const timeline = { bucket: "hour", points: [{ at: "2026-10-20T12:00:00Z", sent: 10, delivered: 9, read: 5, failed: 1 }] };
    expect(parseCampaignTimeline(timeline)).toEqual(timeline);
  });

  it("reads recipients with blank optional fields", () => {
    const page = { items: [{ phone: "+5511999990000", lead_id: "", lead_name: "", variant: 0, status: "skipped", skip_reason: "frequency_cap", message_status: "", updated_at: "2026-10-20T12:00:00Z" }], total: 1 };
    expect(parseRecipientPage(page)).toEqual(page);
  });
});

describe("settings, suppressions, messages and routes", () => {
  it("reads the sending rules", () => {
    expect(parseCarrierSettings(settingsFixture())).toEqual(settingsFixture());
    expect(parseCarrierSettings({ ...settingsFixture(), quiet_hours: { timezone: "UTC", days: { funday: [] } } })).toBeNull();
  });

  it("reads a suppression page", () => {
    const page = { items: [{ phone: "+5511999990000", source: "keyword", created_at: "2026-10-20T12:00:00Z" }], total: 1 };
    expect(parseSuppressionPage(page)).toEqual(page);
  });

  it("reads a test send message", () => {
    const message = { id: "msg-1", channel: "sms", reference: "abc", status: "accepted", error_code: "", segments: 1 };
    expect(parseCarrierMessage(message)).toEqual(message);
  });

  it("reads the SMS routes", () => {
    expect(parseSmsRouteList({ routes: [routeFixture(), routeFixture({ id: "rt-2", kind: "dedicated", number: "29090", workspace_id: "ws-1" })] })?.routes).toHaveLength(2);
    expect(parseSmsRouteList({ routes: [{ ...routeFixture(), can_send: "yes" }] })).toBeNull();
  });
});
