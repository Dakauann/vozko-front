"use client";

import dynamic from "next/dynamic";

import type { LeadMapProps } from "./lead-map-types";
import { MapScreenLoader } from "./MapStatus";

export const LeadMap = dynamic<LeadMapProps>(() => import("./LeadMapCanvas").then((loaded) => loaded.LeadMapCanvas), {
  ssr: false,
  loading: () => <MapScreenLoader className="h-full" />,
});
