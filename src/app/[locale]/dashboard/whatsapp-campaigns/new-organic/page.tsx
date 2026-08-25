"use client";

import { WhatsappLogo } from "@/components/icons";
import { useEffect, useRef, useState } from "react";

import CreateWhatsAppCampaignForm from "../new/CreateWhatsAppCampaignForm";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { ModelPricingInfo } from "@/lib/agents/types";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import { getAgentOptionsAction } from "@/app/actions/agents";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

export default function NewOrganicCampaignPage() {
  const router = useRouter();
  const t = useTranslations("whatsappCampaignsPage.organic");
  const { currentWorkspace } = useWorkspace();

  const [businessPhones, setBusinessPhones] = useState<WhatsAppBusinessPhone[]>(
    [],
  );
  const [aiModels, setAiModels] = useState<string[]>([]);
  const [modelPricing, setModelPricing] = useState<ModelPricingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!currentWorkspace?.id || loadedRef.current) return;
    loadedRef.current = true;

    async function loadData() {
      try {
        const [phonesResult, optionsResult] = await Promise.all([
          listBusinessPhonesAction({ status: "CONNECTED", pageSize: 500 }),
          getAgentOptionsAction(),
        ]);

        if (phonesResult.error) setError(phonesResult.error);
        else setBusinessPhones(phonesResult.phones ?? []);

        if (optionsResult.options) {
          setAiModels(optionsResult.options.messaging ?? []);
          setModelPricing(optionsResult.options.modelPricing ?? []);
        }
      } catch {
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentWorkspace?.id, t]);

  return (
    <main className="w-full space-y-6">
      <div>
        <DashboardPageHeader
          back={{
            onClick: () => router.push("/dashboard/whatsapp-campaigns"),
            label: t("backButton"),
          }}
          icon={<WhatsappLogo className="h-5 w-5" weight="fill" />}
          badge={t("newBadge")}
          title={t("title")}
          description={t("description")}
          colorClass="text-healthy-ink"
        />
      </div>

      {error && (
        <div>
          <ElevatedContainer className="border-border bg-muted">
            <p className="text-sm text-destructive-ink">{error}</p>
          </ElevatedContainer>
        </div>
      )}

      {loading && (
        <div>
          <ElevatedContainer className="border-border bg-card">
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border border-healthy border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                  {t("loading")}
                </span>
              </div>
            </div>
          </ElevatedContainer>
        </div>
      )}

      {!loading && !error && (
        <div>
          <CreateWhatsAppCampaignForm
            aiModels={aiModels}
            modelPricing={modelPricing}
            mode="create"
            organic
          />
        </div>
      )}
    </main>
  );
}
