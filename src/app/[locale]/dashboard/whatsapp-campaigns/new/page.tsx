"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { getAgentOptionsAction } from "@/app/actions/agents";
import { ScreenLoader } from "@/components/brand/screen-loader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { ModelPricingInfo } from "@/lib/agents/types";

import { WhatsAppCampaignWizard } from "./WhatsAppCampaignWizard";

export default function NewWhatsAppCampaignPage() {
  const t = useTranslations("whatsappCampaignsPage.new");
  const [aiModels, setAiModels] = useState<string[]>([]);
  const [modelPricing, setModelPricing] = useState<ModelPricingInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    getAgentOptionsAction()
      .then((result) => {
        if (result.options) {
          setAiModels(result.options.messaging ?? []);
          setModelPricing(result.options.modelPricing ?? []);
        }
      })
      .catch(() => setError(t("loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <>
      {error ? (
        <ElevatedContainer className="border-border bg-muted">
          <p className="text-sm text-destructive-ink">{error}</p>
        </ElevatedContainer>
      ) : loading ? (
        <ScreenLoader fit="screen" label={t("loading")} />
      ) : (
        <Suspense fallback={<ScreenLoader fit="screen" />}>
          <WhatsAppCampaignWizard aiModels={aiModels} modelPricing={modelPricing} />
        </Suspense>
      )}
    </>
  );
}
