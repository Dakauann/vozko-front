"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ArrowRight, ChatCircle, ChatText, Clock, Hourglass, Image as ImageGlyph, Prohibit, SealCheck, Stack, type Icon } from "@/components/icons";
import { CARRIER_CHANNELS, type CarrierChannel } from "@/lib/carrier-messaging/types";
import { useCarrierChannels, type CarrierChannelsState } from "@/lib/carrier-messaging/use-carrier-channels";
import { cn } from "@/lib/utils";

const SMS_SENDERS_PATH = "/dashboard/rcs-sms/sms-senders";

export type ComingSoonVariant = CarrierChannel | "all";

function anyLaunched(channels: CarrierChannelsState): boolean {
  return CARRIER_CHANNELS.some((channel) => channels.launched(channel));
}

export function ComingSoonChip({ className }: { className?: string }) {
  const t = useTranslations("carrierMessaging.comingSoon");
  return <StatusChip tone="muted" label={t("chip")} className={cn("shrink-0 whitespace-nowrap rounded-full border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] leading-none normal-case tracking-normal", className)} />;
}

export function CarrierSoonChip({ channel, className }: { channel: CarrierChannel; className?: string }) {
  const channels = useCarrierChannels();
  if (channels.status === "loading" || channels.launched(channel) || !anyLaunched(channels)) return null;
  return <ComingSoonChip className={className} />;
}

export function CarrierAreaSoonChip({ className }: { className?: string }) {
  const channels = useCarrierChannels();
  if (channels.status === "loading" || anyLaunched(channels)) return null;
  return <ComingSoonChip className={className} />;
}

type PerkKey = "first" | "second" | "third";

const PERK_ICONS: Record<ComingSoonVariant, Record<PerkKey, Icon>> = {
  rcs: { first: SealCheck, second: ImageGlyph, third: Stack },
  sms: { first: ChatCircle, second: Prohibit, third: Clock },
  all: { first: SealCheck, second: ChatCircle, third: Stack },
};

const PERKS: readonly PerkKey[] = ["first", "second", "third"];

export function ComingSoonPanel({ variant, className, compact = false }: { variant: ComingSoonVariant; className?: string; compact?: boolean }) {
  const t = useTranslations(`carrierMessaging.comingSoon.${variant}`);
  const channels = useCarrierChannels();
  const showsSms = variant === "rcs" && channels.launched("sms");
  return (
    <section aria-labelledby={`coming-soon-${variant}`} className={cn("overflow-hidden rounded-[--radius] border border-border bg-card", className)}>
      <div className={cn("flex flex-col gap-5", compact ? "p-5" : "p-6 sm:p-8")}>
        <div className="flex items-start gap-4">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius] border border-control-edge bg-muted text-foreground">
            <Hourglass className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`coming-soon-${variant}`} className="font-display text-lg font-semibold leading-tight text-foreground">
                {t("title")}
              </h2>
              <ComingSoonChip />
            </div>
            <p className="max-w-[62ch] text-sm text-muted-foreground">{t("body")}</p>
          </div>
        </div>
        {compact ? null : (
          <ul className="grid gap-3 sm:grid-cols-3">
            {PERKS.map((key) => {
              const Glyph = PERK_ICONS[variant][key];
              return (
                <li key={key} className="flex items-start gap-3 rounded-[--radius] border border-border px-3 py-3">
                  <Glyph aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{t(`perks.${key}.title`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`perks.${key}.body`)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {showsSms ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <p className="min-w-0 flex-1 text-sm text-foreground">{t("smsNow")}</p>
            <Button
              variant="outline"
              size="sm"
              title={t("toSms")}
              icon={<ArrowRight className="h-3.5 w-3.5" />}
              iconVisible
              iconSide="right"
              link={SMS_SENDERS_PATH}
              newTab={false}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ComingSoonPage({ variant, badge, description }: { variant: ComingSoonVariant; badge: string; description: string }) {
  return (
    <motion.main className="w-full space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <DashboardPageHeader icon={<ChatText className="h-6 w-6" weight="fill" />} badge={badge} description={description} meta={<ComingSoonChip />} />
      <ComingSoonPanel variant={variant} />
    </motion.main>
  );
}

export function CarrierChannelGate({ channel, soon, children }: { channel: CarrierChannel; soon: ReactNode; children: ReactNode }) {
  const channels = useCarrierChannels();
  if (channels.status === "loading") return <ScreenLoader fit="screen" />;
  return <>{channels.launched(channel) ? children : soon}</>;
}

export function CarrierAreaGate({ badge, description, children }: { badge: string; description: string; children: ReactNode }) {
  const channels = useCarrierChannels();
  if (channels.status === "loading") return <ScreenLoader fit="screen" />;
  return <>{anyLaunched(channels) ? children : <ComingSoonPage variant="all" badge={badge} description={description} />}</>;
}
