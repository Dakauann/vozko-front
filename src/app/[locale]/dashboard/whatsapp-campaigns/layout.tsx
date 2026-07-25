"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function WhatsAppCampaignsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout
      featureKey="whatsappCampaigns"
      variants={[
        {
          match: "/whatsapp-campaigns/organic",
          featureKey: "whatsappCampaignsOrganic",
        },
        {
          match: "/whatsapp-campaigns/new-organic",
          featureKey: "whatsappCampaignsOrganic",
        },
      ]}
    >
      {children}
    </FeaturePageLayout>
  );
}