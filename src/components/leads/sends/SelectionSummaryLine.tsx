"use client";

import { useTranslations } from "next-intl";

import { areaFilterFieldConfig, describeLeadPredicate, leadFilterFieldConfigs } from "@/components/leads/LeadsToolbar";
import { useLeadFilterOptions } from "@/components/leads/use-lead-filter-options";
import { useLeadAreas } from "@/hooks/use-lead-map";
import type { CrmFilter } from "@/lib/crm/board";
import { readSet } from "@/lib/filters/controls";
import { LEAD_SEARCH_FIELD } from "@/lib/leads/bulk-selection";
import { LEAD_FILTER_FIELD, activeLeadPredicates, leadPredicateAddress } from "@/lib/leads/filters";

const SEPARATOR = " · ";

export function SelectionSummaryLine({ filter }: { filter: CrmFilter }) {
  const t = useTranslations("leadsPage");
  const tr = useTranslations();
  const tSelection = useTranslations("leadSends.selection");
  const options = useLeadFilterOptions({ cityKeys: readSet(filter, LEAD_FILTER_FIELD.city) });
  const hasArea = readSet(filter, LEAD_FILTER_FIELD.area).length > 0;
  const areas = useLeadAreas({ enabled: options.readsAddresses && hasArea });

  const fields = [
    ...leadFilterFieldConfigs({ filter, options, facets: null, t, tr }),
    areaFilterFieldConfig(areas.data ?? [], t("filters.fields.area")),
  ];
  const predicates = activeLeadPredicates(filter);
  const searched = predicates.filter((predicate) => leadPredicateAddress(predicate) === LEAD_SEARCH_FIELD);
  const items = [
    ...predicates.filter((predicate) => leadPredicateAddress(predicate) !== LEAD_SEARCH_FIELD).map((predicate) => describeLeadPredicate(predicate, fields, t)),
    ...searched.flatMap((predicate) => predicate.values.map((text) => tSelection("search", { text }))),
  ];

  if (items.length === 0) return null;
  return <p className="text-xs text-muted-foreground">{tSelection("summary", { items: items.join(SEPARATOR) })}</p>;
}
