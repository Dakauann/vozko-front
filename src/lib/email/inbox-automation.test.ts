import { describe, expect, it } from "vitest";

import { EMAIL_INBOX_ERROR_CODES, inboxSettingsOf, withInboxChange } from "@/lib/email/inbox-automation";
import type { EmailInbox } from "@/lib/email/types";
import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

const INBOX: EmailInbox = {
  id: "snd-1",
  workspaceId: "ws-1",
  name: "Vendas",
  address: "vendas@loja.com.br",
  departmentId: "dep-1",
  pipelineId: "pl-1",
  agentId: "ag-1",
  workflowId: null,
  enableAgentResponses: true,
  enableWorkflow: false,
  enableAnalysis: false,
  enableAutoStaging: true,
  enableAutoMemory: false,
  createdAt: "2026-10-22T10:00:00Z",
  updatedAt: "2026-10-22T10:00:00Z",
};

describe("email inbox automation", () => {
  it("keeps only the settings the inbox replaces", () => {
    expect(inboxSettingsOf(INBOX)).toEqual({
      departmentId: "dep-1",
      pipelineId: "pl-1",
      agentId: "ag-1",
      workflowId: null,
      enableAgentResponses: true,
      enableWorkflow: false,
      enableAnalysis: false,
      enableAutoStaging: true,
      enableAutoMemory: false,
    });
  });

  it("reads absent references as empty", () => {
    const bare = { ...INBOX, departmentId: undefined, pipelineId: undefined, agentId: undefined, workflowId: undefined };
    expect(inboxSettingsOf(bare)).toMatchObject({ departmentId: null, pipelineId: null, agentId: null, workflowId: null });
  });

  it("applies one panel change over the whole body", () => {
    const settings = inboxSettingsOf(INBOX);
    expect(withInboxChange(settings, { enableAnalysis: true })).toEqual({ ...settings, enableAnalysis: true });
    expect(withInboxChange(settings, { agentId: null, enableAgentResponses: false })).toEqual({ ...settings, agentId: null, enableAgentResponses: false });
    expect(withInboxChange(settings, { pipelineId: "" })).toEqual({ ...settings, pipelineId: "" });
    expect(withInboxChange(settings, { departmentId: "dep-2" })).toEqual({ ...settings, departmentId: "dep-2" });
  });

  for (const [locale, catalog] of Object.entries({ pt, en, es, de })) {
    it(`${locale}: explains every email inbox refusal`, () => {
      const errors = (catalog.emailMarketing as { errors: Record<string, string> }).errors;
      for (const code of EMAIL_INBOX_ERROR_CODES) expect(typeof errors[code], `${locale} ${code}`).toBe("string");
    });
  }
});
