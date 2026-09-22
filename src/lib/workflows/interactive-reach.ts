import type { ChannelInteractiveLimits } from "./types";


export type ReachStatus =
  | "ok"
  | "dropped"
  | "truncated"
  | "payload_too_long";

export interface ChannelReach {
  channel: string;
  status: ReachStatus;
  limit: number;
}

export type PromptStyle = "buttons" | "list";

export interface ReachOption {
  id: string;
  title: string;
  description?: string;
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function maxOptionsFor(
  limits: ChannelInteractiveLimits,
  style: PromptStyle,
): number {
  return style === "list" ? limits.maxOptionsList : limits.maxOptionsButtons;
}

export function reachFor(
  option: ReachOption,
  index: number,
  style: PromptStyle,
  channelLimits: Record<string, ChannelInteractiveLimits>,
): ChannelReach[] {
  return Object.entries(channelLimits)
    .map(([channel, limits]): ChannelReach => {
      if (
        limits.maxPayloadBytes > 0 &&
        byteLength(option.id) > limits.maxPayloadBytes
      ) {
        return {
          channel,
          status: "payload_too_long",
          limit: limits.maxPayloadBytes,
        };
      }

      const cap = maxOptionsFor(limits, style);
      if (cap > 0 && index >= cap) {
        return { channel, status: "dropped", limit: cap };
      }

      if (
        limits.maxLabelRunes > 0 &&
        [...option.title].length > limits.maxLabelRunes
      ) {
        return { channel, status: "truncated", limit: limits.maxLabelRunes };
      }

      return { channel, status: "ok", limit: cap };
    })
    .sort((a, b) => a.channel.localeCompare(b.channel));
}

export function problemsFor(
  option: ReachOption,
  index: number,
  style: PromptStyle,
  channelLimits: Record<string, ChannelInteractiveLimits>,
): ChannelReach[] {
  return reachFor(option, index, style, channelLimits).filter(
    (r) => r.status !== "ok",
  );
}

export function channelsWithoutDescriptions(
  channelLimits: Record<string, ChannelInteractiveLimits>,
): string[] {
  return Object.entries(channelLimits)
    .filter(([, limits]) => !limits.supportsDescriptions)
    .map(([channel]) => channel)
    .sort();
}

export function authorableOptionCount(
  style: PromptStyle,
  channelLimits: Record<string, ChannelInteractiveLimits>,
  fallback: number,
): number {
  const caps = Object.values(channelLimits)
    .map((limits) => maxOptionsFor(limits, style))
    .filter((n) => n > 0);
  return caps.length > 0 ? Math.max(...caps) : fallback;
}
