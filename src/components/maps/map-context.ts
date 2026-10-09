"use client";

import { createContext, useContext } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

import type { MapPalette } from "@/lib/maps/palette";

export interface LeadMapContextValue {
  map: MapLibreMap | null;
  palette: MapPalette | null;
  setDrawing: (active: boolean) => void;
}

function ignoreDrawing(): void {}

export const LeadMapContext = createContext<LeadMapContextValue>({ map: null, palette: null, setDrawing: ignoreDrawing });

export function useLeadMap(): LeadMapContextValue {
  return useContext(LeadMapContext);
}
