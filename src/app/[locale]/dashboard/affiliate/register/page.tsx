"use client";

import { useEffect, useState } from "react";

import { BecomeAffiliateForm } from "@/components/affiliate/become-affiliate-form";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Handshake } from "@phosphor-icons/react";
import { getMyAffiliateAction } from "@/app/actions/affiliate";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

export default function AffiliateRegisterPage() {
  const t = useTranslations("affiliatePage");
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getMyAffiliateAction();
      if (cancelled) return;
      if (res.profile && !res.notFound) {
        router.replace("/dashboard/affiliate");
      } else {
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-3xl space-y-6"
    >
      <DashboardPageHeader
        icon={<Handshake className="h-5 w-5" weight="fill" />}
        badge={t("register.headerBadge")}
        description={t("register.headerDescription")}
      />
      <BecomeAffiliateForm />
    </motion.main>
  );
}
