"use client";

import { use, useEffect, useState } from "react";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { getWhatsAppCampaignByIdAction } from "@/app/actions/whatsapp-campaigns";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";

import EditWhatsAppCampaignPage from "./_components/EditWhatsAppCampaignPage";
import { notFound, useRouter } from "next/navigation";

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

export default function WhatsAppCampaignEdit({
  params,
}: WhatsAppCampaignEditPageProps) {
  const { campaignId } = use(params);
  const router = useRouter();
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

      if (campaign.type === "organic") {
        router.replace(`/dashboard/whatsapp-business-phones/${campaign.businessPhoneId}`);
        return;
      }

      setState({ loading: false, campaign });
    })();

    return () => {
      cancelled = true;
    };
  }, [campaignId, router]);

  if (state.loading) return <ScreenLoader fit="screen" />;
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
      <EditWhatsAppCampaignPage campaign={campaign} />
    </main>
  );
}
