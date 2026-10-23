"use client";

import { useTranslations } from "next-intl";

import { CampaignStatusChip } from "@/components/campaigns/CampaignStatusChip";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ChatCircle, ChatText, WhatsappLogo, type Icon } from "@/components/icons";
import type { SpendChannel } from "@/lib/carrier-messaging/analytics";
import type { CampaignStatus } from "@/lib/carrier-messaging/campaigns";
import { cn } from "@/lib/utils";

const CHANNEL_GLYPHS: Record<SpendChannel, Icon> = { rcs: ChatText, sms: ChatCircle, whatsapp: WhatsappLogo };

export function CarrierChannelLabel({ channel, className }: { channel: SpendChannel; className?: string }) {
  const t = useTranslations("carrierMessaging.channels");
  const Glyph = CHANNEL_GLYPHS[channel];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-foreground", className)}>
      <Glyph aria-hidden className="h-4 w-4 text-muted-foreground" />
      {t(channel)}
    </span>
  );
}

export function CarrierChannelChip({ channel }: { channel: SpendChannel }) {
  const t = useTranslations("carrierMessaging.channels");
  const Glyph = CHANNEL_GLYPHS[channel];
  return <StatusChip tone="outline" label={t(channel)} icon={<Glyph aria-hidden className="h-3 w-3 text-muted-foreground" />} />;
}

export function CarrierCampaignStatusChip({ status, className }: { status: CampaignStatus; className?: string }) {
  const t = useTranslations("carrierMessaging.campaignStatus");
  return <CampaignStatusChip status={status.toUpperCase()} label={t(status)} className={className} />;
}
