"use client";

import { use } from "react";

import { CarrierCampaignDetail } from "@/components/carrier-messaging";
import { useRouter } from "@/i18n/routing";

const CAMPAIGNS_PATH = "/dashboard/rcs-sms/campaigns";

function editorPath(campaignId: string): string {
  return `${CAMPAIGNS_PATH}/new?campaign=${encodeURIComponent(campaignId)}`;
}

export default function RcsSmsCampaignPage({ params }: { params: Promise<{ campaignId: string; locale: string }> }) {
  const { campaignId } = use(params);
  const router = useRouter();
  return (
    <CarrierCampaignDetail
      campaignId={campaignId}
      onBack={() => router.push(CAMPAIGNS_PATH)}
      onEdit={(campaign) => router.push(editorPath(campaign.id))}
      onDuplicated={(campaign) => router.push(editorPath(campaign.id))}
    />
  );
}
