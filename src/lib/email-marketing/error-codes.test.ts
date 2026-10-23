import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

const EMAIL_SENDING_CODES = [
  "email_provider_unavailable",
  "email_reply_capacity_reached",
  "email_account_not_provisioned",
  "email_account_paused",
  "email_account_reactivation_failed",
  "email_account_not_in_probation",
  "email_setup_invalid",
  "email_domain_invalid",
  "email_domain_free_mailbox",
  "email_domain_shared",
  "email_domain_taken",
  "email_domain_not_found",
  "email_domain_not_verified",
  "email_domain_releasing",
  "email_domain_shared_removal",
  "email_domain_in_use",
  "email_sender_invalid_local_part",
  "email_sender_invalid_display_name",
  "email_sender_invalid_forward",
  "email_sender_not_found",
  "email_sender_exists",
  "email_sender_domain_mismatch",
  "email_sender_default_required",
  "email_address_invalid",
  "email_suppression_not_found",
  "email_suppression_locked",
  "email_recipient_suppressed",
  "email_daily_cap_reached",
  "email_message_invalid",
  "email_message_not_found",
  "email_request_failed",
  "email_subdomain_invalid",
  "email_subdomain_reserved",
  "email_subdomain_taken",
  "email_subdomain_locked",
  "email_plan_required",
  "email_plan_unavailable",
];

const EMAIL_PRICING_CODES = ["email_exchange_rate_unavailable", "email_pricing_unavailable", "email_pricing_failed"];

const EMAIL_OVERVIEW_CODES = ["email_overview_days_invalid"];

const EMAIL_OUTREACH_CODES = [
  "email_request_invalid",
  "email_idempotency_key_required",
  "email_recipient_missing",
  "email_address_invalid",
  "email_lead_not_found",
  "email_lead_no_email",
  "email_lead_blocked",
  "email_lead_opted_out",
  "email_recipient_suppressed",
  "email_sender_missing",
  "email_sender_not_verified",
  "email_account_paused",
  "email_account_reactivation_failed",
  "email_daily_cap_reached",
  "email_balance_insufficient",
  "email_charge_failed",
  "email_message_invalid",
  "email_subject_invalid",
  "email_design_not_found",
  "email_send_in_progress",
  "email_send_throttled",
  "email_send_failed",
  "email_unavailable",
  "email_outreach_forbidden",
  "email_domain_checking",
  "email_domain_unknown",
  "email_disposable_address",
  "email_no_mail_domain",
];

const EMAIL_API_CODES = [
  "email_idempotency_key_invalid",
  "email_idempotency_key_reused",
  "email_from_required",
  "email_sender_unknown",
  "email_recipients_invalid",
  "email_reply_to_invalid",
  "email_header_not_allowed",
  "email_tags_invalid",
  "email_attachment_invalid",
  "email_attachment_unavailable",
  "email_message_not_found",
  "email_log_cursor_invalid",
  "email_log_filter_invalid",
  "email_log_failed",
  "email_webhook_url_invalid",
  "email_webhook_url_blocked",
  "email_webhook_events_invalid",
  "email_webhook_not_found",
  "email_webhook_limit_reached",
  "email_webhook_delivery_not_found",
  "email_webhook_delivery_not_retryable",
  "email_webhook_failed",
];

const EMAIL_HYGIENE_CODES = ["email_address_invalid", "email_address_status_unavailable"];

const HYGIENE_GOLDEN = resolve(__dirname, "../../../../vozko-back/delivery/http/emailhygiene/testdata/error_codes.golden");

const CATALOGS = { pt, en, es, de } as const;

describe("email marketing error copy", () => {
  const codes = [...EMAIL_SENDING_CODES, ...EMAIL_PRICING_CODES, ...EMAIL_OVERVIEW_CODES, ...EMAIL_OUTREACH_CODES, ...EMAIL_API_CODES, ...EMAIL_HYGIENE_CODES, "default"];

  it.skipIf(!existsSync(HYGIENE_GOLDEN))("lists the address status codes the backend declares in its golden file", () => {
    const golden = readFileSync(HYGIENE_GOLDEN, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    expect([...EMAIL_HYGIENE_CODES].sort()).toEqual(golden.sort());
  });

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`translates every refusal code of the email endpoints in ${locale}, without dashes`, () => {
      const errors = (catalog.emailMarketing as { errors: Record<string, unknown> }).errors;
      const missing = codes.filter((code) => typeof errors[code] !== "string" || (errors[code] as string).trim() === "");
      expect(missing).toEqual([]);
      const dashed = codes.filter((code) => new RegExp("[\\u2013\\u2014]").test(String(errors[code])));
      expect(dashed).toEqual([]);
    });
  }
});
