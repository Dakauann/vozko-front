"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function WhatsappTemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="whatsappTemplates">
      {children}
    </FeaturePageLayout>
  );
}