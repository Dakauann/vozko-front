import { describe, expect, it } from "vitest";

import {
  REASON_ERROR_CODES,
  reasonAcceptsText,
  reasonAvailability,
  reasonErrorKey,
  reasonLabelKey,
  reasonSendBody,
  reasonTextError,
  reasonTextLimit,
} from "@/lib/mercadolivre/reasons";
import type { MercadoLivreReasonOption } from "@/lib/mercadolivre/types";

function option(overrides: Partial<MercadoLivreReasonOption> = {}): MercadoLivreReasonOption {
  return { id: "OTHER", enabled: true, actionable: true, charLimit: 350, capAvailable: 1, templates: [], ...overrides };
}

const variants = option({
  id: "REQUEST_VARIANTS",
  charLimit: undefined,
  templates: [{ id: "TPL_1", vars: [{ id: "days", type: "number" }] }],
});

describe("Mercado Livre reasons", () => {
  it("is usable only while enabled, actionable and with uses left", () => {
    expect(reasonAvailability(option())).toBe("available");
    expect(reasonAvailability(option({ capAvailable: 0 }))).toBe("cap_reached");
    expect(reasonAvailability(option({ enabled: false }))).toBe("unavailable");
    expect(reasonAvailability(option({ actionable: false, capAvailable: 0 }))).toBe("unavailable");
  });

  it("takes free text when it carries a character limit or offers no template", () => {
    expect(reasonAcceptsText(option())).toBe(true);
    expect(reasonAcceptsText(option({ charLimit: undefined }))).toBe(true);
    expect(reasonAcceptsText(variants)).toBe(false);
  });

  it("never lets the reason limit pass the message limit and keeps the charset rule", () => {
    expect(reasonTextLimit(option({ charLimit: 120 }))).toEqual({ max: 120, unit: "characters", charset: "mercadolivre" });
    expect(reasonTextLimit(option({ charLimit: 900 }))).toEqual({ max: 350, unit: "characters", charset: "mercadolivre" });
    expect(reasonTextLimit(option({ charLimit: undefined }))).toEqual({ max: 350, unit: "characters", charset: "mercadolivre" });
  });

  it("checks free text with the shared Mercado Livre text rule and the reason limit", () => {
    expect(reasonTextError(option(), "Olá, tudo bem?")).toBeNull();
    expect(reasonTextError(option(), "   ")).toBe("empty");
    expect(reasonTextError(option(), "Oi “aspas”")).toBe("charset");
    expect(reasonTextError(option({ charLimit: 5 }), "Olá mundo")).toBe("too_long");
    expect(reasonTextError(option(), "a".repeat(351))).toBe("too_long");
  });

  it("builds a free text send with no template and no variables", () => {
    expect(reasonSendBody(option(), { kind: "text", text: "  Olá  " })).toEqual({
      body: { optionId: "OTHER", templateId: "", text: "Olá", vars: [] },
    });
    expect(reasonSendBody(option(), { kind: "text", text: "Oi “x”" })).toEqual({ error: "charset" });
    expect(reasonSendBody(variants, { kind: "text", text: "Olá" })).toEqual({ error: "text_not_accepted" });
  });

  it("builds a template send with every variable as a whole number", () => {
    expect(reasonSendBody(variants, { kind: "template", templateId: "TPL_1", values: { days: " 3 " } })).toEqual({
      body: { optionId: "REQUEST_VARIANTS", templateId: "TPL_1", text: "", vars: [{ id: "days", value: 3 }] },
    });
  });

  it("refuses a template send it cannot complete", () => {
    expect(reasonSendBody(variants, { kind: "template", templateId: "TPL_9", values: {} })).toEqual({ error: "template_unknown" });
    expect(reasonSendBody(variants, { kind: "template", templateId: "TPL_1", values: {} })).toEqual({ error: "missing_value" });
    expect(reasonSendBody(variants, { kind: "template", templateId: "TPL_1", values: { days: "2,5" } })).toEqual({ error: "invalid_value" });
    expect(reasonSendBody(variants, { kind: "template", templateId: "TPL_1", values: { days: "-1" } })).toEqual({ error: "invalid_value" });
  });

  it("refuses to send a reason that is not available", () => {
    expect(reasonSendBody(option({ capAvailable: 0 }), { kind: "text", text: "Olá" })).toEqual({ error: "cap_reached" });
    expect(reasonSendBody(option({ enabled: false }), { kind: "text", text: "Olá" })).toEqual({ error: "unavailable" });
  });

  it("names a copy key for every refusal the server sends, and the generic one otherwise", () => {
    for (const code of REASON_ERROR_CODES) expect(reasonErrorKey(code)).toBe(`errors.${code}`);
    expect(REASON_ERROR_CODES).toEqual(
      expect.arrayContaining(["forbidden", "reason_unknown", "reason_unavailable", "reason_cap_reached", "reason_content", "text_charset", "text_too_long"]),
    );
    expect(reasonErrorKey(undefined)).toBe("errors.generic");
    expect(reasonErrorKey("brand_new")).toBe("errors.generic");
  });

  it("names the reasons Mercado Livre documents and leaves the others to their id", () => {
    expect(reasonLabelKey("OTHER")).toBe("option.OTHER");
    expect(reasonLabelKey("REQUEST_VARIANTS")).toBe("option.REQUEST_VARIANTS");
    expect(reasonLabelKey("DELIVERY_PROMISE")).toBe("option.DELIVERY_PROMISE");
    expect(reasonLabelKey("SOMETHING_ELSE")).toBeNull();
  });
});
