"use client";

import { useTranslations } from "next-intl";

import { CompareBars } from "@/components/charts/vozko";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import { SPEND_CHANNELS, type ChannelSpend } from "@/lib/carrier-messaging/analytics";
import { useMicrosMoney } from "@/lib/carrier-messaging/use-micros-money";

import { CHANNEL_COLOR } from "./carrier-query";

export function ChannelCostCompare({ channels }: { channels: readonly ChannelSpend[] }) {
  const t = useTranslations("carrierMessaging.pages.overview.cost");
  const tChannels = useTranslations("carrierMessaging.channels");
  const money = useMicrosMoney();
  const empty = useEmptyValue();
  const ordered = SPEND_CHANNELS.map((channel) => channels.find((entry) => entry.channel === channel)).filter((entry): entry is ChannelSpend => Boolean(entry));
  if (ordered.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <div className="space-y-3">
      <CompareBars
        size="lg"
        rows={ordered.map((entry) => ({
          key: entry.channel,
          label: tChannels(entry.channel),
          value: entry.cost_per_conversion_micros,
          display: entry.cost_per_conversion_micros === null ? empty : (money(entry.cost_per_conversion_micros) ?? empty),
          hint: t("conversions", { count: entry.conversions }),
          color: CHANNEL_COLOR[entry.channel],
        }))}
      />
      <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        {ordered.map((entry) => (
          <div key={entry.channel} className="min-w-0">
            <dt className="truncate text-2xs text-muted-foreground">{t("spendOn", { channel: tChannels(entry.channel) })}</dt>
            <dd className="readout truncate text-sm font-semibold tabular-nums text-foreground">{money(entry.spend_micros) ?? empty}</dd>
          </div>
        ))}
      </dl>
      <p className="text-2xs text-muted-foreground">{t("note")}</p>
    </div>
  );
}
