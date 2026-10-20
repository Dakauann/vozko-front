"use client";

import { useTranslations } from "next-intl";

import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ChannelLogo } from "@/components/icons/channel-logos";
import { useChannelName } from "@/hooks/use-channel-name";
import { UsersFour } from "@/components/icons";
import { customerLines, type PortfolioRow } from "@/lib/customer-portfolio/portfolio";

export function PortfolioCustomerCell({ row }: { row: PortfolioRow }) {
  const { primary, secondary } = customerLines(row);
  const { avatarUrl, channel } = row.display;

  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="relative shrink-0">
        <ChannelAvatarImage name={primary || "?"} seed={row.id} url={avatarUrl} className="h-9 w-9 rounded-full" textClassName="text-sm" />
        {channel ? (
          <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card">
            <ChannelLogo channel={channel} className="h-2.5 w-2.5" />
          </span>
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{primary || <EmptyValue />}</span>
        {secondary ? <span className="block truncate text-xs text-muted-foreground">{secondary}</span> : null}
      </span>
    </span>
  );
}

export function PortfolioReachCell({ row }: { row: PortfolioRow }) {
  const t = useTranslations("customerPortfolio.reach");
  const channelName = useChannelName();
  if (row.subject.kind === "lead") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-foreground">
        <UsersFour className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        {t("lead")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-foreground">
      <ChannelLogo channel={row.subject.contactType} className="h-3.5 w-3.5" />
      {t("contact", { channel: channelName(row.subject.contactType) ?? row.subject.contactType })}
    </span>
  );
}
