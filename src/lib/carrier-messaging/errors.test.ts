import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { CARRIER_CAMPAIGN_ERROR_CODES, CARRIER_ERROR_CODES, carrierErrorTarget, carrierRefusalDetail } from "@/lib/carrier-messaging/errors";
import { CAMPAIGN_BLOCKERS } from "@/lib/carrier-messaging/campaigns";
import { RCS_ERROR_CODES } from "@/lib/rcs/errors";
import { SMS_ERROR_CODES } from "@/lib/sms/errors";

const CATALOGS: Record<string, unknown> = { pt, en, es, de };
const DASHES = new RegExp("[\u2013\u2014]");
const CHANNEL_CODES = { rcs: RCS_ERROR_CODES, sms: SMS_ERROR_CODES };

const BACKEND_CODES = [
  "carrier_channel_coming_soon",
  "carrier_automation_incomplete",
  "carrier_channel_invalid",
  "carrier_contact_refused",
  "carrier_contact_suppressed",
  "carrier_conversation_not_found",
  "carrier_frequency_cap",
  "carrier_inbox_refs_not_in_workspace",
  "carrier_insufficient_balance",
  "carrier_message_not_found",
  "carrier_phone_invalid",
  "carrier_price_unavailable",
  "carrier_provider_refused",
  "carrier_provider_unavailable",
  "carrier_quiet_hours",
  "carrier_request_failed",
  "carrier_settings_invalid",
  "carrier_test_limit",
  "rcs_billing_category_fixed",
  "rcs_button_invalid",
  "rcs_card_empty",
  "rcs_card_text_too_long",
  "rcs_card_title_too_long",
  "rcs_cnpj_invalid",
  "rcs_contact_email_domain",
  "rcs_content_empty",
  "rcs_content_mixed",
  "rcs_description_not_isv",
  "rcs_gambling_authorization",
  "rcs_media_invalid",
  "rcs_media_not_found",
  "rcs_media_unreachable",
  "rcs_pause_not_yours",
  "rcs_pause_reason_invalid",
  "rcs_sector_refused",
  "rcs_sender_incomplete",
  "rcs_sender_not_found",
  "rcs_sender_not_launched",
  "rcs_sender_transition",
  "rcs_text_too_long",
  "rcs_too_many_buttons",
  "rcs_too_many_cards",
  "sms_no_shared_number",
  "sms_number_taken",
  "sms_route_invalid",
  "sms_route_not_found",
  "sms_route_paused",
  "sms_text_empty",
  "sms_text_too_long",
];

const BACKEND_CAMPAIGN_CODES = [
  "carrier_campaign_channel_coming_soon",
  "carrier_campaign_audience_changed",
  "carrier_campaign_audience_unconfirmed",
  "carrier_campaign_actor_required",
  "carrier_campaign_already_running",
  "carrier_campaign_already_stopped",
  "carrier_campaign_audience_empty",
  "carrier_campaign_audience_forbidden",
  "carrier_campaign_audience_invalid",
  "carrier_campaign_audience_required",
  "carrier_campaign_binding_field_unknown",
  "carrier_campaign_binding_literal_empty",
  "carrier_campaign_binding_sensitive",
  "carrier_campaign_binding_unknown",
  "carrier_campaign_bindings_mismatch",
  "carrier_campaign_channel_invalid",
  "carrier_campaign_contact_refused",
  "carrier_campaign_contact_suppressed",
  "carrier_campaign_content_invalid",
  "carrier_campaign_fallback_not_allowed",
  "carrier_campaign_finished",
  "carrier_campaign_frequency_cap",
  "carrier_campaign_insufficient_balance",
  "carrier_campaign_kind_invalid",
  "carrier_campaign_missing_variable",
  "carrier_campaign_name_required",
  "carrier_campaign_name_too_long",
  "carrier_campaign_not_draft",
  "carrier_campaign_not_editable",
  "carrier_campaign_not_found",
  "carrier_campaign_not_launched",
  "carrier_campaign_not_ready",
  "carrier_campaign_not_running",
  "carrier_campaign_not_scheduled",
  "carrier_campaign_only_draft_deletes",
  "carrier_campaign_overview_window",
  "carrier_campaign_phone_invalid",
  "carrier_campaign_price_unavailable",
  "carrier_campaign_provider_refused",
  "carrier_campaign_provider_unavailable",
  "carrier_campaign_query_invalid",
  "carrier_campaign_queue_unavailable",
  "carrier_campaign_quiet_hours",
  "carrier_campaign_ready_scheduled",
  "carrier_campaign_recipient_status_invalid",
  "carrier_campaign_recipients_invalid",
  "carrier_campaign_recurrence_day_of_month",
  "carrier_campaign_recurrence_ended",
  "carrier_campaign_recurrence_frequency",
  "carrier_campaign_recurrence_time",
  "carrier_campaign_recurrence_timezone",
  "carrier_campaign_recurrence_until_invalid",
  "carrier_campaign_recurrence_weekdays",
  "carrier_campaign_request_failed",
  "carrier_campaign_run_exists",
  "carrier_campaign_run_finished",
  "carrier_campaign_run_not_found",
  "carrier_campaign_schedule_in_past",
  "carrier_campaign_schedule_missing",
  "carrier_campaign_sender_required",
  "carrier_campaign_sms_route_required",
  "carrier_campaign_sms_text_empty",
  "carrier_campaign_sms_text_too_long",
  "carrier_campaign_status_invalid",
  "carrier_campaign_test_limit",
  "carrier_campaign_timeline_bucket_invalid",
  "carrier_campaign_too_many_variants",
  "carrier_campaign_variant_channel_mismatch",
  "carrier_campaign_variant_name_duplicate",
  "carrier_campaign_variant_name_required",
  "carrier_campaign_variant_unknown",
  "carrier_campaign_variants_required",
  "carrier_campaign_whatsapp_actor_required",
  "carrier_campaign_whatsapp_fallback_incomplete",
];

function at(catalog: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), catalog);
}

describe("carrier error codes", () => {
  it("cover exactly the refusal codes of vozko-back delivery/http/carriermessaging/errors.go", () => {
    expect([...CARRIER_ERROR_CODES, ...RCS_ERROR_CODES, ...SMS_ERROR_CODES].sort()).toEqual([...BACKEND_CODES].sort());
  });

  it("cover exactly the refusal codes of vozko-back delivery/http/carriercampaign/errors.go", () => {
    expect([...CARRIER_CAMPAIGN_ERROR_CODES].sort()).toEqual([...BACKEND_CAMPAIGN_CODES].sort());
  });

  it("keep every code in the namespace of its prefix", () => {
    expect(CARRIER_ERROR_CODES.every((code) => code.startsWith("carrier_"))).toBe(true);
    expect(RCS_ERROR_CODES.every((code) => code.startsWith("rcs_"))).toBe(true);
    expect(SMS_ERROR_CODES.every((code) => code.startsWith("sms_"))).toBe(true);
  });
});

describe("carrierErrorTarget", () => {
  it("routes each code to the namespace of its prefix, key verbatim", () => {
    expect(carrierErrorTarget("rcs_button_invalid", CHANNEL_CODES)).toEqual({ namespace: "rcs", key: "errors.rcs_button_invalid" });
    expect(carrierErrorTarget("sms_route_paused", CHANNEL_CODES)).toEqual({ namespace: "sms", key: "errors.sms_route_paused" });
    expect(carrierErrorTarget("carrier_quiet_hours", CHANNEL_CODES)).toEqual({ namespace: "carrierMessaging", key: "errors.carrier_quiet_hours" });
    expect(carrierErrorTarget("carrier_campaign_not_ready", CHANNEL_CODES)).toEqual({ namespace: "carrierMessaging", key: "errors.carrier_campaign_not_ready" });
  });

  it("falls back to the request failed copy", () => {
    expect(carrierErrorTarget(undefined, CHANNEL_CODES)).toEqual({ namespace: "carrierMessaging", key: "errors.carrier_request_failed" });
    expect(carrierErrorTarget("rcs_brand_new", CHANNEL_CODES)).toEqual({ namespace: "carrierMessaging", key: "errors.carrier_request_failed" });
  });
});

describe("carrierRefusalDetail", () => {
  it("reads the missing amount of a shortfall", () => {
    expect(carrierRefusalDetail({ code: "carrier_insufficient_balance", details: { missing_micros: 1500000 } })).toEqual({ kind: "missing", micros: 1500000 });
  });

  it("reads the next opening of the send hours", () => {
    expect(carrierRefusalDetail({ code: "carrier_quiet_hours", details: { next_open: "2026-10-22T11:00:00Z" } })).toEqual({ kind: "nextOpen", at: "2026-10-22T11:00:00Z" });
  });

  it("reads the campaign details the backend attaches", () => {
    expect(carrierRefusalDetail({ code: "carrier_campaign_insufficient_balance", details: { missing_micros: 10 } })).toEqual({ kind: "missing", micros: 10 });
    expect(carrierRefusalDetail({ code: "carrier_campaign_missing_variable", details: { slot: 2, source: "lead.city" } })).toEqual({ kind: "missingVariable", slot: 2, source: "lead.city" });
    expect(carrierRefusalDetail({ code: "carrier_campaign_not_ready", details: { blocker: "route_not_ready" } })).toEqual({ kind: "notReady", blocker: "route_not_ready" });
    expect(carrierRefusalDetail({ code: "carrier_campaign_not_ready", details: { blocker: "moon" } })).toBeNull();
    expect(carrierRefusalDetail({ code: "carrier_campaign_audience_changed", details: { expected: 300, matched: 310 } })).toEqual({ kind: "audienceChanged", expected: 300, matched: 310 });
  });

  it("ignores missing or foreign details", () => {
    expect(carrierRefusalDetail({ code: "carrier_quiet_hours" })).toBeNull();
    expect(carrierRefusalDetail({ code: "rcs_sender_incomplete", details: { field: "logo_url" } })).toBeNull();
  });
});

describe("carrier messaging error copy", () => {
  const keys = [
    ...CARRIER_ERROR_CODES.map((code) => `carrierMessaging.errors.${code}`),
    ...CARRIER_CAMPAIGN_ERROR_CODES.map((code) => `carrierMessaging.errors.${code}`),
    ...CAMPAIGN_BLOCKERS.map((blocker) => `carrierMessaging.errorDetails.blockers.${blocker}`),
    ...RCS_ERROR_CODES.map((code) => `rcs.errors.${code}`),
    ...SMS_ERROR_CODES.map((code) => `sms.errors.${code}`),
    "carrierMessaging.errorDetails.missing",
    "carrierMessaging.errorDetails.nextOpen",
    "carrierMessaging.errorDetails.audienceChanged",
  ];
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`translates every code in ${locale}`, () => {
      expect(keys.filter((key) => typeof at(catalog, key) !== "string")).toEqual([]);
    });

    it(`writes the error copy without dashes in ${locale}`, () => {
      expect(keys.filter((key) => DASHES.test(String(at(catalog, key))))).toEqual([]);
    });
  }
});
