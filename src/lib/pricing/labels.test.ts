import { describe, expect, it } from "vitest";
import { pricingServiceLabel } from "./labels";

function translator(messages: Record<string, string>) {
  const t = (key: string) => messages[key];
  t.has = (key: string) => key in messages;
  return t;
}

describe("pricingServiceLabel", () => {
  const t = translator({
    "pricing.services.rcs.inbound": "RCS, resposta recebida",
    "pricing.services.sms.inbound": "SMS, resposta recebida",
    "services.email.send": "Envio de e-mail",
  });

  it("tells apart services that share a name in different categories", () => {
    expect(pricingServiceLabel(t, "pricing", { category: "rcs", service: "inbound" })).toBe("RCS, resposta recebida");
    expect(pricingServiceLabel(t, "pricing", { category: "sms", service: "inbound" })).toBe("SMS, resposta recebida");
  });

  it("reads namespaces whose labels sit at the root", () => {
    expect(pricingServiceLabel(t, "", { category: "email", service: "send" })).toBe("Envio de e-mail");
  });

  it("humanizes a service the catalog does not know yet", () => {
    expect(pricingServiceLabel(t, "pricing", { category: "rcs", service: "carousel_card" })).not.toBe("carousel_card");
  });
});
