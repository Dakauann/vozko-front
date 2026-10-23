import type { CodedRefusal } from "@/lib/api/coded-error";
import { CAMPAIGN_BLOCKERS, type CampaignBlocker } from "@/lib/carrier-messaging/campaigns";
import { oneOf } from "@/lib/carrier-messaging/parse";

export const CARRIER_ERROR_CODES = [
  "carrier_automation_incomplete",
  "carrier_channel_coming_soon",
  "carrier_channel_invalid",
  "carrier_inbox_refs_not_in_workspace",
  "carrier_contact_refused",
  "carrier_contact_suppressed",
  "carrier_conversation_not_found",
  "carrier_frequency_cap",
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
] as const;

export const CARRIER_CAMPAIGN_ERROR_CODES = [
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
] as const;

export type CarrierErrorCode = (typeof CARRIER_ERROR_CODES)[number] | (typeof CARRIER_CAMPAIGN_ERROR_CODES)[number];

const SHARED_CODES: readonly string[] = [...CARRIER_ERROR_CODES, ...CARRIER_CAMPAIGN_ERROR_CODES];

export const CARRIER_FALLBACK_CODE: CarrierErrorCode = "carrier_request_failed";

export type CarrierErrorNamespace = "carrierMessaging" | "rcs" | "sms";

export interface CarrierErrorTarget {
  namespace: CarrierErrorNamespace;
  key: string;
}

export function carrierErrorTarget(code: string | undefined, channelCodes: Record<"rcs" | "sms", readonly string[]>): CarrierErrorTarget {
  if (code?.startsWith("rcs_") && channelCodes.rcs.includes(code)) return { namespace: "rcs", key: `errors.${code}` };
  if (code?.startsWith("sms_") && channelCodes.sms.includes(code)) return { namespace: "sms", key: `errors.${code}` };
  if (code && SHARED_CODES.includes(code)) return { namespace: "carrierMessaging", key: `errors.${code}` };
  return { namespace: "carrierMessaging", key: `errors.${CARRIER_FALLBACK_CODE}` };
}

export type CarrierRefusalDetail =
  | { kind: "missing"; micros: number }
  | { kind: "nextOpen"; at: string }
  | { kind: "missingVariable"; slot: number; source?: string }
  | { kind: "notReady"; blocker: CampaignBlocker }
  | { kind: "audienceChanged"; expected: number; matched: number }
  | null;

export function carrierRefusalDetail(refusal: Pick<CodedRefusal, "code" | "details">): CarrierRefusalDetail {
  const details = refusal.details;
  const code = refusal.code;
  if ((code === "carrier_insufficient_balance" || code === "carrier_campaign_insufficient_balance") && typeof details?.missing_micros === "number" && details.missing_micros > 0) {
    return { kind: "missing", micros: details.missing_micros };
  }
  if ((code === "carrier_quiet_hours" || code === "carrier_campaign_quiet_hours") && typeof details?.next_open === "string" && details.next_open !== "") {
    return { kind: "nextOpen", at: details.next_open };
  }
  if (code === "carrier_campaign_missing_variable" && typeof details?.slot === "number" && details.slot > 0) {
    return typeof details.source === "string" && details.source !== "" ? { kind: "missingVariable", slot: details.slot, source: details.source } : { kind: "missingVariable", slot: details.slot };
  }
  if (code === "carrier_campaign_audience_changed" && typeof details?.expected === "number" && typeof details.matched === "number") {
    return { kind: "audienceChanged", expected: details.expected, matched: details.matched };
  }
  if (code === "carrier_campaign_not_ready" && oneOf(CAMPAIGN_BLOCKERS, details?.blocker)) {
    return { kind: "notReady", blocker: details.blocker };
  }
  return null;
}
