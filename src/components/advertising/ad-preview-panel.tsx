"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";

import { AdPreviewCard, type AdPreviewContent, type AdPreviewPlacement } from "./ad-preview-card";

export function AdPreviewPanel({ content, title }: { content: AdPreviewContent; title?: string }) {
  const t = useTranslations("adsWizard");
  const [placement, setPlacement] = useState<AdPreviewPlacement>("feed");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="legend">{title ?? t("previewTitle")}</p>
        <ElevatedPillToggle<AdPreviewPlacement>
          size="sm"
          value={placement}
          onChange={setPlacement}
          options={[
            { value: "feed", label: t("placement.feed") },
            { value: "story", label: t("placement.story") },
          ]}
        />
      </div>
      <div className="flex justify-center">
        <AdPreviewCard content={content} placement={placement} />
      </div>
      <p className="text-2xs text-muted-foreground">{t(placement === "story" ? "previewNoteStory" : "previewNote")}</p>
    </div>
  );
}
