"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Funnel, MagnifyingGlass, X } from "@/components/icons";
import { PlaceCombobox } from "@/components/places/PlaceCombobox";
import { useWorkspace } from "@/contexts/workspace-context";
import { emptyCrmFilter, type CrmFilter } from "@/lib/crm/board";
import { parseRecentPlaces, placeAddsFilter, placeFilterOf, recentPlacesKey, withRecentPlace, type Place } from "@/lib/maps/places";
import { cn } from "@/lib/utils";

export { placeFilterOf };
export type { Place };

export interface MapPlaceSearchProps {
  onSelect: (place: Place) => void;
  onFilter?: (place: Place) => void;
  filter?: CrmFilter;
  state?: string;
  className?: string;
}

function readRecent(workspaceId: string): Place[] {
  if (!workspaceId) return [];
  try {
    return parseRecentPlaces(window.sessionStorage.getItem(recentPlacesKey(workspaceId)));
  } catch {
    return [];
  }
}

function writeRecent(workspaceId: string, places: Place[]) {
  if (!workspaceId) return;
  try {
    window.sessionStorage.setItem(recentPlacesKey(workspaceId), JSON.stringify(places));
  } catch {
    return;
  }
}

export function MapPlaceSearch({ onSelect, onFilter, filter = emptyCrmFilter, state, className }: MapPlaceSearchProps) {
  const t = useTranslations("places.mapSearch");
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<Place | null>(null);
  const [recentOf, setRecentOf] = useState<{ workspaceId: string; places: Place[] } | null>(null);

  const recent = recentOf?.workspaceId === workspaceId ? recentOf.places : [];

  const loadRecent = () => {
    if (recentOf?.workspaceId === workspaceId) return;
    setRecentOf({ workspaceId, places: readRecent(workspaceId) });
  };

  const pick = (place: Place) => {
    const next = withRecentPlace(recentOf?.workspaceId === workspaceId ? recentOf.places : readRecent(workspaceId), place);
    setRecentOf({ workspaceId, places: next });
    writeRecent(workspaceId, next);
    setChosen(place);
    setText(place.label);
    onSelect(place);
  };

  const clear = () => {
    setText("");
    setChosen(null);
  };

  const filterable = chosen !== null && onFilter !== undefined && placeAddsFilter(chosen, filter);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative">
        <PlaceCombobox
          ariaLabel={t("label")}
          placeholder={t("placeholder")}
          value={text}
          onValueChange={(value) => {
            setText(value);
            if (chosen && value !== chosen.label) setChosen(null);
          }}
          request={{ kind: null, state }}
          onPick={pick}
          recent={recent}
          onFocus={loadRecent}
          grouped
          icon={<MagnifyingGlass weight="bold" className="h-4 w-4" />}
          inputMode="search"
        />
        {text !== "" ? (
          <button
            type="button"
            onClick={clear}
            aria-label={t("clear")}
            title={t("clear")}
            className="absolute right-1.5 top-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <X weight="bold" className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      {filterable && chosen ? (
        <button
          type="button"
          onClick={() => onFilter?.(chosen)}
          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-h-0"
        >
          <Funnel weight="bold" className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {t("filter", { place: chosen.label })}
        </button>
      ) : null}
    </div>
  );
}
