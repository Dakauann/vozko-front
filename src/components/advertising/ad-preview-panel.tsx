"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { CaretLeft, CaretRight, FacebookLogo, InstagramLogo } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  PLACEMENT_FILTERS,
  placementsFor,
  stepPlacement,
  type PlacementFilter,
  type PreviewPlacementId,
  type PreviewPlacementSpec,
} from "@/lib/advertising/preview-placements";
import { PREVIEW_ENLARGED_ZOOM, PREVIEW_TILE_WIDTH, PREVIEW_TILE_ZOOM } from "@/lib/advertising/preview-spec";

import { AdPreviewCard, type AdPreviewContent } from "./ad-preview-card";
import { DestinationPreview } from "./editor/destination-preview";

type PreviewTab = "ad" | "destination";

const PLATFORM_ICONS = { facebook: FacebookLogo, instagram: InstagramLogo };

function PlacementName({ spec }: { spec: PreviewPlacementSpec }) {
  const t = useTranslations("adsWizard.placements");
  const Icon = PLATFORM_ICONS[spec.platform];
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{t(spec.id)}</span>
    </span>
  );
}

function PlacementTile({
  content,
  spec,
  safeZone,
  onEnlarge,
}: {
  content: AdPreviewContent;
  spec: PreviewPlacementSpec;
  safeZone: boolean;
  onEnlarge: () => void;
}) {
  const t = useTranslations("adsWizard");
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <p className="text-2xs font-semibold text-muted-foreground">
        <PlacementName spec={spec} />
      </p>
      <button
        type="button"
        onClick={onEnlarge}
        aria-label={t("preview.zoom", { placement: t(`placements.${spec.id}`) })}
        title={t("preview.zoom", { placement: t(`placements.${spec.id}`) })}
        className="flex cursor-zoom-in justify-center rounded-[--radius] bg-muted p-2 transition-shadow duration-DEFAULT hover:ring-1 hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div style={{ width: PREVIEW_TILE_WIDTH, zoom: PREVIEW_TILE_ZOOM }} className="pointer-events-none" aria-hidden>
          <AdPreviewCard content={content} placement={spec.id} safeZone={safeZone} />
        </div>
      </button>
    </li>
  );
}

function EnlargedPlacement({
  content,
  placements,
  current,
  safeZone,
  onChange,
}: {
  content: AdPreviewContent;
  placements: PreviewPlacementSpec[];
  current: PreviewPlacementId | null;
  safeZone: boolean;
  onChange: (next: PreviewPlacementId | null) => void;
}) {
  const t = useTranslations("adsWizard.preview");
  const spec = placements.find((candidate) => candidate.id === current) ?? null;
  const step = (delta: number) => current && onChange(stepPlacement(placements, current, delta));
  return (
    <Dialog open={spec !== null} onOpenChange={(open) => !open && onChange(null)}>
      <DialogContent
        className="max-h-[92dvh] max-w-md overflow-y-auto"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") step(1);
          if (event.key === "ArrowLeft") step(-1);
        }}
      >
        {spec ? (
          <>
            <DialogTitle className="text-sm">
              <PlacementName spec={spec} />
            </DialogTitle>
            <DialogDescription className="sr-only">{t("zoomHint")}</DialogDescription>
            <div className="flex justify-center rounded-[--radius] bg-muted p-3">
              <div style={{ width: PREVIEW_TILE_WIDTH, zoom: PREVIEW_ENLARGED_ZOOM }}>
                <AdPreviewCard content={content} placement={spec.id} safeZone={safeZone} />
              </div>
            </div>
            {placements.length > 1 ? (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[--radius] px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CaretLeft className="h-4 w-4" aria-hidden />
                  {t("previousPlacement")}
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[--radius] px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("nextPlacement")}
                  <CaretRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AdPreviewPanel({
  content,
  title,
  destination,
  notice,
}: {
  content: AdPreviewContent;
  title?: string;
  destination?: ReactNode;
  notice?: ReactNode;
}) {
  const t = useTranslations("adsWizard");
  const tEditor = useTranslations("adsEditor.preview");
  const [filter, setFilter] = useState<PlacementFilter>("all");
  const [tab, setTab] = useState<PreviewTab>("ad");
  const [safeZone, setSafeZone] = useState(false);
  const [enlarged, setEnlarged] = useState<PreviewPlacementId | null>(null);
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
          {notice}
          <ElevatedPillToggle<PlacementFilter>
            size="sm"
            value={filter}
            onChange={setFilter}
            options={PLACEMENT_FILTERS.map((value) => ({ value, label: t(`placementFilter.${value}`) }))}
          />
          <ul className="grid grid-cols-2 gap-3">
            {placements.map((spec) => (
              <PlacementTile key={spec.id} content={content} spec={spec} safeZone={safeZone} onEnlarge={() => setEnlarged(spec.id)} />
            ))}
          </ul>
          <EnlargedPlacement content={content} placements={placements} current={enlarged} safeZone={safeZone} onChange={setEnlarged} />
          {vertical ? <ElevatedSwitch checked={safeZone} onCheckedChange={setSafeZone} label={t("preview.showSafeZone")} description={t("preview.safeZoneHint")} /> : null}
          <p className="text-2xs text-muted-foreground">{t("previewNote")}</p>
        </>
      ) : (
        (destination ?? <DestinationPreview content={content} />)
      )}
    </div>
  );
}
