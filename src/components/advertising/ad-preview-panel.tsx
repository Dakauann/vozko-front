"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { Tabs, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";

import { AdPreviewCard, type AdPreviewContent, type AdPreviewPlacement } from "./ad-preview-card";
import { DestinationPreview } from "./editor/destination-preview";

type PreviewTab = "ad" | "destination";

export function AdPreviewPanel({ content, title, destination }: { content: AdPreviewContent; title?: string; destination?: ReactNode }) {
  const t = useTranslations("adsWizard");
  const tEditor = useTranslations("adsEditor.preview");
  const [placement, setPlacement] = useState<AdPreviewPlacement>("feed");
  const [tab, setTab] = useState<PreviewTab>("ad");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="legend">{title ?? t("previewTitle")}</p>
        {tab === "ad" ? (
          <ElevatedPillToggle<AdPreviewPlacement>
            size="sm"
            value={placement}
            onChange={setPlacement}
            options={[
              { value: "feed", label: t("placement.feed") },
              { value: "story", label: t("placement.story") },
            ]}
          />
        ) : null}
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as PreviewTab)}>
        <TabsList>
          <TabsTrigger value="ad">{tEditor("ad")}</TabsTrigger>
          <TabsTrigger value="destination">{tEditor("destination")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "ad" ? (
        <>
          <div className="flex justify-center">
            <AdPreviewCard content={content} placement={placement} />
          </div>
          <p className="text-2xs text-muted-foreground">{t(placement === "story" ? "previewNoteStory" : "previewNote")}</p>
        </>
      ) : (
        (destination ?? <DestinationPreview content={content} />)
      )}
    </div>
  );
}
