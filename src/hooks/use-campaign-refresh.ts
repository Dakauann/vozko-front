import { useEffect } from "react";

export const CAMPAIGN_REFRESH_MS = 5000;

export function useCampaignRefresh(active: boolean, refresh: () => void, intervalMs: number = CAMPAIGN_REFRESH_MS) {
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [active, refresh, intervalMs]);
}
