"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function WorkflowsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="workflows">{children}</FeaturePageLayout>
  );
}