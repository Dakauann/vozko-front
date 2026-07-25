"use client";

import FeaturePageLayout from "@/components/FeaturePageLayout";

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FeaturePageLayout featureKey="calendar">{children}</FeaturePageLayout>;
}