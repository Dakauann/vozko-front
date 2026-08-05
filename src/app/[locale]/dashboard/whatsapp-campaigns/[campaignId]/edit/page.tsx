"use client";

import { use, useEffect, useState } from "react";
import {
  getWhatsAppCampaignByIdAction,
  listWhatsAppCampaignEntriesAction,
} from "@/app/actions/whatsapp-campaigns";
import type {
  WhatsAppCampaign,
  WhatsAppCampaignPhoneNumber,
} from "@/lib/whatsapp-campaigns/types";

import EditWhatsAppCampaignPage from "./_components/EditWhatsAppCampaignPage";
import { notFound } from "next/navigation";

interface WhatsAppCampaignEditPageProps {
  params: Promise<{
    campaignId: string;
    locale: string;
  }>;
}

interface PageState {
  loading: boolean;
  error?: string;
  notFound?: boolean;
  campaign?: WhatsAppCampaign;
}

function PageLoader() {
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

export default function WhatsAppCampaignEdit({
  params,
}: WhatsAppCampaignEditPageProps) {
  const { campaignId } = use(params);
  const [state, setState] = useState<PageState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });

    (async () => {
      const campaignResult = await getWhatsAppCampaignByIdAction(campaignId);
      if (cancelled) return;

      const { campaign, error } = campaignResult;

      if (error) {
        setState({ loading: false, error });
        return;
      }

      if (!campaign) {
        setState({ loading: false, notFound: true });
        return;
      }

      if (campaign.type !== "organic") {
        const entriesResult = await listWhatsAppCampaignEntriesAction(
          campaignId,
          {
            page: 1,
            pageSize: 1000,
          },
        );
        if (cancelled) return;

        if (!campaign.phoneNumbers || campaign.phoneNumbers.length === 0) {
          const { entries } = entriesResult;
          if (entries && entries.length > 0) {
            campaign.phoneNumbers = entries.map(
              (entry): WhatsAppCampaignPhoneNumber => ({
                id: entry.entry?.id || entry.leadId,
                number: entry.number,
                name: entry.name,
                variables: entry.entry?.variables,
                metadata: entry.metadata,
                status: entry.entry?.status,
                createdAt: entry.entry?.createdAt,
                updatedAt: entry.entry?.updatedAt,
              }),
            );
          }
        }
      }

      setState({ loading: false, campaign });
    })();

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (state.loading) return <PageLoader />;
  if (state.notFound) notFound();
  if (state.error) {
    return (
      <main className="w-full space-y-6">
        <div className="rounded-[--radius] border border-destructive bg-destructive px-4 py-3 text-sm text-destructive-foreground">
          {state.error}
        </div>
      </main>
    );
  }

  const campaign = state.campaign!;

  return (
    <main className="w-full space-y-6">
      <EditWhatsAppCampaignPage
        campaign={campaign}
        organic={campaign.type === "organic"}
      />
    </main>
  );
}
