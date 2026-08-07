"use client";

import { Headset } from "@/components/icons";

import CreateSupportInboxForm from "./CreateSupportInboxForm";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
};

export default function NewSupportInboxPage() {
  const router = useRouter();
  const t = useTranslations("supportInboxesPage.new");
  const { currentWorkspace } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const loading = !currentWorkspace?.id;

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      <motion.div variants={itemVariants}>
        <DashboardPageHeader
          back={{
            onClick: () => router.push("/dashboard/support-inboxes"),
            label: t("backButton"),
          }}
          icon={<Headset className="h-5 w-5" weight="fill" />}
          badge={t("badge")}
          title={t("title")}
          description={t("description")}
          colorClass="text-muted-foreground"
        />
      </motion.div>

      {error && (
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="border-border bg-muted">
            <p className="text-sm text-destructive-ink">{error}</p>
          </ElevatedContainer>
        </motion.div>
      )}

      {loading && (
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="border-border bg-card">
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border border-chart-4 border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                  {t("loading")}
                </span>
              </div>
            </div>
          </ElevatedContainer>
        </motion.div>
      )}

      {!loading && !error && (
        <motion.div variants={itemVariants}>
          <CreateSupportInboxForm />
        </motion.div>
      )}
    </motion.main>
  );
}
