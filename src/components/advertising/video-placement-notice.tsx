"use client";

import { useTranslations } from "next-intl";

import type { SkippedPlacement } from "@/lib/advertising/video-placements";

export function VideoPlacementNotice({ skipped }: { skipped: SkippedPlacement[] }) {
  const t = useTranslations("adsWizard");
  if (skipped.length === 0) return null;
  return (
    <div role="status" className="space-y-1 rounded-[--radius] border border-warning-ink/30 bg-muted px-3 py-2.5">
      <p className="text-sm font-semibold text-warning-ink">{t("preview.videoOnlyTitle", { count: skipped.length })}</p>
      <ul className="space-y-0.5 text-sm text-foreground">
        {skipped.map(({ platform, position }) => (
          <li key={`${platform}:${position}`}>
            {t(`placements.platforms.${platform}`)} · {t(`placements.positions.${position}`)}
          </li>
        ))}
      </ul>
      <p className="text-2xs text-muted-foreground">{t("preview.videoOnlyHint")}</p>
    </div>
  );
}
