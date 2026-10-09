"use client";

import dynamic from "next/dynamic";

import type { MiniMapProps } from "./lead-map-types";
import { MapScreenLoader } from "./MapStatus";

export const MiniMap = dynamic<MiniMapProps>(() => import("./MiniMapCanvas").then((loaded) => loaded.MiniMapCanvas), {
  ssr: false,
  loading: () => (
    <div className="h-40 w-full overflow-hidden rounded-lg border border-border">
      <MapScreenLoader className="h-full min-h-0" />
    </div>
  ),
});
