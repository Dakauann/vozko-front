"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Lightning } from "@/components/icons";
import { LiveDecisionSummaryTable } from "@/components/live-decisions/LiveDecisionSummaryTable";
import { AccessDenied } from "@/components/ui/access-denied";
import { useAuth } from "@/contexts/auth-context";
import { isSystemAdmin } from "@/lib/auth/roles";

export default function AdminLiveDecisionsPage() {
  const t = useTranslations("adminLiveDecisions");
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <ScreenLoader fit="screen" />;
  }
  if (!isSystemAdmin(user?.role)) return <AccessDenied backHref="/dashboard" />;

  return (
    <motion.main
      className="w-full space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <DashboardPageHeader
        icon={<Lightning className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
      />
      <LiveDecisionSummaryTable />
    </motion.main>
  );
}
