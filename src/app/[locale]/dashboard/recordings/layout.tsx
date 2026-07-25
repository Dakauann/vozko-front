"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function RecordingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="recordings">{children}</FeaturePageLayout>
  );
}