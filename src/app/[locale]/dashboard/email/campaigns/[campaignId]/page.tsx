"use client";

import { use } from "react";

import { EmailCampaignDetail } from "@/components/email-campaigns/detail/EmailCampaignDetail";

export default function EmailCampaignPage({ params }: { params: Promise<{ campaignId: string; locale: string }> }) {
  const { campaignId } = use(params);
  return <EmailCampaignDetail campaignId={campaignId} />;
}
