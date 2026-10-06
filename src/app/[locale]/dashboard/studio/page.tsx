"use client";

import { Suspense } from "react";

import { StudioProjectsPage } from "@/components/studio/projects/studio-projects-page";

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioProjectsPage />
    </Suspense>
  );
}
