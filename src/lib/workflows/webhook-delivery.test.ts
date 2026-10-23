import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { webhookOutcomeLabel, webhookReasonLabel, webhookResolutionLabel } from "./webhook-delivery";

const t = createTranslator({ locale: "pt", messages: ptMessages, namespace: "workflowRuns.webhook" });
const translate = (key: string, values?: Record<string, string>) => t(key as never, values as never);

describe("webhookReasonLabel", () => {
  it.each([
    ["workflow_not_active", "Fluxo inativo"],
    ["entry_not_found", "Conversa não encontrada"],
    ["unauthorized", "Autenticação inválida"],
    ["webhook_inactive", "Webhook desativado"],
    ["webhook_not_found", "Webhook não encontrado"],
    ["method_not_allowed", "Método HTTP não aceito"],
    ["entry_required", "Corpo sem conversa"],
    ["entry_forbidden", "Conversa de outra área de trabalho"],
    ["no_trigger_node", "Fluxo sem gatilho de webhook"],
    ["workspace_at_capacity", "Limite de execuções simultâneas"],
    ["lead_contact_required", "Corpo sem telefone nem email do lead"],
    ["lead_phone_invalid", "Telefone do lead inválido"],
    ["lead_not_found", "Lead não encontrado"],
    ["trigger_invalid", "Gatilho mal configurado"],
    ["internal_error", "Erro interno"],
  ])("says %s in Portuguese", (reason, expected) => {
    expect(webhookReasonLabel(reason, translate)).toBe(expected);
  });

  it("names an unknown reason instead of hiding it", () => {
    expect(webhookReasonLabel("brand_new_reason", translate)).toBe("Motivo desconhecido (brand_new_reason)");
  });

  it("has no reason for accepted calls", () => {
    expect(webhookReasonLabel(undefined, translate)).toBeNull();
    expect(webhookReasonLabel("", translate)).toBeNull();
  });
});

describe("webhookResolutionLabel", () => {
  it("says how the call found its conversation or lead", () => {
    expect(webhookResolutionLabel("phone", translate)).toBe("pelo telefone");
    expect(webhookResolutionLabel("lead_phone", translate)).toBe("lead pelo telefone");
    expect(webhookResolutionLabel("lead_email", translate)).toBe("lead pelo email");
    expect(webhookResolutionLabel("entry_id", translate)).toBeNull();
    expect(webhookResolutionLabel(undefined, translate)).toBeNull();
  });
});

describe("webhookOutcomeLabel", () => {
  it.each([
    ["accepted", "Aceita", "healthy"],
    ["duplicate", "Repetida", "muted"],
    ["already_running", "Já em execução", "muted"],
    ["ignored", "Ignorada", "muted"],
    ["rejected", "Recusada", "fault"],
  ] as const)("labels %s with a chip tone", (outcome, label, tone) => {
    expect(webhookOutcomeLabel(outcome, translate)).toEqual({ label, tone });
  });
});
