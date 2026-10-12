"use client";

import { useFormatter, useTranslations } from "next-intl";

import { ArrowCounterClockwise, Pause } from "@/components/icons";
import { clipSpeed, hasSpeedCurve } from "@/lib/studio/clip-time";
import type { Clip } from "@/lib/studio/document";

export function SpeedBadge({ clip }: { clip: Pick<Clip, "speed" | "reverse" | "freeze" | "keyframes"> }) {
  const t = useTranslations("studio.video.speed");
  const format = useFormatter();
  const speed = clipSpeed(clip);
  if (clip.freeze) return <Pause className="h-2.5 w-2.5 shrink-0" aria-label={t("frozenBadge")} />;
  const curved = hasSpeedCurve(clip);
  if (speed === 1 && !clip.reverse && !curved) return null;
  return (
    <span className="flex shrink-0 items-center gap-0.5 text-2xs font-semibold leading-4 tabular-nums">
      {clip.reverse ? <ArrowCounterClockwise className="h-2.5 w-2.5" aria-label={t("reversedBadge")} /> : null}
      {curved ? t("curveBadge") : speed !== 1 ? t("badge", { speed: format.number(speed, { maximumFractionDigits: 2 }) }) : null}
    </span>
  );
}
