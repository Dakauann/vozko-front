"use client";

import { WhatsappLogo } from "@/components/icons";

import CreateWhatsAppCampaignForm from "../../../new/CreateWhatsAppCampaignForm";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <motion.div variants={itemVariants}>
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
      </motion.div>

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
          mode="edit"
          initialCampaign={campaign}
          organic={organic}
        />
      </motion.div>
    </motion.div>
  );
}
