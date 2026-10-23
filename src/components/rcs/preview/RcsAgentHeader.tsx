"use client";

import { useTranslations } from "next-intl";

import { ArrowLeft, CaretLeft, CaretRight, DotsThreeVertical, Phone, SealCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

import { AgentAvatar } from "./AgentAvatar";
import { ACCENT_TEXT, PALETTE, type RcsPreviewAgent, type RcsPreviewPlatform } from "./palette";

function VerifiedMark({ className }: { className?: string }) {
  const t = useTranslations("rcs.preview");
  return (
    <span className="inline-flex shrink-0">
      <SealCheck weight="fill" className={cn("h-4 w-4", className)} />
      <span className="sr-only">{t("verified")}</span>
    </span>
  );
}

export function RcsAgentHeader({ agent, platform }: { agent: RcsPreviewAgent; platform: RcsPreviewPlatform }) {
  const t = useTranslations("rcs.preview");
  const palette = PALETTE[platform];
  const name = agent.name.trim() || t("agentFallback");
  const verified = agent.verified ?? true;
  const avatarAlt = t("logoAlt", { name });

  if (platform === "ios") {
    return (
      <header className={cn("relative flex shrink-0 flex-col items-center gap-1 px-4 pb-2 pt-1 backdrop-blur", palette.header)}>
        <CaretLeft aria-hidden weight="bold" className="absolute left-3 top-4 h-5 w-5 text-[#007AFF] dark:text-[#0A84FF]" />
        <AgentAvatar name={name} logoUrl={agent.logoUrl} alt={avatarAlt} className="h-11 w-11 text-base" />
        <p className={cn("flex max-w-full items-center gap-0.5 text-[11px] font-medium", palette.ink)}>
          <span className="truncate">{name}</span>
          {verified ? <VerifiedMark className="h-3 w-3 text-[#007AFF] dark:text-[#0A84FF]" /> : null}
          <CaretRight aria-hidden weight="bold" className={cn("h-2.5 w-2.5", palette.muted)} />
        </p>
      </header>
    );
  }

  return (
    <header className={cn("flex shrink-0 items-center gap-3 px-3 pb-2.5 pt-1", palette.header)}>
      <ArrowLeft aria-hidden className={cn("h-5 w-5 shrink-0", palette.ink)} />
      <AgentAvatar name={name} logoUrl={agent.logoUrl} alt={avatarAlt} className="h-9 w-9 text-sm" />
      <p className={cn("flex min-w-0 flex-1 items-center gap-1 text-[15px] font-medium", palette.ink)}>
        <span className="truncate">{name}</span>
        {verified ? <VerifiedMark className={ACCENT_TEXT} /> : null}
      </p>
      <Phone aria-hidden className={cn("h-5 w-5 shrink-0", palette.ink)} />
      <DotsThreeVertical aria-hidden weight="bold" className={cn("h-5 w-5 shrink-0", palette.ink)} />
    </header>
  );
}
