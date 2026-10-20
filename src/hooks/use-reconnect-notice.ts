"use client";

import { useEffect, useState } from "react";

import type { ConnectionStatus } from "@/lib/conversations/types";

export const RECONNECT_NOTICE_DELAY_MS = 3000;

interface DropTracker {
  previous: ConnectionStatus;
  everConnected: boolean;
  drops: number;
}

function track(tracker: DropTracker, status: ConnectionStatus): DropTracker {
  if (tracker.previous === status) return tracker;
  const lost = tracker.previous === "connected" && status !== "connected";
  return {
    previous: status,
    everConnected: tracker.everConnected || status === "connected",
    drops: lost ? tracker.drops + 1 : tracker.drops,
  };
}

export function useReconnectNotice(status: ConnectionStatus): boolean {
  const [tracker, setTracker] = useState<DropTracker>(() => ({
    previous: status,
    everConnected: status === "connected",
    drops: 0,
  }));
  const current = track(tracker, status);
  if (current !== tracker) setTracker(current);

  const [overdueDrop, setOverdueDrop] = useState(0);
  const down = current.everConnected && current.drops > 0 && status !== "connected";
  const drops = current.drops;

  useEffect(() => {
    if (!down) return;
    const timer = setTimeout(() => setOverdueDrop(drops), RECONNECT_NOTICE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [down, drops]);

  return down && overdueDrop === drops;
}
