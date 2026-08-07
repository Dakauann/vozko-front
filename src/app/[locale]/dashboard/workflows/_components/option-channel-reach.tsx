"use client";

import { WarningCircle } from "@/components/icons";

import { ChannelLogo } from "@/components/icons/channel-logos";
import type { ChannelInteractiveLimits } from "@/lib/workflows/types";
import {
  channelsWithoutDescriptions,
  problemsFor,
  type ChannelReach,
  type PromptStyle,
  type ReachOption,
} from "@/lib/workflows/interactive-reach";

const CHANNEL_NAMES: Record<string, string> = {
  whatsapp: "WhatsApp",
  // Named, not left to the fallback: an unlisted channel renders its raw key
  // ("unofficial_whatsapp") straight into the reach summary, and the two
  // transports carry DIFFERENT interactive limits, so an operator reading this
  // has to know which one a node will reach.
  unofficial_whatsapp: "WhatsApp (não oficial)",
  instagram: "Instagram",
  telegram: "Telegram",
};

function channelName(channel: string): string {
  return CHANNEL_NAMES[channel] ?? channel;
}

function reasonFor(reach: ChannelReach): string {
  switch (reach.status) {
    case "dropped":
      return `não aparece no ${channelName(reach.channel)} (mostra ${reach.limit})`;
    case "truncated":
      return `cortado em ${reach.limit} caracteres no ${channelName(reach.channel)}`;
    case "payload_too_long":
      return `id longo demais para o ${channelName(reach.channel)} (máx. ${reach.limit} bytes)`;
    default:
      return "";
  }
}

/**
 * The reach summary shown once above an option list.
 *
 * It states each connected channel's capacity in one quiet line so the numbers
 * are available without hunting, and so the per-option notes below can be terse.
 */
export function ChannelReachLegend({
  style,
  channelLimits,
}: {
  style: PromptStyle;
  channelLimits: Record<string, ChannelInteractiveLimits>;
}) {
  const entries = Object.entries(channelLimits).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {entries.map(([channel, limits]) => {
        const cap =
          style === "list" ? limits.maxOptionsList : limits.maxOptionsButtons;
        return (
          <span
            key={channel}
            className="flex items-center gap-1 text-[11px] text-muted-foreground"
          >
            <ChannelLogo channel={channel} className="h-3 w-3 shrink-0" />
            <span>
              {channelName(channel)}
              <span className="ml-1 tabular-nums text-muted-foreground/70">
                {cap}
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * Per-option note, rendered only when a channel would do something the author
 * did not ask for.
 *
 * Deliberately silent on a healthy option. Showing three confirmations on every
 * row would give every row identical weight and bury the one row that actually
 * needs attention, the whole point is that the exceptions are what stand out.
 */
export function OptionChannelReach({
  option,
  index,
  style,
  channelLimits,
}: {
  option: ReachOption;
  index: number;
  style: PromptStyle;
  channelLimits: Record<string, ChannelInteractiveLimits>;
}) {
  const problems = problemsFor(option, index, style, channelLimits);
  if (problems.length === 0) return null;

  return (
    <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-warning-ink">
      <WarningCircle size={12} weight="fill" className="mt-px shrink-0" />
      <ul className="space-y-0.5">
        {problems.map((reach) => (
          <li key={reach.channel} className="flex items-center gap-1">
            <ChannelLogo
              channel={reach.channel}
              className="h-3 w-3 shrink-0 opacity-70"
            />
            <span>{reasonFor(reach)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Shown under a list row's description field when channels exist that have no
 * description slot at all. WhatsApp is the only one that renders it.
 */
export function DescriptionReachNote({
  channelLimits,
}: {
  channelLimits: Record<string, ChannelInteractiveLimits>;
}) {
  const without = channelsWithoutDescriptions(channelLimits);
  if (without.length === 0) return null;

  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      A descrição aparece só no WhatsApp, {without.map(channelName).join(" e ")}{" "}
      {without.length > 1 ? "mostram" : "mostra"} apenas o título.
    </p>
  );
}
