import { describe, expect, it } from "vitest";

import { carrierRequirementMet, isChannelLaunched, isParkedCarrierChannel, parseCarrierChannels } from "@/lib/carrier-messaging/channels";

describe("carrier channels", () => {
  const answer = { channels: [{ channel: "rcs", launched: false }, { channel: "sms", launched: true }] };

  it("reads which channels the backend launched", () => {
    expect(parseCarrierChannels(answer)).toEqual(answer);
  });

  it("skips a channel this build does not know and refuses a malformed entry", () => {
    expect(parseCarrierChannels({ channels: [{ channel: "fax", launched: true }, { channel: "sms", launched: true }] })).toEqual({ channels: [{ channel: "sms", launched: true }] });
    expect(parseCarrierChannels({ channels: [{ channel: "sms", launched: "yes" }] })).toBeNull();
    expect(parseCarrierChannels({})).toBeNull();
  });

  it("fails closed while unknown or when a channel is missing", () => {
    const channels = parseCarrierChannels(answer);
    expect(isChannelLaunched(channels, "sms")).toBe(true);
    expect(isChannelLaunched(channels, "rcs")).toBe(false);
    expect(isChannelLaunched(null, "sms")).toBe(false);
    expect(isChannelLaunched({ channels: [] }, "sms")).toBe(false);
  });

  it("opens a requirement for one channel only when that channel is launched", () => {
    const smsOnly = (channel: string) => channel === "sms";
    expect(carrierRequirementMet("sms", smsOnly)).toBe(true);
    expect(carrierRequirementMet("rcs", smsOnly)).toBe(false);
  });

  it("parks every carrier channel the backend has not launched and nothing else", () => {
    expect(isParkedCarrierChannel("sms", () => false)).toBe(true);
    expect(isParkedCarrierChannel("rcs", () => false)).toBe(true);
    expect(isParkedCarrierChannel("sms", (channel) => channel === "sms")).toBe(false);
    expect(isParkedCarrierChannel("whatsapp", () => false)).toBe(false);
  });

  it("opens a requirement for any channel once one channel is launched", () => {
    expect(carrierRequirementMet("any", (channel) => channel === "rcs")).toBe(true);
    expect(carrierRequirementMet("any", () => false)).toBe(false);
  });
});
