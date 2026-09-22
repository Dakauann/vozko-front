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
            className="flex items-center gap-1 text-2xs text-muted-foreground"
          >
            <ChannelLogo channel={channel} className="h-3 w-3 shrink-0" />
            <span>
              {channelName(channel)}
              <span className="ml-1 tabular-nums text-muted-foreground">
                {cap}
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

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
    <div className="flex items-start gap-1.5 text-2xs leading-relaxed text-warning-ink">
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

export function DescriptionReachNote({
  channelLimits,
}: {
  channelLimits: Record<string, ChannelInteractiveLimits>;
}) {
  const without = channelsWithoutDescriptions(channelLimits);
  if (without.length === 0) return null;

  return (
    <p className="text-2xs leading-relaxed text-muted-foreground">
      A descrição aparece só no WhatsApp, {without.map(channelName).join(" e ")}{" "}
      {without.length > 1 ? "mostram" : "mostra"} apenas o título.
    </p>
  );
}
