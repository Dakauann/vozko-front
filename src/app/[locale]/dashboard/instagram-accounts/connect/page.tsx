"use client";

import {
  ArrowLeft,
  ArrowSquareOut,
  ChatCircleDots,
  CheckCircle,
  CursorClick,
  ImageSquare,
  InstagramLogo,
  Lock,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import {
  ConnectAsideCard,
  ConnectBenefit,
  ConnectWorkArea,
} from "@/components/channels/connect-layout";
import Image from "next/image";
import { IconBox } from "@/components/elevated-design/listing-card";
import { getBrand } from "@/config/brand";
import { motion } from "framer-motion";
import { useInstagramConnect } from "@/hooks/use-instagram-connect";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/**
 * The Instagram connect flow, mirroring the WhatsApp Embedded Signup page so both
 * channels onboard identically.
 *
 * Business Login for Instagram is just a URL — no Facebook JS SDK and no
 * config_id — so the whole flow is: open the popup, wait for the postMessage
 * result, land back on the list.
 */
export default function ConnectInstagramPage() {
  const t = useTranslations("instagram");
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const { can } = useWorkspace();

  const [result, setResult] = useState<{ status: string; username?: string; reason?: string } | null>(
    null,
  );

  const { connect, isConnecting } = useInstagramConnect((outcome) => {
    if (outcome.status === "cancelled") {
      setResult(null);
      return;
    }
    setResult(outcome);

    if (outcome.status === "error") {
      toast({
        title: t("connect.errorTitle"),
        description: t(`connectError.${outcome.reason ?? "connect_failed"}`),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: t("connect.successTitle"),
      description: outcome.username
        ? t(outcome.status === "reconnected" ? "notice.reconnected" : "notice.connected", {
            username: outcome.username,
          })
        : t("notice.connectedGeneric"),
    });
  });

  // Permission is enforced server-side too; this just avoids showing a flow the
  // user cannot finish.
  useEffect(() => {
    if (!can("instagram_accounts", "create")) {
      router.replace("/dashboard/instagram-accounts");
    }
  }, [can, router]);

  const brandLogoSrc =
    resolvedTheme === "dark" ? getBrand().logo.markWhite : getBrand().logo.mark;

  const isSuccess = result?.status === "connected" || result?.status === "reconnected";
  const isError = result?.status === "error";

  const features = [
    {
      icon: <ChatCircleDots className="h-6 w-6" weight="fill" />,
      color: "purple" as const,
      title: t("connect.features.messages.title"),
      description: t("connect.features.messages.description"),
    },
    {
      icon: <ImageSquare className="h-6 w-6" weight="fill" />,
      color: "blue" as const,
      title: t("connect.features.posts.title"),
      description: t("connect.features.posts.description"),
    },
    {
      icon: <ShieldCheck className="h-6 w-6" weight="fill" />,
      color: "emerald" as const,
      title: t("connect.features.secure.title"),
      description: t("connect.features.secure.description"),
    },
  ];

  const steps = [
    { number: "1", text: t("connect.steps.step1") },
    { number: "2", text: t("connect.steps.step2") },
    { number: "3", text: t("connect.steps.step3") },
  ];

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto w-full max-w-6xl space-y-6 pb-16"
    >
      <motion.div variants={itemVariants}>
        <Button
          variant="ghost"
          title={t("profile.back")}
          icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push("/dashboard/instagram-accounts")}
        />
      </motion.div>

      {isSuccess && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <ElevatedContainer className="relative overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-card p-6 dark:border-emerald-500/30 dark:from-emerald-500/10">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
            <div className="relative flex gap-4">
              <IconBox color="emerald" size="lg" animated={false}>
                <CheckCircle className="h-7 w-7" weight="fill" />
              </IconBox>
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
                  {t("connect.successTitle")}
                </h3>
                {result?.username && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-white">
                    @{result.username}
                  </span>
                )}
                <div className="pt-3">
                  <Button
                    variant="primary"
                    title={t("connect.viewAccounts")}
                    icon={<ArrowSquareOut weight="bold" className="h-4 w-4" />}
                    iconVisible
                    iconSide="right"
                    onClick={() => router.push("/dashboard/instagram-accounts")}
                  />
                </div>
              </div>
            </div>
          </ElevatedContainer>
        </motion.div>
      )}

      {isError && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <ElevatedContainer className="relative overflow-hidden border-rose-200 bg-gradient-to-br from-rose-50/80 to-card p-6 dark:border-rose-500/30 dark:from-rose-500/10">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-500/10 blur-2xl" />
            <div className="relative flex gap-4">
              <IconBox color="rose" size="lg" animated={false}>
                <WarningCircle className="h-7 w-7" weight="fill" />
              </IconBox>
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-semibold text-rose-900 dark:text-rose-200">
                  {t("connect.errorTitle")}
                </h3>
                <p className="text-sm text-rose-700/80 dark:text-rose-300/80">
                  {t(`connectError.${result?.reason ?? "connect_failed"}`)}
                </p>
              </div>
            </div>
          </ElevatedContainer>
        </motion.div>
      )}

      {/* Hero */}
      <motion.div variants={itemVariants}>
        <ElevatedContainer className="relative overflow-hidden p-8 sm:p-10">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                className="relative"
              >
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12)]">
                  <InstagramLogo className="h-7 w-7 text-fuchsia-600" weight="fill" />
                </div>
              </motion.div>

              <div className="flex h-6 w-6 items-center justify-center">
                <div className="h-px w-6 bg-border" />
              </div>

              <motion.div
                initial={{ scale: 0, rotate: 180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.25 }}
                className="relative"
              >
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12)]">
                  <Image
                    src={brandLogoSrc}
                    alt={getBrand().name}
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain"
                    unoptimized
                  />
                </div>
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mt-8 max-w-2xl space-y-3"
          >
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("connect.title")}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              {t("connect.description")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <Button
              variant="primary"
              size="lg"
              title={isConnecting ? t("connect.cta.redirecting") : t("connect.cta.button")}
              icon={<ArrowSquareOut weight="bold" className="h-4 w-4" />}
              iconVisible
              iconSide="right"
              disabled={isConnecting}
              onClick={() => connect("/dashboard/instagram-accounts")}
              className="px-10 shadow-lg shadow-primary/20"
            />
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <Lock weight="bold" className="h-3 w-3" />
              OAuth 2.0
            </span>
          </motion.div>

          {/* Prerequisite. This is the single biggest source of "connected but no
              messages arrive" reports, so it is stated up front rather than only
              after the fact. */}
          <motion.div
            variants={itemVariants}
            className="mt-6 flex gap-2 rounded-lg border border-amber-500/30 bg-muted/30 p-3 text-xs leading-relaxed text-foreground"
          >
            <WarningCircle weight="fill" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <div>
              <p className="font-medium">{t("connect.prerequisite.title")}</p>
              <p className="mt-1 opacity-80">{t("connect.prerequisite.description")}</p>
            </div>
          </motion.div>
        </ElevatedContainer>
      </motion.div>

      <ConnectWorkArea
        aside={
          <ConnectAsideCard title={t("connect.features.title")}>
            {features.map((feature) => (
              <ConnectBenefit
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </ConnectAsideCard>
        }
        work={
          <ElevatedContainer className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <CursorClick className="h-5 w-5 text-muted-foreground" weight="bold" />
              <h2 className="font-semibold text-foreground">{t("connect.steps.title")}</h2>
            </div>
            {/* One rail, drawn from each marker, so a step whose body grows does
                not break the sequence. Matches the Telegram flow exactly. */}
            <ol className="space-y-5">
              {steps.map((step, i) => (
                <li key={step.number} className="relative flex gap-4">
                  <div className="relative flex flex-col items-center">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fuchsia-600 text-xs font-semibold tabular-nums text-white">
                      {step.number}
                    </span>
                    {i < steps.length - 1 && (
                      <span aria-hidden className="mt-2 w-px flex-1 bg-border" />
                    )}
                  </div>
                  <p className="min-w-0 flex-1 pb-1 text-sm leading-relaxed text-muted-foreground">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </ElevatedContainer>
        }
      />
    </motion.main>
  );
}
