"use client";

import { CircleNotch, Files } from "@/components/icons";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { KnowledgeBase } from "@/lib/knowledge-base/types";
import KnowledgeBaseForm from "../../KnowledgeBaseForm";
import { apiClient } from "@/lib/api/browser-client";
import { motion } from "framer-motion";
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

export default function EditKnowledgeBasePage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations("knowledgeBase.edit");
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchKnowledgeBase() {
      try {
        const { data, error } = await apiClient<
          KnowledgeBase & { knowledgeBase?: KnowledgeBase }
        >(`/knowledge-bases/${params.id}`);
        if (error || !data) {
          throw new Error("Failed to fetch knowledge base");
        }
        setKnowledgeBase(data.knowledgeBase || data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchKnowledgeBase();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <CircleNotch
          className="h-8 w-8 animate-spin text-lamp-ink"
          weight="bold"
        />
      </div>
    );
  }

  if (error || !knowledgeBase) {
    return (
      <ElevatedContainer className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          {error || "Knowledge base not found"}
        </p>
      </ElevatedContainer>
    );
  }

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
            onClick: () => router.push("/dashboard/knowledge-bases"),
            label: t("breadcrumb"),
          }}
          icon={<Files className="h-5 w-5" weight="fill" />}
          badge={t("title")}
          title={knowledgeBase.name}
          description={t("description")}
          colorClass="text-cyan-500"
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <KnowledgeBaseForm
          mode="edit"
          initialData={{
            id: knowledgeBase.id,
            name: knowledgeBase.name,
            description: knowledgeBase.description,
          }}
        />
      </motion.div>
    </motion.main>
  );
}
