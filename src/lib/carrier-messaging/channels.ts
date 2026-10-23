import { CARRIER_CHANNELS, type CarrierChannel } from "@/lib/carrier-messaging/types";
import { isJson } from "@/lib/json/guards";

export interface CarrierChannelState {
  channel: CarrierChannel;
  launched: boolean;
}

export interface CarrierChannels {
  channels: CarrierChannelState[];
}

function isChannel(value: unknown): value is CarrierChannel {
  return typeof value === "string" && (CARRIER_CHANNELS as readonly string[]).includes(value);
}

export function parseCarrierChannels(value: unknown): CarrierChannels | null {
  if (!isJson(value) || !Array.isArray(value.channels)) return null;
  const channels: CarrierChannelState[] = [];
  for (const item of value.channels) {
    if (!isJson(item) || typeof item.launched !== "boolean") return null;
    if (!isChannel(item.channel)) continue;
    channels.push({ channel: item.channel, launched: item.launched });
  }
  return { channels };
}

export type CarrierRequirement = CarrierChannel | "any";

export function carrierRequirementMet(requirement: CarrierRequirement, launched: (channel: CarrierChannel) => boolean): boolean {
  if (requirement === "any") return CARRIER_CHANNELS.some((channel) => launched(channel));
  return launched(requirement);
}

export function isParkedCarrierChannel(value: string, launched: (channel: CarrierChannel) => boolean): boolean {
  return isChannel(value) && !launched(value);
}

export function isChannelLaunched(channels: CarrierChannels | null, channel: CarrierChannel): boolean {
  return channels?.channels.some((entry) => entry.channel === channel && entry.launched) ?? false;
}
