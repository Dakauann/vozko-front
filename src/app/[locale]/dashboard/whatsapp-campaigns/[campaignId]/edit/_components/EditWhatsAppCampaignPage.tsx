"use client";

import { WhatsappLogo } from "@/components/icons";

import CreateWhatsAppCampaignForm from "../../../new/CreateWhatsAppCampaignForm";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface EditWhatsAppCampaignPageProps {
  campaign: WhatsAppCampaign;
  organic?: boolean;
}

export default function EditWhatsAppCampaignPage({
  campaign,
  organic = false,
}: EditWhatsAppCampaignPageProps) {
  const router = useRouter();
  const t = useTranslations("whatsappCampaignsPage.edit");

  return (
    <div className="w-full space-y-6">
      <div>
        <DashboardPageHeader
          back={{
            onClick: () =>
              router.push(`/dashboard/whatsapp-campaigns/${campaign.id}`),
            label: t("backButton"),
          }}
          icon={<WhatsappLogo className="h-5 w-5" weight="fill" />}
          badge={t("badge")}
          title={t("title")}
          description={t("description")}
          colorClass="text-healthy-ink"
        />
      </div>

      <div>
        <CreateWhatsAppCampaignForm
          mode="edit"
          initialCampaign={campaign}
          organic={organic}
        />
      </div>
    </div>
  );
}
