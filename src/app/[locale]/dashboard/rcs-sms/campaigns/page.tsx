"use client";

import { CarrierCampaignsList } from "@/components/carrier-messaging";
import { useRouter } from "@/i18n/routing";
import { pathForScreen } from "@/lib/navigation/routes";

export default function RcsSmsCampaignsPage() {
  const router = useRouter();
  return (
    <CarrierCampaignsList
      onOpen={(campaignId) => router.push(pathForScreen("carrier_campaign", { campaignId }) ?? "/dashboard/rcs-sms/campaigns")}
      onCreate={() => router.push("/dashboard/rcs-sms/campaigns/new")}
    />
  );
}
