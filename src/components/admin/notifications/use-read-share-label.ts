"use client";

import { useCallback } from "react";
import { useFormatter } from "next-intl";

import { broadcastReadShare, type Broadcast } from "@/lib/notifications/broadcast";

export function useReadShareLabel(): (broadcast: Pick<Broadcast, "recipients" | "read">) => string | null {
  const format = useFormatter();
  return useCallback(
    (broadcast) => {
      const share = broadcastReadShare(broadcast);
      return share === null ? null : format.number(share, { style: "percent", maximumFractionDigits: 0 });
    },
    [format],
  );
}
