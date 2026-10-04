"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function WhatsAppCampaignsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="whatsappCampaigns">
      {children}
    </FeaturePageLayout>
  );
}