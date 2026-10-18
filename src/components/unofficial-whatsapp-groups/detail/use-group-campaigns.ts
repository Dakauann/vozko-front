"use client";

import { useCallback, useEffect, useState } from "react";

import { listGroupCampaignsAction } from "@/app/actions/unofficial-whatsapp-groups";
import type { GroupCampaign } from "@/lib/unofficial-whatsapp-groups/types";

interface LoadedCampaigns {
  key: string;
  campaigns: GroupCampaign[];
  error: string | null;
}

export interface GroupCampaignsState {
  campaigns: GroupCampaign[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useGroupCampaigns(groupId: string): GroupCampaignsState {
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<LoadedCampaigns | null>(null);
  const key = `${groupId}|${reloadKey}`;

  useEffect(() => {
    let cancelled = false;
    void listGroupCampaignsAction(groupId).then((result) => {
      if (cancelled) return;
      setLoaded({ key, campaigns: result.campaigns, error: result.error ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, key]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  return {
    campaigns: loaded?.campaigns ?? [],
    loading: loaded?.key !== key,
    error: loaded?.error ?? null,
    reload,
  };
}
