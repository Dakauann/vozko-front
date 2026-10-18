"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/audience/shared";
import { Tag } from "@/components/icons";
import { RankedList } from "@/components/unofficial-whatsapp-groups/kit/charts";
import { GroupsPanel } from "@/components/unofficial-whatsapp-groups/kit/panel";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import type { CategoryCount } from "@/lib/unofficial-whatsapp-groups/types";

import { categoryRanking } from "./dashboard-data";

const UNCATEGORIZED_KEY = "uncategorized";

export function CategoriesPanel({ categories, loading, className }: { categories: CategoryCount[]; loading: boolean; className?: string }) {
  const t = useTranslations("unofficialGroups.dashboard.categoriesPanel");
  const fmt = useGroupsFormat();
  const ranking = useMemo(() => categoryRanking(categories), [categories]);

  return (
    <GroupsPanel title={t("title")} subtitle={t("subtitle")} className={className}>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-7 w-full" />
          ))}
        </div>
      ) : (
        <RankedList
          emphasis="first"
          empty={{ icon: <Tag />, message: t("empty") }}
          rows={ranking.map((item) => ({
            key: item.category || UNCATEGORIZED_KEY,
            label: item.category || t("none"),
            value: item.count,
            display: fmt.num(item.count),
            hint: item.share === null ? undefined : t("share", { share: fmt.pct(item.share, 0) }),
            href: groupsRoutes.all({ followed: true, category: item.category }),
          }))}
        />
      )}
    </GroupsPanel>
  );
}
