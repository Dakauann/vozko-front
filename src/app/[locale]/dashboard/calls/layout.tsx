"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function CallsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FeaturePageLayout featureKey="calls">{children}</FeaturePageLayout>;
}