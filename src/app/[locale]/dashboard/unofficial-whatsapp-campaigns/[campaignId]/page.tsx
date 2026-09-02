"use client";

import { use, useEffect, useState } from "react";

import UnofficialCampaignDetail from "./_components/CampaignDetail";
import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";
import { getUnofficialCampaignAction } from "@/app/actions/unofficial-whatsapp-campaigns";
import { notFound } from "next/navigation";

export default function UnofficialCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  const [state, setState] = useState<{
    loading: boolean;
    campaign?: UnofficialWhatsAppCampaign;
    error?: string;
    missing?: boolean;
  }>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    getUnofficialCampaignAction(campaignId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setState({ loading: false, error: result.error });
        return;
      }
      if (!result.campaign) {
        setState({ loading: false, missing: true });
        return;
      }
      setState({ loading: false, campaign: result.campaign });
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (state.loading) {
    return (
      <main className="flex w-full items-center justify-center py-24">
        <div
          className="h-8 w-8 animate-spin rounded-full border border-muted border-t-primary"
          role="status"
          aria-label="Loading"
        />
      </main>
    );
  }
  if (state.missing) notFound();
  if (state.error) {
    return (
      <main className="w-full space-y-6">
        <div className="rounded-[--radius] border border-destructive bg-destructive px-4 py-3 text-sm text-destructive-foreground">
          {state.error}
        </div>
      </main>
    );
  }

  return <UnofficialCampaignDetail campaign={state.campaign!} />;
}
