"use client";

import { useEffect, useState } from "react";

import { estimateUnofficialCampaignAction } from "@/app/actions/unofficial-whatsapp-campaigns";
import type { CampaignEstimateDraft, CampaignEstimateRequest } from "@/lib/unofficial-whatsapp-campaigns/types";

export const ESTIMATE_DEBOUNCE_MS = 400;

export interface CampaignEstimateState {
  draft: CampaignEstimateDraft | null;
  loading: boolean;
  failed: boolean;
}

interface Settled {
  key: string;
  draft: CampaignEstimateDraft | null;
  failed: boolean;
}

const IDLE: CampaignEstimateState = { draft: null, loading: false, failed: false };

export function useCampaignEstimate(request: CampaignEstimateRequest | null): CampaignEstimateState {
  const [settled, setSettled] = useState<Settled>({ key: "", draft: null, failed: false });
  const key = request ? JSON.stringify(request) : "";

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await estimateUnofficialCampaignAction(JSON.parse(key) as CampaignEstimateRequest);
      if (cancelled) return;
      setSettled({ key, draft: result.draft ?? null, failed: !result.draft });
    }, ESTIMATE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  if (!key) return IDLE;
  if (settled.key !== key) return { draft: settled.draft, loading: true, failed: false };
  return { draft: settled.draft, loading: false, failed: settled.failed };
}
