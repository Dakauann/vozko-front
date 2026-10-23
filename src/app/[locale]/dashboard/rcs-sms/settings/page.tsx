"use client";

import { Suspense } from "react";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { CarrierRulesScreen } from "@/components/carrier-messaging";

export default function RcsSmsSettingsPage() {
  return (
    <Suspense fallback={<ScreenLoader fit="screen" />}>
      <CarrierRulesScreen />
    </Suspense>
  );
}
