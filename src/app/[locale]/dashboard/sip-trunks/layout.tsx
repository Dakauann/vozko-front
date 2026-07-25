"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function SipTrunksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="sipTrunks">{children}</FeaturePageLayout>
  );
}