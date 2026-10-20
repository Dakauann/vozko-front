"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/audience/shared";
import { VOZ_SERIES } from "@/components/charts/vozko";
import { Tag } from "@/components/icons";
import { CompositionRing, GROUPS_CHART_COLOR } from "@/components/unofficial-whatsapp-groups/kit/charts";
import { QuietEmpty } from "@/components/unofficial-whatsapp-groups/kit/empty";
import { GroupsPanel } from "@/components/unofficial-whatsapp-groups/kit/panel";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import type { CategoryCount } from "@/lib/unofficial-whatsapp-groups/types";

import { CATEGORY_REST_KEY, categoryComposition } from "./dashboard-data";

const UNCATEGORIZED_KEY = "uncategorized";
const RING_SIZE = 168;
const RING_THICKNESS = 22;

export function CategoriesPanel({ categories, loading, className }: { categories: CategoryCount[]; loading: boolean; className?: string }) {
  const t = useTranslations("unofficialGroups.dashboard.categoriesPanel");
  const fmt = useGroupsFormat();
  const composition = useMemo(() => categoryComposition(categories, VOZ_SERIES, GROUPS_CHART_COLOR.neutral), [categories]);
  const name = (category: string) => category || t("none");

  return (
    <GroupsPanel title={t("title")} subtitle={t("subtitle")} className={className}>
      {loading ? (
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-[168px] w-[168px] rounded-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : composition.total === 0 ? (
        <QuietEmpty icon={<Tag />} message={t("empty")} />
      ) : (
        <CompositionRing
          layout="stacked"
          legendColumns={2}
          size={RING_SIZE}
          thickness={RING_THICKNESS}
          slices={composition.ring.map((slice) => ({
            key: slice.key,
            label: slice.key === CATEGORY_REST_KEY ? t("others") : name(slice.category),
            value: slice.count,
            color: slice.color,
          }))}
          legend={composition.legend.map((row) => ({
            key: row.category || UNCATEGORIZED_KEY,
            label: name(row.category),
            value: row.count,
            color: row.color,
            href: groupsRoutes.all({ followed: true, category: row.category }),
          }))}
          centerValue={fmt.num(composition.total)}
          centerLabel={t("center", { count: composition.total })}
          formatValue={(value) => fmt.num(value)}
        />
      )}
    </GroupsPanel>
  );
}
