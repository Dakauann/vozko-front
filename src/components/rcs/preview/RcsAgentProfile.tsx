"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { EnvelopeSimple, Globe, Phone, SealCheck, type Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { AgentAvatar } from "./AgentAvatar";
import { ACCENT_TEXT, PALETTE, accentStyle, type RcsPreviewAgent, type RcsPreviewPlatform } from "./palette";
import { PhoneFrame } from "./PhoneFrame";
import { PreviewHeading } from "./PlatformToggle";
import { RcsAgentHeader } from "./RcsAgentHeader";

export interface RcsAgentContact {
  website?: string;
  phone?: string;
  email?: string;
}

function ContactRow({ icon: Glyph, value, platform }: { icon: Icon; value: string; platform: RcsPreviewPlatform }) {
  const palette = PALETTE[platform];
  return (
    <li className={cn("flex items-center gap-3 border-t px-4 py-3 text-[13px]", palette.cardRule, palette.ink)}>
      <Glyph aria-hidden className={cn("h-4 w-4 shrink-0", platform === "ios" ? "text-[#007AFF] dark:text-[#0A84FF]" : ACCENT_TEXT)} />
      <span className="min-w-0 truncate">{value}</span>
    </li>
  );
}

function Banner({ url, alt }: { url?: string; alt: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span className="relative block aspect-[1440/448] w-full overflow-hidden bg-[color:var(--rcs-accent)]">
      {url && failedUrl !== url ? (
        <Image src={url} alt={alt} fill unoptimized sizes="340px" className="object-cover" onError={() => setFailedUrl(url)} />
      ) : (
        <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
      )}
    </span>
  );
}

export function RcsAgentProfile({ agent, contact = {}, className }: { agent: RcsPreviewAgent; contact?: RcsAgentContact; className?: string }) {
  const t = useTranslations("rcs.preview");
  const [platform, setPlatform] = useState<RcsPreviewPlatform>("android");
  const palette = PALETTE[platform];
  const name = agent.name.trim() || t("agentFallback");
  const rows: [Icon, string | undefined][] = [
    [Globe, contact.website],
    [Phone, contact.phone],
    [EnvelopeSimple, contact.email],
  ];
  const filled = rows.filter((row): row is [Icon, string] => Boolean(row[1]?.trim()));

  return (
    <section aria-label={t("profile.label")} className={cn("min-w-0 space-y-3", className)}>
      <PreviewHeading title={t("profile.label")} platform={platform} onPlatformChange={setPlatform} />
      <PhoneFrame platform={platform} label={t(`profile.frame.${platform}`)} style={accentStyle(agent.color)}>
        <RcsAgentHeader agent={agent} platform={platform} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Banner url={agent.bannerUrl} alt={t("bannerAlt", { name })} />
          <div className="-mt-9 flex flex-col items-center px-5 text-center">
            <AgentAvatar name={name} logoUrl={agent.logoUrl} alt={t("logoAlt", { name })} className="h-[72px] w-[72px] text-2xl ring-4 ring-white dark:ring-[#131314]" />
            <p className={cn("mt-2 flex items-center gap-1 text-lg font-semibold", palette.ink)}>
              <span className="break-words">{name}</span>
              <SealCheck aria-hidden weight="fill" className={cn("h-4 w-4 shrink-0", platform === "ios" ? "text-[#007AFF] dark:text-[#0A84FF]" : ACCENT_TEXT)} />
            </p>
            <p className={cn("mt-1 text-[13px] leading-snug", palette.muted)}>{agent.description?.trim() || t("profile.descriptionFallback")}</p>
            <p className={cn("mt-2 text-[11px] font-medium", palette.muted)}>{t("verified")}</p>
          </div>
          {filled.length > 0 ? (
            <ul className="mt-5">
              {filled.map(([glyph, value]) => (
                <ContactRow key={value} icon={glyph} value={value} platform={platform} />
              ))}
            </ul>
          ) : null}
        </div>
      </PhoneFrame>
    </section>
  );
}
