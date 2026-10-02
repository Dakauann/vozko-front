"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { isAdsError, searchAdLocationsAction } from "@/app/actions/advertising";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { MagnifyingGlass, MapPin, Plus, X } from "@/components/icons";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { MAX_CITY_RADIUS_KM } from "@/lib/advertising/draft";
import type { AdDraftGeoLocation } from "@/lib/advertising/draft-types";
import type { AdLocation } from "@/lib/advertising/types";

const MIN_QUERY = 2;
const SEARCH_DELAY_MS = 300;

interface SearchResult {
  query: string;
  items: AdLocation[];
  error: string | null;
}

function describe(location: AdLocation): string {
  return [location.name, location.region, location.country].filter(Boolean).join(", ");
}

export function LocationPicker({
  accountId,
  value,
  minRadius,
  label,
  onChange,
}: {
  accountId: string;
  value: AdDraftGeoLocation[];
  minRadius: number;
  label: string;
  onChange: (locations: AdDraftGeoLocation[]) => void;
}) {
  const t = useTranslations("adsWizard.audience");
  const [query, setQuery] = useState("");
  const settled = useDebouncedValue(query.trim(), SEARCH_DELAY_MS);
  const [result, setResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!accountId || settled.length < MIN_QUERY) return;
    let cancelled = false;
    void searchAdLocationsAction(accountId, settled).then((response) => {
      if (cancelled) return;
      setResult(
        isAdsError(response) ? { query: settled, items: [], error: response.error } : { query: settled, items: response.data, error: null },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, settled]);

  const searching = settled.length >= MIN_QUERY && result?.query !== settled;
  const visible = settled.length >= MIN_QUERY && result?.query === settled ? result : null;
  const chosen = new Set(value.map((location) => `${location.kind}:${location.key}`));

  const add = (location: AdLocation) => {
    const next: AdDraftGeoLocation = {
      kind: location.kind,
      key: location.key,
      name: describe(location),
      radiusKm: location.kind === "city" ? minRadius : undefined,
    };
    onChange([...value, next]);
    setQuery("");
  };

  const remove = (target: AdDraftGeoLocation) => {
    onChange(value.filter((location) => !(location.kind === target.kind && location.key === target.key)));
  };

  const setRadius = (target: AdDraftGeoLocation, radiusKm: number) => {
    onChange(
      value.map((location) => (location.kind === target.kind && location.key === target.key ? { ...location, radiusKm } : location)),
    );
  };

  return (
    <div className="space-y-2">
      <ElevatedInput
        label={label}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        icon={<MagnifyingGlass className="h-4 w-4" />}
        autoComplete="off"
      />
      {searching ? <p className="text-xs text-muted-foreground">{t("searching")}</p> : null}
      {visible?.error ? <p className="text-xs text-destructive-ink">{visible.error}</p> : null}
      {visible && !visible.error && visible.items.length === 0 ? <p className="text-xs text-muted-foreground">{t("noLocations")}</p> : null}
      {visible && visible.items.length > 0 ? (
        <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-[--radius] border border-border-strong bg-card shadow-lg">
          {visible.items.map((location) => {
            const already = chosen.has(`${location.kind}:${location.key}`);
            return (
              <li key={`${location.kind}-${location.key}`}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => add(location)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-[hsl(var(--accent-hover))] disabled:cursor-default disabled:opacity-50"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{describe(location)}</span>
                  <span className="text-2xs text-muted-foreground">{t(`kind.${location.kind}`)}</span>
                  {!already ? <Plus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {value.length > 0 ? (
        <ul className="space-y-1.5">
          {value.map((location) => (
            <li
              key={`${location.kind}-${location.key}`}
              className="flex flex-wrap items-center gap-2 rounded-[--radius] border border-border bg-muted px-3 py-1.5"
            >
              <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{location.name}</span>
              <span className="text-2xs text-muted-foreground">{t(`kind.${location.kind}`)}</span>
              {location.kind === "city" ? (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {t("radius")}
                  <input
                    type="number"
                    min={minRadius}
                    max={MAX_CITY_RADIUS_KM}
                    value={location.radiusKm ?? minRadius}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next)) setRadius(location, next);
                    }}
                    onBlur={() => setRadius(location, Math.min(MAX_CITY_RADIUS_KM, Math.max(minRadius, location.radiusKm ?? minRadius)))}
                    className="h-7 w-16 rounded-[--radius] border border-control-edge bg-card px-2 text-right text-xs tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-muted"
                  />
                  km
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => remove(location)}
                aria-label={t("removeLocation", { name: location.name })}
                className="inline-flex h-6 w-6 items-center justify-center rounded-[--radius] text-muted-foreground hover:bg-card hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
