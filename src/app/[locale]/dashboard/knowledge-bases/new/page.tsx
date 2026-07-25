"use client";

import { ArrowLeft, Files } from "@phosphor-icons/react";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedButton from "@/components/elevated-design/button";
import KnowledgeBaseForm from "../KnowledgeBaseForm";
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

export default function NewKnowledgeBasePage() {
  const router = useRouter();
  const t = useTranslations("knowledgeBase.new");

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <motion.div variants={itemVariants}>
        <ElevatedButton
          variant="ghost"
          title={t("backButton")}
          icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push("/dashboard/knowledge-bases")}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <DashboardPageHeader
          icon={<Files className="h-5 w-5" weight="fill" />}
          badge={t("badge")}
          description={t("description")}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <KnowledgeBaseForm mode="create" />
      </motion.div>
    </motion.main>
  );
}
