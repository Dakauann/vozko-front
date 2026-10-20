"use client";

import { useEffect } from "react";

import { createEdgeRailRegistry } from "@/lib/docks/edge-rail";

const RAIL_WIDTH_VAR = "--dock-rail-w";

const pageRail = createEdgeRailRegistry((width) => document.documentElement.style.setProperty(RAIL_WIDTH_VAR, width));

export function useEdgeRailReserve(): void {
  useEffect(() => {
    pageRail.enter();
    return pageRail.leave;
  }, []);
}
