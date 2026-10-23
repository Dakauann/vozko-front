import type { CampaignFunnel, Overview, RunFunnel } from "@/lib/carrier-messaging/analytics";
import type { Campaign, CampaignEstimate, CampaignSummary } from "@/lib/carrier-messaging/campaigns";
import type { CarrierSettings } from "@/lib/carrier-messaging/settings";
import type { CarrierChannelAutomation } from "@/lib/carrier-messaging/types";
import type { SmsRoute } from "@/lib/sms/types";

export function routeFixture(overrides: Partial<SmsRoute> = {}): SmsRoute {
  return {
    id: "rt-1",
    brand_prefix: "Padaria Sol",
    kind: "shared",
    number: "",
    status: "active",
    pause_reason: "",
    can_send: true,
    department_id: null,
    pipeline_id: null,
    automation: automationFixture(),
    created_at: "2026-10-20T12:00:00Z",
    ...overrides,
  };
}

export function summaryFixture(overrides: Partial<CampaignSummary> = {}): CampaignSummary {
  return {
    id: "cmp-1",
    name: "Pão quentinho de sexta",
    channel: "rcs",
    status: "running",
    kind: "marketing",
    sender_id: "snd-1",
    scheduled_at: null,
    recurrence: null,
    created_at: "2026-10-20T12:00:00Z",
    stats: { targeted: 1200, sent: 1180, delivered: 1100, read: 740, clicks: 120, replies: 45 },
    ...overrides,
  };
}

export function campaignFixture(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "cmp-1",
    name: "Pão quentinho de sexta",
    channel: "rcs",
    kind: "marketing",
    status: "draft",
    sender_id: "snd-1",
    variants: [{ name: "", content: { text: "Oi {{1}}, saiu pão agora!" }, bindings: [{ source: "lead.first_name" }] }],
    fallback: { sms: { route_id: "rt-1", text: "Saiu pao agora!", bindings: [] } },
    audience: { mode: "ids", ids: ["lead-1", "lead-2"] },
    scheduled_at: null,
    recurrence: null,
    ...overrides,
  };
}

export function estimateFixture(overrides: Partial<CampaignEstimate> = {}): CampaignEstimate {
  return {
    channel: "rcs",
    recipients: 1200,
    messages: 1200,
    worst_case_micros: 90_000_000,
    expected_micros: 72_000_000,
    per_recipient_micros: 60_000,
    shortfall_micros: 0,
    audience_fingerprint: "fp-1",
    ready: { sender: true, route: true },
    count: null,
    ...overrides,
  };
}

const RATES = { delivery: 0.93, read: 0.67, tap_through: 0.14, click_through: 0.11, reply: 0.04, opt_out: 0.004, fallback: 0.08, conversion: 0.02, cost_per_conversion_micros: 3_000_000 };

const TOTALS = {
  sent: 1180,
  delivered: 1100,
  read: 740,
  failed: 80,
  taps: 160,
  clicks: 120,
  replies: 45,
  opt_outs: 5,
  fell_back_whatsapp: 60,
  fell_back_sms: 34,
  conversions: 24,
  conversion_value_micros: 2_400_000_000,
  spend_micros: 72_000_000,
};

export function overviewFixture(): Overview {
  return {
    totals: { ...TOTALS },
    rates: { ...RATES },
    daily: [
      { day: "2026-10-19", channel: "rcs", sent: 400, delivered: 380, read: 250, failed: 20, spend_micros: 24_000_000 },
      { day: "2026-10-19", channel: "sms", sent: 120, delivered: 115, read: 0, failed: 5, spend_micros: 6_000_000 },
      { day: "2026-10-20", channel: "rcs", sent: 780, delivered: 720, read: 490, failed: 60, spend_micros: 42_000_000 },
    ],
    channels: [
      { channel: "rcs", spend_micros: 66_000_000, conversions: 20, cost_per_conversion_micros: 3_300_000 },
      { channel: "sms", spend_micros: 6_000_000, conversions: 4, cost_per_conversion_micros: 1_500_000 },
      { channel: "whatsapp", spend_micros: 0, conversions: 0, cost_per_conversion_micros: null },
    ],
    carriers: [
      { operator: "Vivo", sent: 500, delivered: 480, fell_back: 20, fallback_rate: 0.04 },
      { operator: "Claro", sent: 400, delivered: 350, fell_back: 50, fallback_rate: 0.125 },
    ],
  };
}

export function runFunnelFixture(): RunFunnel {
  return { ...TOTALS, targeted: 1250, skipped: 70, accepted: 1170, rejected: 10, expired: 6 };
}

export function campaignFunnelFixture(): CampaignFunnel {
  return { funnel: runFunnelFixture(), rates: { ...RATES } };
}

export function settingsFixture(): CarrierSettings {
  const window = [{ start: "08:00", end: "20:00" }];
  return {
    quiet_hours: { timezone: "America/Sao_Paulo", days: { sun: window, mon: window, tue: window, wed: window, thu: window, fri: window, sat: window } },
    frequency_cap: { per_day: 2, per_week: 6 },
    attribution_days: 7,
  };
}

export function automationFixture(): CarrierChannelAutomation {
  return {
    agent_id: null,
    workflow_id: null,
    enable_agent_responses: false,
    enable_workflow: false,
    enable_analysis: true,
    enable_auto_staging: false,
    enable_auto_memory: false,
    disclosure: "",
  };
}
