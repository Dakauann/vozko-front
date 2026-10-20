import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { readSenderKind } from "@/lib/conversations/sender";
import { SENDER_LABEL_CHANNELS, senderLabelKey } from "@/lib/conversations/sender-label";

const CATALOGS: Record<string, { crm: Record<string, unknown> }> = { pt, en, es, de };

function at(catalog: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), catalog);
}

describe("reading a sender kind", () => {
  it("keeps the kinds the server sends and drops anything else", () => {
    expect(readSenderKind("external")).toBe("external");
    expect(readSenderKind("contact")).toBe("contact");
    expect(readSenderKind("robot")).toBeUndefined();
    expect(readSenderKind(undefined)).toBeUndefined();
    expect(readSenderKind(3)).toBeUndefined();
  });
});

describe("naming who sent a message", () => {
  it("names nobody for the contact or an unknown sender", () => {
    expect(senderLabelKey("contact", "whatsapp")).toBeNull();
    expect(senderLabelKey(undefined, "whatsapp")).toBeNull();
  });

  it("names the team, automations and the system the same on every channel", () => {
    expect(senderLabelKey("human", "instagram")).toBe("messageSender.human");
    expect(senderLabelKey("ai", "mercadolivre")).toBe("messageSender.ai");
    expect(senderLabelKey("workflow", "telegram")).toBe("messageSender.workflow");
    expect(senderLabelKey("campaign", "whatsapp")).toBe("messageSender.campaign");
    expect(senderLabelKey("system", "webchat")).toBe("messageSender.system");
  });

  it("names a message written outside the platform after the channel's own app", () => {
    expect(senderLabelKey("external", "mercadolivre")).toBe("messageSender.externalVia.mercadolivre");
    expect(senderLabelKey("external", "unofficial_whatsapp")).toBe("messageSender.externalVia.unofficial_whatsapp");
    expect(senderLabelKey("external", "instagram")).toBe("messageSender.externalVia.instagram");
    expect(senderLabelKey("external", "tiktok")).toBe("messageSender.externalVia.tiktok");
  });

  it("falls back to the generic outside label on a channel it does not know", () => {
    expect(senderLabelKey("external", "fax")).toBe("messageSender.external");
    expect(senderLabelKey("external", undefined)).toBe("messageSender.external");
  });

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale}: has a label for every key it can name`, () => {
      const keys = [
        "messageSender.human",
        "messageSender.ai",
        "messageSender.workflow",
        "messageSender.campaign",
        "messageSender.system",
        "messageSender.external",
        ...SENDER_LABEL_CHANNELS.map((channel) => `messageSender.externalVia.${channel}`),
      ];
      for (const key of keys) expect(typeof at(catalog.crm, key), key).toBe("string");
    });
  }

  it("calls the Mercado Livre app by its name and a WhatsApp echo the phone", () => {
    expect(at(pt.crm, "messageSender.externalVia.mercadolivre")).toBe("App do Mercado Livre");
    expect(at(pt.crm, "messageSender.externalVia.whatsapp")).toBe(pt.crm.messageSender.external);
    expect(at(pt.crm, "messageSender.externalVia.unofficial_whatsapp")).toBe(pt.crm.messageSender.external);
  });
});
