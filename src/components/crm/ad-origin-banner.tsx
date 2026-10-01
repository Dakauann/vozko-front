"use client";

import { useTranslations } from "next-intl";

import { ArrowSquareOut, FacebookLogo, InstagramLogo, Megaphone } from "@/components/icons";
import type { AdOrigin } from "@/lib/conversations/ad-origin";

const PLATFORM_ICON = {
  instagram: InstagramLogo,
  facebook: FacebookLogo,
} as const;

export function AdOriginBanner({ origin }: { origin: AdOrigin }) {
  const t = useTranslations("crmAdOrigin");
  const PlatformIcon = origin.platform ? PLATFORM_ICON[origin.platform] : Megaphone;

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[--radius] bg-muted">
        {origin.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={origin.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <PlatformIcon className="h-5 w-5" aria-hidden />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
          <PlatformIcon className="h-3 w-3 shrink-0" aria-hidden />
          {origin.platform ? t(`cameFrom.${origin.platform}`) : t("cameFrom.unknown")}
        </span>
        <span className="block truncate text-sm font-semibold text-foreground">{origin.title ?? t("untitled")}</span>
      </span>
      {origin.sourceUrl ? (
        <a
          href={origin.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary-ink hover:underline"
        >
          {t("open")}
          <ArrowSquareOut className="h-3.5 w-3.5" weight="bold" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
