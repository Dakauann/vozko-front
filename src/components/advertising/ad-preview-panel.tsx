"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { FacebookLogo, InstagramLogo } from "@/components/icons";
import { PLACEMENT_FILTERS, placementsFor, type PlacementFilter, type PreviewPlacementSpec } from "@/lib/advertising/preview-placements";
import { PREVIEW_TILE_WIDTH, PREVIEW_TILE_ZOOM } from "@/lib/advertising/preview-spec";

import { AdPreviewCard, type AdPreviewContent } from "./ad-preview-card";
import { DestinationPreview } from "./editor/destination-preview";

type PreviewTab = "ad" | "destination";

const PLATFORM_ICONS = { facebook: FacebookLogo, instagram: InstagramLogo };

function PlacementTile({ content, spec, safeZone }: { content: AdPreviewContent; spec: PreviewPlacementSpec; safeZone: boolean }) {
  const t = useTranslations("adsWizard.placements");
  const Icon = PLATFORM_ICONS[spec.platform];
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <p className="flex min-w-0 items-center gap-1.5 text-2xs font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{t(spec.id)}</span>
      </p>
      <div className="flex justify-center rounded-[--radius] bg-muted p-2">
        <div style={{ width: PREVIEW_TILE_WIDTH, zoom: PREVIEW_TILE_ZOOM }}>
          <AdPreviewCard content={content} placement={spec.id} safeZone={safeZone} />
        </div>
      </div>
    </li>
  );
}

export function AdPreviewPanel({ content, title, destination }: { content: AdPreviewContent; title?: string; destination?: ReactNode }) {
  const t = useTranslations("adsWizard");
  const tEditor = useTranslations("adsEditor.preview");
  const [filter, setFilter] = useState<PlacementFilter>("all");
  const [tab, setTab] = useState<PreviewTab>("ad");
  const [safeZone, setSafeZone] = useState(false);
  const placements = placementsFor(filter, content.format);
  const vertical = placements.some((spec) => spec.group === "vertical");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="legend">{title ?? t("previewTitle")}</p>
        <Tabs value={tab} onValueChange={(value) => setTab(value as PreviewTab)}>
          <TabsList>
            <TabsTrigger value="ad">{tEditor("ad")}</TabsTrigger>
            <TabsTrigger value="destination">{tEditor("destination")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {tab === "ad" ? (
        <>
          <ElevatedPillToggle<PlacementFilter>
            size="sm"
            value={filter}
            onChange={setFilter}
            options={PLACEMENT_FILTERS.map((value) => ({ value, label: t(`placementFilter.${value}`) }))}
          />
          <ul className="grid grid-cols-2 gap-3">
            {placements.map((spec) => (
              <PlacementTile key={spec.id} content={content} spec={spec} safeZone={safeZone} />
            ))}
          </ul>
          {vertical ? <ElevatedSwitch checked={safeZone} onCheckedChange={setSafeZone} label={t("preview.showSafeZone")} description={t("preview.safeZoneHint")} /> : null}
          <p className="text-2xs text-muted-foreground">{t("previewNote")}</p>
        </>
      ) : (
        (destination ?? <DestinationPreview content={content} />)
      )}
    </div>
  );
}
