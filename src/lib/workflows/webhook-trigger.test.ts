import { describe, expect, it } from "vitest";

import { acceptedWebhookEvents, addListValue, webhookExamples, webhookStartOn } from "./webhook-trigger";

describe("webhook trigger start", () => {
  it("starts on a conversation unless the node says lead", () => {
    expect(webhookStartOn("lead")).toBe("lead");
    expect(webhookStartOn("conversation")).toBe("conversation");
    expect(webhookStartOn(undefined)).toBe("conversation");
    expect(webhookStartOn("other")).toBe("conversation");
  });

  it("reads the accepted events as a clean list", () => {
    expect(acceptedWebhookEvents(["pedido_pago", " carrinho ", "", 3])).toEqual(["pedido_pago", "carrinho"]);
    expect(acceptedWebhookEvents(undefined)).toEqual([]);
  });
});

describe("webhook examples", () => {
  it("identifies a conversation by entry or by phone", () => {
    const [entry, phone] = webhookExamples("conversation", []);
    expect(JSON.parse(entry.compact)).toEqual({ entry_id: "c7f1e2a0-9b3d-4a1e-8f2c-1d2e3f4a5b6c", entry_type: "whatsapp" });
    expect(JSON.parse(phone.compact)).toEqual({ phone: "+5511998887777" });
  });

  it("identifies a lead by phone with a name, or by email, with the first accepted event", () => {
    const [phone, email] = webhookExamples("lead", ["carrinho_abandonado", "pedido_pago"]);
    expect(JSON.parse(phone.compact)).toEqual({ phone: "+5511998887777", name: "Ana Souza", event: "carrinho_abandonado", external_id: "pedido-123" });
    expect(JSON.parse(email.pretty)).toEqual({ email: "ana@exemplo.com", event: "carrinho_abandonado", external_id: "pedido-123" });
  });

  it("shows a sample event when every event is accepted", () => {
    const [phone] = webhookExamples("lead", []);
    expect(JSON.parse(phone.compact).event).toBe("pedido_pago");
  });
});

describe("addListValue", () => {
  it("adds a trimmed value once and ignores blanks", () => {
    expect(addListValue(["a"], " b ")).toEqual(["a", "b"]);
    expect(addListValue(["a"], "a")).toEqual(["a"]);
    expect(addListValue(["a"], "  ")).toEqual(["a"]);
  });
});
