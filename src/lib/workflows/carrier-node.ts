import type { RcsContent } from "@/lib/rcs/types";

export const SEND_CARRIER_NODE = "action_send_carrier";

export const CARRIER_CHANNELS = ["rcs", "sms"] as const;

export type CarrierChannel = (typeof CARRIER_CHANNELS)[number];

export const SEND_CARRIER_CONFIG_KEYS = ["channel", "sender_id", "route_id", "content", "text", "marketing"] as const;

export interface CarrierNodeConfig {
  channel: CarrierChannel;
  senderId: string;
  routeId: string;
  content: RcsContent;
  text: string;
  marketing: boolean;
}

export type CarrierConfigRead = { readable: true; config: CarrierNodeConfig } | { readable: false };

const UNREADABLE: CarrierConfigRead = { readable: false };

function isChannel(value: unknown): value is CarrierChannel {
  return (CARRIER_CHANNELS as readonly unknown[]).includes(value);
}

function optional<T>(value: unknown, guard: (candidate: unknown) => candidate is T, fallback: T): T | undefined {
  if (value === undefined || value === null) return fallback;
  return guard(value) ? value : undefined;
}

const isText = (value: unknown): value is string => typeof value === "string";
const isSwitch = (value: unknown): value is boolean => typeof value === "boolean";
const isObject = (value: unknown): value is RcsContent => typeof value === "object" && value !== null && !Array.isArray(value);

export function readCarrierConfig(config: Record<string, unknown>): CarrierConfigRead {
  if (!isChannel(config.channel)) return UNREADABLE;
  const senderId = optional(config.sender_id, isText, "");
  const routeId = optional(config.route_id, isText, "");
  const text = optional(config.text, isText, "");
  const marketing = optional(config.marketing, isSwitch, true);
  const content = optional<RcsContent>(config.content, isObject, {});
  if (senderId === undefined || routeId === undefined || text === undefined || marketing === undefined || content === undefined) return UNREADABLE;
  return { readable: true, config: { channel: config.channel, senderId, routeId, content, text, marketing } };
}

export function carrierNodeSummary(config: Record<string, unknown>): { channel: CarrierChannel; text: string } | null {
  const read = readCarrierConfig(config);
  if (!read.readable) return null;
  const { channel, content, text } = read.config;
  if (channel === "sms") return { channel, text };
  const card = content.cards?.[0];
  return { channel, text: content.text?.trim() || card?.title?.trim() || card?.description?.trim() || "" };
}
