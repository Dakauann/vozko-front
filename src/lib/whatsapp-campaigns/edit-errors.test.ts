import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";
import { describe, expect, it } from "vitest";

const EDIT_REFUSAL_CODES = [
  "campaign_phone_unavailable",
  "campaign_receptive_managed_by_number",
  "campaign_running",
  "campaign_schedule_in_past",
  "campaign_schedule_out_of_window",
  "campaign_template_not_ready",
  "campaign_template_phone_mismatch",
  "campaign_template_unavailable",
  "campaign_template_variables_missing",
];

const AUTOMATION_REFUSAL_CODES = [
  "campaign_workflow_vars_missing",
  "campaign_workflow_forbidden",
  "campaign_workflow_not_found",
  "campaign_agent_not_found",
  "AGENT_REQUIRED_VARIABLE_MISSING",
  "campaign_automation_unavailable",
];

describe("campaign edit refusals", () => {
  for (const [locale, messages] of Object.entries({ pt: ptMessages, en: enMessages, es: esMessages, de: deMessages })) {
    it(`are translated in ${locale}`, () => {
      const errors = (messages.whatsappCampaignsPage as { errors?: Record<string, string> }).errors ?? {};
      for (const code of [...EDIT_REFUSAL_CODES, ...AUTOMATION_REFUSAL_CODES]) {
        expect(errors[code], `${locale} ${code}`).toBeTruthy();
      }
    });
  }
});
