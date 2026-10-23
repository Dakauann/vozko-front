import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();
vi.mock("@/lib/api/browser-client", () => ({ apiClient: (...args: unknown[]) => apiClient(...args) }));

import { checkTemplateVariableNamesAction, createWhatsAppTemplateAction, editWhatsAppTemplateContentAction } from "./whatsapp-templates";

const components = [{ type: "BODY" as const, text: "Oi, novidades. Responda /sair" }];

beforeEach(() => apiClient.mockReset());

describe("editWhatsAppTemplateContentAction", () => {
  it("puts the full new content on the template and returns Meta's read-back", async () => {
    apiClient.mockResolvedValueOnce({ data: { id: "tpl-1", status: "PENDING" } });
    const exit = {
      buttonActions: [{ buttonIndex: 0, buttonText: "Parar", kind: "opt_out" as const, params: {}, confirmation: "" }],
      exitConfirmation: "Pronto.",
    };
    const result = await editWhatsAppTemplateContentAction("tpl-1", { components, headerMediaUrl: "https://files.test/b.jpg", ...exit });

    expect(apiClient).toHaveBeenCalledWith("/whatsapp/templates/tpl-1/content", {
      method: "PUT",
      body: JSON.stringify({ components, headerMediaUrl: "https://files.test/b.jpg", ...exit }),
    });
    expect(result).toEqual({ template: { id: "tpl-1", status: "PENDING" }, error: null, errorCode: undefined, expected: undefined });
  });

  it("returns the refusal code and what the server expected", async () => {
    apiClient.mockResolvedValueOnce({
      error: { message: "window", status: 429, code: "template_edit_window", expected: { nextEditAt: "2026-10-18T09:30:00Z" } },
    });
    const result = await editWhatsAppTemplateContentAction("tpl/1", { category: "UTILITY", components });

    expect(apiClient.mock.calls[0][0]).toBe("/whatsapp/templates/tpl%2F1/content");
    expect(result).toEqual({
      template: null,
      error: "window",
      errorCode: "template_edit_window",
      expected: { nextEditAt: "2026-10-18T09:30:00Z" },
    });
  });
});

describe("createWhatsAppTemplateAction", () => {
  it("returns the refusal code and the button the server refused", async () => {
    apiClient.mockResolvedValueOnce({
      error: { message: "dynamic", status: 400, code: "template_tracked_button_dynamic", expected: { buttonIndex: "1" } },
    });
    const result = await createWhatsAppTemplateAction({ businessPhoneId: "bp-1", name: "oferta", language: "pt_BR", category: "MARKETING", components });

    expect(result).toEqual({
      template: null,
      error: "dynamic",
      errorCode: "template_tracked_button_dynamic",
      expected: { buttonIndex: "1" },
    });
  });
});

describe("checkTemplateVariableNamesAction", () => {
  it("asks the server whether the names follow the template rule", async () => {
    apiClient.mockResolvedValueOnce({ data: { valid: true } });
    const answer = await checkTemplateVariableNamesAction(["serie_2027"]);
    expect(apiClient).toHaveBeenCalledWith("/whatsapp/templates/variable-names/check", { method: "POST", body: JSON.stringify({ names: ["serie_2027"] }) });
    expect(answer).toEqual({ data: { valid: true }, error: null });
  });

  it("keeps the refused name the server names", async () => {
    apiClient.mockResolvedValueOnce({ error: { message: "bad", status: 400, code: "template_variable_name_invalid", expected: { variable: "Serie" } } });
    const answer = await checkTemplateVariableNamesAction(["Serie"]);
    expect(answer.error).toEqual({ message: "bad", status: 400, code: "template_variable_name_invalid", expected: { variable: "Serie" } });
  });

  it("refuses an answer that does not say the names are valid", async () => {
    apiClient.mockResolvedValueOnce({ data: { valid: false } });
    expect((await checkTemplateVariableNamesAction(["x"])).data).toBeNull();
  });
});
