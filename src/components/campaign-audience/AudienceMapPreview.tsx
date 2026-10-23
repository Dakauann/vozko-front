"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import { MapTrifold } from "@/components/icons";
import { LeadMap } from "@/components/maps/LeadMap";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { useLeadAreas } from "@/hooks/use-lead-map";
import { audienceAreaIdsOf, audienceMapSpecOf } from "@/lib/campaign-audience/map-trip";
import type { AreaShape } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

import { useAudienceMapQuery } from "./use-audience-queries";
import type { CampaignAudience } from "./use-campaign-audience";

const FRAME = "relative h-72 w-full overflow-hidden rounded-lg border border-border bg-muted";
const FIT_PADDING = 24;

export function AudienceMapPreview({ audience, onEdit }: { audience: CampaignAudience; onEdit?: () => void }) {
  const t = useTranslations("campaignAudience.step.map");
  const { can } = useWorkspace();
  const areaIds = audienceAreaIdsOf(audience.countedSpec);
  const shown = can("leads", "read_addresses") && areaIds.length > 0;
  const sample = useAudienceMapQuery(audience.channel, shown ? audienceMapSpecOf(audience.countedSpec) : null);
  const areas = useLeadAreas({ enabled: shown });
  const known = areas.data;
  const outlines = useMemo<AreaShape[]>(
    () => areaIds.flatMap((id) => known?.find((area) => area.id === id)?.shape ?? []),
    [areaIds, known],
  );

  if (!shown) return null;

  const data = sample.data;
  const shownPoints = data?.layer.kind === "points" ? data.layer.points.length : 0;
  const description = data ? (data.sampled ? t("sampled", { located: data.located, shown: shownPoints, positions: data.positions }) : t("description", { located: data.located })) : undefined;

  return (
    <PanelSection
      boxed
      title={t("title")}
      description={description}
      actions={onEdit ? <Button type="button" variant="secondary" size="sm" title={t("edit")} icon={<MapTrifold className="h-3.5 w-3.5" />} iconVisible onClick={onEdit} /> : null}
    >
      {sample.isError ? (
        <Notice tone="fault" title={t("failed")}>
          <Button type="button" variant="secondary" size="sm" title={t("retry")} onClick={() => void sample.refetch()} />
        </Notice>
      ) : !data ? (
        <div className={FRAME}>
          <ScreenLoader fit="fill" label={t("loading")} />
        </div>
      ) : (
        <div className="space-y-2">
          <div aria-busy={sample.isFetching} className={cn(FRAME, "transition-opacity duration-200", sample.isPlaceholderData && "opacity-60")}>
            <LeadMap layer={data.layer} areas={outlines} allSelected bounds={data.bounds} fitPadding={FIT_PADDING} ariaLabel={t("label")} />
          </div>
          {data.located === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
        </div>
      )}
    </PanelSection>
  );
}
