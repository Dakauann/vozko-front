"use client";

import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import ElevatedSelect, { ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import type { GroupOrigin, GroupSort } from "@/lib/unofficial-whatsapp-groups/types";

import { ActiveFilterChips, type ActiveFilter } from "../kit/filters";
import type { AllGroupsQuery } from "../kit/routes";
import { clearedQuery, withoutFilter, type ListFilterKey } from "./list-query";

const ANY = "__any__";
const NO_CATEGORY = "__none__";
const SORTS: GroupSort[] = ["recent", "oldest", "name", "name_desc", "members"];
const ORIGINS: GroupOrigin[] = ["managed", "external"];
const FOLLOW_OPTIONS = ["all", "followed", "unfollowed"] as const;
const ANALYSIS_OPTIONS = ["all", "with", "without"] as const;

type FollowOption = (typeof FOLLOW_OPTIONS)[number];
type AnalysisOption = (typeof ANALYSIS_OPTIONS)[number];

function followOption(value: boolean | undefined): FollowOption {
  if (value === undefined) return "all";
  return value ? "followed" : "unfollowed";
}

function analysisOption(value: boolean | undefined): AnalysisOption {
  if (value === undefined) return "all";
  return value ? "with" : "without";
}

function flagOf(option: string, yes: string): boolean | undefined {
  if (option === "all") return undefined;
  return option === yes;
}

export function GroupsToolbar({
  query,
  onChange,
  categories,
  numberOptions,
  resultLabel,
}: {
  query: AllGroupsQuery;
  onChange: (next: AllGroupsQuery) => void;
  categories: string[];
  numberOptions: [string, string][];
  resultLabel?: string;
}) {
  const t = useTranslations("unofficialGroups.list");
  const tOrigin = useTranslations("unofficialGroups.common.origin");
  const numberNames = new Map(numberOptions);

  const set = (patch: Partial<AllGroupsQuery>) => {
    const next: AllGroupsQuery = { ...query, ...patch };
    delete next.action;
    for (const key of Object.keys(patch) as (keyof AllGroupsQuery)[]) {
      if (patch[key] === undefined) delete next[key];
    }
    onChange(next);
  };

  const clear = (key: ListFilterKey) => () => onChange(withoutFilter(query, key));

  const chips: ActiveFilter[] = [];
  if (query.search) chips.push({ key: "search", label: t("chips.search", { value: query.search }), onClear: clear("search") });
  if (query.followed !== undefined) {
    chips.push({ key: "followed", label: t(`filters.followedOptions.${followOption(query.followed)}`), onClear: clear("followed") });
  }
  if (query.origin) chips.push({ key: "origin", label: t("chips.origin", { value: tOrigin(query.origin) }), onClear: clear("origin") });
  if (query.category !== undefined) {
    chips.push({
      key: "category",
      label: query.category ? t("chips.category", { value: query.category }) : t("filters.noCategory"),
      onClear: clear("category"),
    });
  }
  if (query.instanceId) {
    chips.push({ key: "instanceId", label: t("chips.number", { value: numberNames.get(query.instanceId) ?? query.instanceId }), onClear: clear("instanceId") });
  }
  if (query.hasAnalysis !== undefined) {
    chips.push({ key: "hasAnalysis", label: t(`filters.analysisOptions.${analysisOption(query.hasAnalysis)}`), onClear: clear("hasAnalysis") });
  }
  if (query.adminsOnly) chips.push({ key: "adminsOnly", label: t("filters.adminsOnly"), onClear: clear("adminsOnly") });

  const categoryValue = query.category === undefined ? ANY : query.category === "" ? NO_CATEGORY : query.category;
  const knownCategories = query.category && !categories.includes(query.category) ? [...categories, query.category] : categories;
  const knownNumbers = query.instanceId && !numberNames.has(query.instanceId) ? [...numberOptions, [query.instanceId, query.instanceId] as [string, string]] : numberOptions;

  return (
    <div className="w-full space-y-2">
      <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <ElevatedSelect
          label={t("filters.followed")}
          value={followOption(query.followed)}
          onValueChange={(value) => set({ followed: flagOf(value, "followed") })}
        >
          {FOLLOW_OPTIONS.map((option) => (
            <ElevatedSelectItem key={option} value={option}>
              {t(`filters.followedOptions.${option}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedSelect
          label={t("filters.origin")}
          value={query.origin ?? ANY}
          onValueChange={(value) => set({ origin: value === ANY ? undefined : (value as GroupOrigin) })}
        >
          <ElevatedSelectItem value={ANY}>{t("filters.any")}</ElevatedSelectItem>
          {ORIGINS.map((origin) => (
            <ElevatedSelectItem key={origin} value={origin}>
              {tOrigin(origin)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedSelect
          label={t("filters.category")}
          value={categoryValue}
          onValueChange={(value) => set({ category: value === ANY ? undefined : value === NO_CATEGORY ? "" : value })}
        >
          <ElevatedSelectItem value={ANY}>{t("filters.anyCategory")}</ElevatedSelectItem>
          {query.category === "" ? <ElevatedSelectItem value={NO_CATEGORY}>{t("filters.noCategory")}</ElevatedSelectItem> : null}
          {knownCategories.map((category) => (
            <ElevatedSelectItem key={category} value={category}>
              {category}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedSelect
          label={t("filters.number")}
          value={query.instanceId ?? ANY}
          onValueChange={(value) => set({ instanceId: value === ANY ? undefined : value })}
          disabled={knownNumbers.length === 0}
        >
          <ElevatedSelectItem value={ANY}>{t("filters.anyNumber")}</ElevatedSelectItem>
          {knownNumbers.map(([id, name]) => (
            <ElevatedSelectItem key={id} value={id}>
              {name}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedSelect
          label={t("filters.analysis")}
          value={analysisOption(query.hasAnalysis)}
          onValueChange={(value) => set({ hasAnalysis: flagOf(value, "with") })}
        >
          {ANALYSIS_OPTIONS.map((option) => (
            <ElevatedSelectItem key={option} value={option}>
              {t(`filters.analysisOptions.${option}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedSelect label={t("filters.sort")} value={query.sort ?? "recent"} onValueChange={(value) => set({ sort: value as GroupSort })}>
          {SORTS.map((sort) => (
            <ElevatedSelectItem key={sort} value={sort}>
              {t(`filters.sortOptions.${sort}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <label className="col-span-2 flex h-10 cursor-pointer items-center gap-2 rounded-[--radius] px-1 text-xs text-foreground md:col-span-1">
          <Checkbox checked={query.adminsOnly === true} onCheckedChange={(checked) => set({ adminsOnly: checked === true ? true : undefined })} />
          <span className="leading-tight">{t("filters.adminsOnly")}</span>
        </label>
      </div>
      <ActiveFilterChips filters={chips} onClearAll={() => onChange(clearedQuery(query))} resultLabel={resultLabel} />
    </div>
  );
}
