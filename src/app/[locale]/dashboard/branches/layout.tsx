"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function BranchesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="branches">{children}</FeaturePageLayout>
  );
}
