"use client";

import { use, useEffect, useRef, useState } from "react";

import CreateUnofficialCampaignForm from "../../new/CreateUnofficialCampaignForm";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ChannelTile } from "@/components/channels/channel-tile";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { ModelPricingInfo } from "@/lib/agents/types";
import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";
import { getAgentOptionsAction } from "@/app/actions/agents";
import { getUnofficialCampaignAction } from "@/app/actions/unofficial-whatsapp-campaigns";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Edit reuses the create form in "edit" mode.
 *
 * The same component rather than a second one, so a field added to a campaign
 * cannot appear on create and be missing on edit — which is exactly how a
 * setting becomes impossible to change after the fact.
 */
export default function EditUnofficialCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  const router = useRouter();
  const t = useTranslations("unofficialWhatsappCampaigns");

  const [campaign, setCampaign] = useState<UnofficialWhatsAppCampaign | null>(null);
  const [aiModels, setAiModels] = useState<string[]>([]);
  const [modelPricing, setModelPricing] = useState<ModelPricingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    Promise.all([getUnofficialCampaignAction(campaignId), getAgentOptionsAction()])
      .then(([campaignResult, optionsResult]) => {
        setCampaign(campaignResult.campaign ?? null);
        if (optionsResult.options) {
          setAiModels(optionsResult.options.messaging ?? []);
          setModelPricing(optionsResult.options.modelPricing ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [campaignId]);

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        back={{
          onClick: () =>
            router.push(`/dashboard/unofficial-whatsapp-campaigns/${campaignId}`),
          label: t("form.back"),
        }}
        icon={<ChannelTile channel="unofficial_whatsapp" size="sm" />}
        badge={t("edit.badge")}
        title={campaign?.name ?? t("edit.title")}
        description={t("edit.description")}
        colorClass="text-healthy-ink"
      />

      {loading ? (
        <ElevatedContainer className="border-border bg-card">
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border border-healthy border-t-transparent" />
          </div>
        </ElevatedContainer>
      ) : null}

      {!loading && campaign ? (
        <CreateUnofficialCampaignForm
          mode="edit"
          initialCampaign={campaign}
          aiModels={aiModels}
          modelPricing={modelPricing}
        />
      ) : null}
    </main>
  );
}
