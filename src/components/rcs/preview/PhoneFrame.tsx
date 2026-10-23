"use client";

import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";

import { WifiHigh } from "@/components/icons";
import { cn } from "@/lib/utils";

import { IOS_FONT, PALETTE, type RcsPreviewPlatform } from "./palette";

export const CLOCK = "9:41";

function Battery() {
  return (
    <span aria-hidden className="relative inline-flex h-[11px] w-[22px] items-center rounded-[3px] border border-current p-[1.5px] opacity-90">
      <span className="h-full w-[72%] rounded-[1.5px] bg-current" />
      <span className="absolute -right-[3px] top-1/2 h-[4px] w-[1.5px] -translate-y-1/2 rounded-r-sm bg-current" />
    </span>
  );
}

function StatusBar({ platform }: { platform: RcsPreviewPlatform }) {
  const palette = PALETTE[platform];
  const ios = platform === "ios";
  return (
    <div aria-hidden className={cn("relative flex h-9 shrink-0 items-center justify-between px-6 text-[13px] font-semibold tabular-nums", palette.ink)}>
      <span className={ios ? "pl-2" : undefined}>{CLOCK}</span>
      {ios ? (
        <span className="absolute left-1/2 top-2 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
      ) : (
        <span className="absolute left-1/2 top-3 h-3 w-3 -translate-x-1/2 rounded-full bg-black/90 ring-2 ring-black/10 dark:bg-black dark:ring-white/10" />
      )}
      <span className="flex items-center gap-1.5">
        <WifiHigh className="h-3.5 w-3.5" weight="bold" />
        <Battery />
      </span>
    </div>
  );
}

export function PhoneFrame({
  platform,
  label,
  style,
  className,
  children,
}: {
  platform: RcsPreviewPlatform;
  label: string;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  const ios = platform === "ios";
  return (
    <figure
      style={{ ...style, ...(ios ? IOS_FONT : {}) }}
      className={cn(
        "mx-auto w-full max-w-[340px] rounded-[2.6rem] bg-[#1B1B1F] p-[7px] shadow-[0_24px_48px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/10 dark:bg-[#2B2B30] dark:ring-white/10",
        className,
      )}
    >
      <div className={cn("flex h-[min(620px,78vh)] min-h-[440px] flex-col overflow-hidden rounded-[2.15rem]", PALETTE[platform].screen)}>
        <StatusBar platform={platform} />
        {children}
        <div aria-hidden className="flex h-5 shrink-0 items-center justify-center">
          <span className={cn("h-1 rounded-full", ios ? "w-28 bg-black/80 dark:bg-white/70" : "w-20 bg-black/40 dark:bg-white/40")} />
        </div>
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

export function ThreadStamp({ platform, channel }: { platform: RcsPreviewPlatform; channel: string }) {
  const t = useTranslations("carrierMessaging.preview");
  const palette = PALETTE[platform];
  return (
    <p className={cn("pb-3 text-center text-[11px]", palette.muted)}>
      {platform === "ios" ? <span className="block font-medium">{channel}</span> : null}
      <span className="block">{t("today", { time: CLOCK })}</span>
    </p>
  );
}
