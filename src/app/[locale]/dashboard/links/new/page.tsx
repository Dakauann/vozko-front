"use client";

import { LinkSimple } from "@/components/icons";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";

import ShortLinkForm from "../ShortLinkForm";

export default function NewLinkPage() {
  const t = useTranslations("links");
  const router = useRouter();

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto w-full max-w-3xl space-y-6"
    >
      <DashboardPageHeader
        icon={<LinkSimple className="h-4 w-4" weight="bold" />}
        badge={t("header.badge")}
        title={t("new.title")}
        description={t("new.description")}
        back={{ onClick: () => router.push("/dashboard/links"), label: t("new.back") }}
      />
      <ShortLinkForm mode="create" />
    </motion.main>
  );
}
