"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="workspace">{children}</FeaturePageLayout>
  );
}