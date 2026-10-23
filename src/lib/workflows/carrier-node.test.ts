import { describe, expect, it } from "vitest";

import { SEND_CARRIER_CONFIG_KEYS, SEND_CARRIER_NODE, carrierNodeSummary, readCarrierConfig } from "./carrier-node";

describe("send carrier node config", () => {
  it("reads the canonical RCS shape the backend stores", () => {
    const read = readCarrierConfig({ channel: "rcs", sender_id: "snd-1", route_id: "", content: { text: "Oi {{lead_name}}" }, text: "", marketing: true });
    expect(read).toEqual({
      readable: true,
      config: { channel: "rcs", senderId: "snd-1", routeId: "", content: { text: "Oi {{lead_name}}" }, text: "", marketing: true },
    });
  });

  it("reads the SMS shape", () => {
    const read = readCarrierConfig({ channel: "sms", route_id: "rt-1", text: "Oi", marketing: false });
    expect(read.readable && read.config).toMatchObject({ channel: "sms", routeId: "rt-1", text: "Oi", marketing: false, content: {} });
  });

  it.each([
    ["an unknown channel", { channel: "fax" }],
    ["no channel", {}],
    ["content that is not an object", { channel: "rcs", content: "Oi" }],
    ["content that is a list", { channel: "rcs", content: [] }],
    ["marketing that is not a switch", { channel: "sms", marketing: "sim" }],
    ["text that is not text", { channel: "sms", text: 12 }],
    ["a sender that is not text", { channel: "rcs", sender_id: 1 }],
  ])("refuses to guess %s", (_, config) => {
    expect(readCarrierConfig(config as Record<string, unknown>).readable).toBe(false);
  });

  it("owns every key the node stores", () => {
    expect(SEND_CARRIER_NODE).toBe("action_send_carrier");
    expect([...SEND_CARRIER_CONFIG_KEYS].sort()).toEqual(["channel", "content", "marketing", "route_id", "sender_id", "text"]);
  });

  it("summarises the message for the canvas", () => {
    expect(carrierNodeSummary({ channel: "rcs", content: { text: "Oi" } })).toEqual({ channel: "rcs", text: "Oi" });
    expect(carrierNodeSummary({ channel: "rcs", content: { cards: [{ title: "Cupom", description: "10%" }] } })).toEqual({ channel: "rcs", text: "Cupom" });
    expect(carrierNodeSummary({ channel: "sms", text: "Oi" })).toEqual({ channel: "sms", text: "Oi" });
    expect(carrierNodeSummary({ channel: "fax" })).toBeNull();
  });
});
