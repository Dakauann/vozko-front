"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function WhatsappBusinessPhonesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="whatsappBusinessPhones">
      {children}
    </FeaturePageLayout>
  );
}