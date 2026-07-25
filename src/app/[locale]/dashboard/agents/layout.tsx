"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function AgentsPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FeaturePageLayout featureKey="agents">{children}</FeaturePageLayout>;
}
