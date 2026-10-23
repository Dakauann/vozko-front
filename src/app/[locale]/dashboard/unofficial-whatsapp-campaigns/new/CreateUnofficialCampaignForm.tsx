"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateUnofficialCampaignAction } from "@/app/actions/unofficial-whatsapp-campaigns";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { DEFAULT_SEND_DELAY_MS } from "@/components/unofficial-whatsapp/campaign-pacing-panel";
import type { ModelPricingInfo } from "@/lib/agents/types";
import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";

import { seedFromCampaign } from "./campaign-form-model";
import { BasicFields, MessageFields, MessagePreview, ResponseFields } from "./campaign-form-sections";
import { useUnofficialCampaignForm } from "./use-unofficial-campaign-form";

export default function CreateUnofficialCampaignForm({
  initialCampaign,
  aiModels = [],
  modelPricing = [],
}: {
  initialCampaign: UnofficialWhatsAppCampaign;
  aiModels?: string[];
  modelPricing?: ModelPricingInfo[];
}) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const router = useRouter();
  const seed = useMemo(() => seedFromCampaign(initialCampaign, DEFAULT_SEND_DELAY_MS), [initialCampaign]);
  const campaignForm = useUnofficialCampaignForm({ mode: "edit", seed, initialCampaign });
  const {
    form: {
      handleSubmit,
      formState: { isSubmitting },
    },
    numberUnusable,
    bodiesReady,
    exitPending,
    messageGate,
    payload,
    refusalOf,
  } = campaignForm;

  const onSubmit = handleSubmit(async (values) => {
    const refusal = messageGate();
    if (refusal) {
      toast.error(t("form.saveFailed"), { description: refusal });
      return;
    }
    const result = await updateUnofficialCampaignAction(initialCampaign.id, payload(values));
    if (result.error) {
      toast.error(t("form.saveFailed"), { description: refusalOf(result.code, result.error) });
      return;
    }
    router.push(`/dashboard/unofficial-whatsapp-campaigns/${result.campaign?.id ?? ""}`);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-xl font-semibold tracking-[0.01em] text-foreground">{t("form.basicInfoTitle")}</h2>

          <div className="space-y-4">
            <BasicFields form={campaignForm} />
            <MessageFields form={campaignForm} disabled={isSubmitting} />
            <ResponseFields form={campaignForm} aiModels={aiModels} modelPricing={modelPricing} disabled={isSubmitting} campaignId={initialCampaign.id} showSchedule />
          </div>
        </ElevatedContainer>

        <MessagePreview form={campaignForm} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" title={t("actions.cancel")} onClick={() => router.push("/dashboard/unofficial-whatsapp-campaigns")} />
        <Button type="submit" variant="primary" title={t("form.save")} disabled={isSubmitting || numberUnusable || !bodiesReady || exitPending} />
      </div>
    </form>
  );
}
