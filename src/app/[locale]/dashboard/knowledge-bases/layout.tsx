"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function KnowledgeBasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePageLayout featureKey="knowledgeBases">
      {children}
    </FeaturePageLayout>
  );
}