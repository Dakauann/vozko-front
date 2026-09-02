"use client";

import { useEffect, useRef, useState } from "react";

import CreateUnofficialCampaignForm from "./CreateUnofficialCampaignForm";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ChannelTile } from "@/components/channels/channel-tile";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { getAgentOptionsAction } from "@/app/actions/agents";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Mirrors the official campaign's create page: the same header, the same
 * model-loading gate, the same loading and error containers. The AI model list
 * is fetched here rather than in the form so the form is not re-fetching it on
 * every keystroke-driven re-render.
 */
export default function NewUnofficialCampaignPage() {
  const router = useRouter();
  const t = useTranslations("unofficialWhatsappCampaigns");

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

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        back={{
          onClick: () => router.push("/dashboard/unofficial-whatsapp-campaigns"),
          label: t("form.back"),
        }}
        icon={<ChannelTile channel="unofficial_whatsapp" size="sm" />}
        badge={t("new.badge")}
        title={t("new.title")}
        description={t("new.description")}
        colorClass="text-healthy-ink"
      />

      {error ? (
        <ElevatedContainer className="border-border bg-muted">
          <p className="text-sm text-destructive-ink">{error}</p>
        </ElevatedContainer>
      ) : null}

      {loading ? (
        <ElevatedContainer className="border-border bg-card">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border border-healthy border-t-transparent" />
              <span className="text-sm text-muted-foreground">{t("new.loading")}</span>
            </div>
          </div>
        </ElevatedContainer>
      ) : null}

      {!loading && !error ? (
        <CreateUnofficialCampaignForm
          mode="create"
          aiModels={aiModels}
          modelPricing={modelPricing}
        />
      ) : null}
    </main>
  );
}
