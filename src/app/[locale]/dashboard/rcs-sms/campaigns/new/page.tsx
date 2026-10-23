"use client";

import { Suspense } from "react";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { CarrierCampaignEditorScreen } from "@/components/carrier-messaging";

export default function NewRcsSmsCampaignPage() {
  return (
    <Suspense fallback={<ScreenLoader fit="screen" />}>
      <CarrierCampaignEditorScreen />
    </Suspense>
  );
}
