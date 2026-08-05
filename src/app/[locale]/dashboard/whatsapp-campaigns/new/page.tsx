"use client";

import { WhatsappLogo } from "@/components/icons";
import { useEffect, useRef, useState } from "react";

import CreateWhatsAppCampaignForm from "./CreateWhatsAppCampaignForm";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { getAgentOptionsAction } from "@/app/actions/agents";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import TourGuide from "@/components/TourGuide";
import {
  whatsappCampaignsTourSteps,
  whatsappCampaignsTourPalette,
  whatsappCampaignsTourSeed,
} from "@/data/tour-whatsapp-campaigns";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function NewWhatsAppCampaignPage() {
  const router = useRouter();
  const t = useTranslations("whatsappCampaignsPage.new");
  const [aiModels, setAiModels] = useState<string[]>([]);
  const [modelPricing, setModelPricing] = useState<ModelPricingInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function loadData() {
      try {
        const optionsResult = await getAgentOptionsAction();

        if (optionsResult.options) {
          setAiModels(optionsResult.options.messaging ?? []);
          setModelPricing(optionsResult.options.modelPricing ?? []);
        }
      } catch {
        setError("Failed to load form data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <>
    <TourGuide
      steps={whatsappCampaignsTourSteps}
      storageKey="tour_dismissed_wc_v2"
      i18nNamespace="tourWhatsappCampaigns"
      introPalette={whatsappCampaignsTourPalette}
      introSeed={whatsappCampaignsTourSeed}
    />
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <motion.div variants={itemVariants}>
        <DashboardPageHeader
          back={{
            onClick: () => router.push("/dashboard/whatsapp-campaigns"),
            label: t("backButton"),
          }}
          icon={<WhatsappLogo className="h-5 w-5" weight="fill" />}
          badge={t("badge")}
          title={t("title")}
          description={t("description")}
          colorClass="text-healthy"
        />
      </motion.div>

      {error && (
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="border-destructive/30 bg-destructive/10">
            <p className="text-sm text-destructive">{error}</p>
          </ElevatedContainer>
        </motion.div>
      )}

      {loading && (
        <motion.div variants={itemVariants}>
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
        </motion.div>
      )}

      {!loading && !error && (
        <motion.div
          variants={itemVariants}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.4,
            type: "spring",
            stiffness: 100,
            damping: 20,
          }}
        >
          <CreateWhatsAppCampaignForm
            aiModels={aiModels}
            modelPricing={modelPricing}
            mode="create"
          />
        </motion.div>
      )}
    </motion.main>
    </>
  );
}
