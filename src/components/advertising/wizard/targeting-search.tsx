"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { searchAdTargetingAction } from "@/app/actions/advertising-create";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { AdTargetRef, AdTargetingSearchKind } from "@/lib/advertising/draft-types";

import { useAdsFormat } from "../use-ads-format";
import { RefChips, addRef, removeRef } from "./ref-chips";
import { useAdsResource } from "./use-ads-resource";

const MIN_QUERY = 2;
const SEARCH_DELAY_MS = 300;

export function TargetingSearch({
  accountId,
  kind,
  value,
  onChange,
}: {
  accountId: string;
  kind: AdTargetingSearchKind;
  value: AdTargetRef[];
  onChange: (refs: AdTargetRef[]) => void;
}) {
  const t = useTranslations("adsWizard.audience");
  const fmt = useAdsFormat();
  const [query, setQuery] = useState("");
  const settled = useDebouncedValue(query.trim(), SEARCH_DELAY_MS);
  const key = accountId && settled.length >= MIN_QUERY ? `${accountId}:${kind}:${settled}` : null;
  const results = useAdsResource(key, () => searchAdTargetingAction(accountId, kind, settled));
  const items = results.status === "ready" ? results.data : [];

  return (
    <div className="space-y-2">
      <ElevatedCommandSelect
        label={t(`kinds.${kind}`)}
        fullWidth
        value={null}
        onSearch={setQuery}
        isLoading={results.status === "loading" || (query.trim().length >= MIN_QUERY && query.trim() !== settled)}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={results.status === "error" ? results.message : settled.length < MIN_QUERY ? t("typeToSearch") : t("noResults")}
        options={items.map((item) => ({
          value: item.id,
          label: item.name,
          description: item.path && item.path.length > 0 ? item.path.join(" > ") : undefined,
          meta:
            item.audienceMin && item.audienceMax
              ? t("sizeRange", { lower: fmt.count(item.audienceMin), upper: fmt.count(item.audienceMax) })
              : undefined,
          disabled: value.some((ref) => ref.id === item.id),
        }))}
        onValueChange={(id, option) => onChange(addRef(value, { id, name: option.label }))}
      />
      <RefChips refs={value} removeLabel={(name) => t("remove", { name })} onRemove={(ref) => onChange(removeRef(value, ref))} />
    </div>
  );
}
