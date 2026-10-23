"use client";

import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { DeviceMobile } from "@/components/icons";

import { RCS_PREVIEW_PLATFORMS, type RcsPreviewPlatform } from "./palette";

export function PlatformToggle({ value, onChange }: { value: RcsPreviewPlatform; onChange: (platform: RcsPreviewPlatform) => void }) {
  const t = useTranslations("carrierMessaging.preview");
  return (
    <ElevatedPillToggle<RcsPreviewPlatform>
      size="sm"
      aria-label={t("platformLabel")}
      value={value}
      onChange={onChange}
      options={RCS_PREVIEW_PLATFORMS.map((platform) => ({
        value: platform,
        label: t(`platforms.${platform}`),
        icon: <DeviceMobile aria-hidden className="h-3.5 w-3.5" />,
      }))}
    />
  );
}

export function PreviewHeading({ title, platform, onPlatformChange }: { title: string; platform: RcsPreviewPlatform; onPlatformChange: (platform: RcsPreviewPlatform) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="legend">{title}</p>
      <PlatformToggle value={platform} onChange={onPlatformChange} />
    </div>
  );
}
