"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { getAgentOptionsAction } from "@/app/actions/agents";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { Notice } from "@/components/ui/notice";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { readGroupPrefill } from "@/lib/unofficial-whatsapp-campaigns/group-audience";

import { UnofficialCampaignWizard } from "./UnofficialCampaignWizard";

export default function NewUnofficialCampaignPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const query = use(searchParams);
  const groupPrefill = useMemo(() => readGroupPrefill(query), [query]);

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
      .catch(() => setError(t("error.title")))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <ScreenLoader fit="screen" label={t("new.loading")} />;
  if (error) {
    return (
      <main className="w-full space-y-4">
        <Notice tone="fault" title={error} />
      </main>
    );
  }
  return <UnofficialCampaignWizard aiModels={aiModels} modelPricing={modelPricing} groupPrefill={groupPrefill} />;
}
