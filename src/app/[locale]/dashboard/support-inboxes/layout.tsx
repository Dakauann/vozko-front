"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function SupportInboxesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="supportInboxes">
      {children}
    </FeaturePageLayout>
  );
}