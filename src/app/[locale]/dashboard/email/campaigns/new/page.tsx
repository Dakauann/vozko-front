"use client";

import { Suspense } from "react";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { EmailCampaignWizard } from "@/components/email-campaigns/wizard/EmailCampaignWizard";

export default function NewEmailCampaignPage() {
  return (
    <Suspense fallback={<ScreenLoader fit="screen" />}>
      <EmailCampaignWizard />
    </Suspense>
  );
}
