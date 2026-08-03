import type { ChannelInteractiveLimits } from "./types";

/**
 * One option list is authored once and rendered by every channel the workflow
 * can run on, and the channels disagree: WhatsApp shows three buttons,
 * Instagram thirteen quick replies, Telegram an inline keyboard with no
 * practical bound. An option past a channel's cap is not an error anywhere,
 * it simply never appears there, and the first person to notice is a customer
 * who was never offered the choice.
 *
 * These functions answer, per option, what each channel will actually do with
 * it. They are pure so the reasoning is testable without rendering the editor.
 */

export type ReachStatus =
  /** Rendered in full. */
  | "ok"
  /** Past the channel's option cap, never shown there. */
  | "dropped"
  /** Shown, but the label is cut to the channel's limit. */
  | "truncated"
  /** The option id does not fit the channel's payload bound, so the option
   *  cannot be sent at all, a truncated id would come back matching no
   *  branch. */
  | "payload_too_long";

export interface ChannelReach {
  channel: string;
  status: ReachStatus;
  /** The channel's own number behind the verdict, for the explanation. */
  limit: number;
}

export type PromptStyle = "buttons" | "list";

export interface ReachOption {
  id: string;
  title: string;
  description?: string;
}

/** Byte length, matching the backend's payload bound. Telegram documents
 *  callback_data as "1-64 bytes", so an id of accented text overflows sooner
 *  than its character count suggests. */
export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function maxOptionsFor(
  limits: ChannelInteractiveLimits,
  style: PromptStyle,
): number {
  return style === "list" ? limits.maxOptionsList : limits.maxOptionsButtons;
}

/**
 * reachFor reports what each channel does with one option.
 *
 * Order of judgement matters: an option the channel cannot send at all
 * (payload) outranks one it will not show (cap), which outranks one it shows
 * imperfectly (label). The author should see the most consequential verdict.
 */
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

/** Only the channels with something to say. An option that renders everywhere
 *  produces an empty list, so the editor can stay silent instead of repeating
 *  three green ticks down the whole panel. */
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

/** Channels that would silently discard a row description. Only WhatsApp list
 *  rows have the slot, so an author who wrote one deserves to know it is
 *  invisible everywhere else. */
export function channelsWithoutDescriptions(
  channelLimits: Record<string, ChannelInteractiveLimits>,
): string[] {
  return Object.entries(channelLimits)
    .filter(([, limits]) => !limits.supportsDescriptions)
    .map(([channel]) => channel)
    .sort();
}

/**
 * How many options are worth authoring at all: the most permissive connected
 * channel.
 *
 * The editor used to stop at three because that is WhatsApp's button cap. With
 * Telegram connected that ceiling is simply wrong, it prevents writing the
 * fourth option that Telegram would happily render. Capping at the maximum and
 * annotating the overflow lets one workflow serve every channel well.
 */
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
