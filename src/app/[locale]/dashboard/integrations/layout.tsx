"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="integrations">{children}</FeaturePageLayout>
  );
}