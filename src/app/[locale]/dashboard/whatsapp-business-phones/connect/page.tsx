"use client";

import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  CursorClick,
  Info,
  Lightning,
  Lock,
  PuzzlePiece,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { IconBox } from "@/components/elevated-design/listing-card";
import WhatsAppCapacityCard from "@/components/dashboard/addons/WhatsAppCapacityCard";
import { useWhatsAppCapacity } from "@/hooks/use-whatsapp-capacity";
import Image from "next/image";
import { getBrand } from "@/config/brand";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

export default function ConnectWhatsAppPage() {
  const t = useTranslations("whatsappBusinessPhones");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentWorkspace, can } = useWorkspace();
  const capacity = useWhatsAppCapacity();
  // Blocked = we know for certain there is no free slot. Loading stays permissive
  // (the button is disabled meanwhile) so we never flash a false gate.
  const capacityBlocked = capacity.ready && !capacity.canAdd;
  const [isRedirecting, setIsRedirecting] = useState(false);
  const badgeSrc =
    resolvedTheme === "dark"
      ? "/images/partners/meta-business-partner-two-line-dark.svg"
      : "/images/partners/meta-business-partner-two-line-light.svg";
  const brandLogoSrc =
    resolvedTheme === "dark"
      ? getBrand().logo.markWhite
      : getBrand().logo.mark;

  useEffect(() => {
    if (user && !can("business_phones", "create")) {
      router.replace("/dashboard/whatsapp-business-phones");
    }
  }, [user, can, router]);

  const status = searchParams.get("status");
  const phoneId = searchParams.get("phone_id");
  const wabaId = searchParams.get("waba_id");

  const isSuccess = status === "success" && phoneId && wabaId;
  const isError = status === "error";

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: t("connect.success.toastTitle"),
        description: t("connect.success.toastDescription"),
      });
    } else if (isError) {
      toast({
        title: t("connect.error.toastTitle"),
        description: t("connect.error.toastDescription"),
        variant: "destructive",
      });
    }
  }, [isSuccess, isError, toast, t]);

  const apiBaseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
  }, []);

  const handleConnect = () => {
    // Capacity gate: never launch Embedded Signup when there is no free slot. The
    // UI already shows the buy CTA; this guards a stale click.
    if (capacityBlocked) {
      return;
    }
    if (!currentWorkspace?.id) {
      toast({
        title: t("connect.error.toastTitle"),
        description:
          "Selecione um workspace antes de conectar o WhatsApp Business.",
        variant: "destructive",
      });
      return;
    }

    const currentUrl = window.location.origin + window.location.pathname;
    const signupUrl = `${apiBaseUrl}/oauth/meta/embedded?workspace_id=${encodeURIComponent(currentWorkspace.id)}&redirect_url=${encodeURIComponent(currentUrl)}`;

    // Open the Embedded Signup in a centered popup so the dashboard stays put.
    // The popup posts its result back and closes; if it's blocked we fall back
    // to a full-page redirect.
    const w = 520;
    const h = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(
      signupUrl,
      "wa-embedded",
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );

    if (!popup) {
      setIsRedirecting(true);
      window.location.href = signupUrl;
      return;
    }

    setIsRedirecting(true);

    let apiOrigin = "";
    try {
      apiOrigin = new URL(apiBaseUrl).origin;
    } catch {
      apiOrigin = "";
    }

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(closeTimer);
      setIsRedirecting(false);
    };

    const onMessage = (event: MessageEvent) => {
      if (apiOrigin && event.origin !== apiOrigin) return;
      const data = event.data as { source?: string; status?: string };
      if (!data || data.source !== "wa-embedded") return;
      cleanup();
      try {
        popup.close();
      } catch {
        /* popup may already be closed */
      }
      if (data.status === "success") {
        toast({
          title: t("connect.success.toastTitle"),
          description: t("connect.success.toastDescription"),
        });
        router.push("/dashboard/whatsapp-business-phones");
      }
    };

    // Detect the user closing the popup without finishing.
    const closeTimer = window.setInterval(() => {
      if (popup.closed) cleanup();
    }, 600);

    window.addEventListener("message", onMessage);
  };

  if (user && !can("business_phones", "create")) {
    return null;
  }

  const features = [
    {
      icon: <CursorClick className="h-6 w-6" weight="fill" />,
      color: "emerald" as const,
      titleKey: "connect.features.quick.title",
      descriptionKey: "connect.features.quick.description",
    },
    {
      icon: <Lock className="h-6 w-6" weight="fill" />,
      color: "blue" as const,
      titleKey: "connect.features.secure.title",
      descriptionKey: "connect.features.secure.description",
    },
    {
      icon: <Lightning className="h-6 w-6" weight="fill" />,
      color: "purple" as const,
      titleKey: "connect.features.automatic.title",
      descriptionKey: "connect.features.automatic.description",
    },
  ];

  const steps = [
    { number: "1", key: "connect.steps.step1" },
    { number: "2", key: "connect.steps.step2" },
    { number: "3", key: "connect.steps.step3" },
  ];

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-5xl mx-auto space-y-6 pb-16"
    >
      {/* Back Button */}
      <motion.div variants={itemVariants}>
        <Button
          variant="ghost"
          title={t("button.back")}
          icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push("/dashboard/whatsapp-business-phones")}
        />
      </motion.div>

      {/* Capacity: shown at the flow entry so the operator sees remaining slots
          before starting, and is routed to buy more when there are none. */}
      <motion.div variants={itemVariants}>
        <WhatsAppCapacityCard capacity={capacity} />
      </motion.div>

      {/* Success Banner */}
      {isSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <ElevatedContainer className="relative overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-card p-6">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
            <div className="relative flex gap-4">
              <IconBox color="emerald" size="lg" animated={false}>
                <CheckCircle className="h-7 w-7" weight="fill" />
              </IconBox>
              <div className="space-y-2 flex-1">
                <h3 className="text-lg font-semibold text-emerald-900">
                  {t("connect.success.title")}
                </h3>
                <p className="text-sm text-emerald-700/80">
                  {t("connect.success.description")}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-white">
                    Phone ID: {phoneId}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-white">
                    WABA ID: {wabaId}
                  </span>
                </div>
                <div className="pt-3">
                  <Button
                    variant="primary"
                    title={t("connect.success.viewPhones")}
                    icon={<ArrowSquareOut weight="bold" className="h-4 w-4" />}
                    iconVisible
                    iconSide="right"
                    onClick={() =>
                      router.push("/dashboard/whatsapp-business-phones")
                    }
                  />
                </div>
              </div>
            </div>
          </ElevatedContainer>
        </motion.div>
      )}

      {/* Error Banner */}
      {isError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <ElevatedContainer className="relative overflow-hidden border-rose-200 bg-gradient-to-br from-rose-50/80 to-card p-6">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-500/10 blur-2xl" />
            <div className="relative flex gap-4">
              <IconBox color="rose" size="md" animated={false}>
                <Info className="h-5 w-5" weight="fill" />
              </IconBox>
              <div className="space-y-1">
                <h3 className="font-semibold text-rose-900">
                  {t("connect.error.title")}
                </h3>
                <p className="text-sm text-rose-700/80">
                  {t("connect.error.description")}
                </p>
              </div>
            </div>
          </ElevatedContainer>
        </motion.div>
      )}

      {/* Hero Section */}
      <motion.header variants={itemVariants}>
        <ElevatedContainer className="relative overflow-hidden border border-border/50 bg-card p-0">
          {/* Ambient background glows */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-500/[0.04] blur-[80px]" />
            <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-emerald-500/[0.04] blur-[60px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-primary/[0.02] blur-[100px]" />
          </div>

          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <div className="relative px-8 pt-10 pb-8 sm:px-12 sm:pt-12 sm:pb-10">
            {/* Partner logos + badges row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-5">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: 0.15,
                  }}
                  className="relative"
                >
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 blur-md" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-md border border-border/70">
                    <Image
                      src="https://static.xx.fbcdn.net/rsrc.php/v4/yu/r/KjW_H8CjQn_.png"
                      alt="Meta"
                      width={30}
                      height={30}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-center h-6 w-6"
                >
                  <div className="h-px w-6 bg-border" />
                </motion.div>

                <motion.div
                  initial={{ scale: 0, rotate: 180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: 0.25,
                  }}
                  className="relative"
                >
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 blur-md" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-md border border-border/70">
                    <Image
                      src={brandLogoSrc}
                      alt={getBrand().name}
                      width={30}
                      height={30}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </motion.div>
              </div>

              {/* Meta Business Partner Badge */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex-shrink-0"
              >
                <Image
                  src={badgeSrc}
                  alt="Meta Business Partner"
                  width={176}
                  height={100}
                  className="h-auto w-full max-w-[152px] object-contain"
                />
              </motion.div>
            </div>

            {/* Title block */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="max-w-2xl space-y-3"
            >
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                {t("connect.title")}
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
                {t("connect.description")}
              </p>
            </motion.div>

            {/* Primary CTA inline */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              {capacityBlocked ? (
                <>
                  <Button
                    link="/dashboard/addons"
                    newTab={false}
                    variant="primary"
                    size="lg"
                    title={t("capacity.buyMore")}
                    icon={<PuzzlePiece weight="bold" className="h-4 w-4" />}
                    iconVisible
                    iconSide="left"
                    className="px-10 shadow-lg shadow-primary/20"
                  />
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <WarningCircle
                      weight="fill"
                      className="h-3.5 w-3.5 text-amber-500"
                      aria-hidden
                    />
                    {t("capacity.full")}
                  </span>
                </>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    title={
                      isRedirecting
                        ? t("connect.cta.redirecting")
                        : t("connect.cta.button")
                    }
                    icon={<ArrowSquareOut weight="bold" className="h-4 w-4" />}
                    iconVisible
                    iconSide="right"
                    onClick={handleConnect}
                    disabled={isRedirecting || capacity.loading}
                    className="px-10 shadow-lg shadow-primary/20"
                  />
                  <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock weight="bold" className="h-3 w-3" />
                    OAuth 2.0
                  </span>
                </>
              )}
            </motion.div>
          </div>
        </ElevatedContainer>
      </motion.header>

      {/* Features Grid */}
      <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-3">
        {features.map((feature, index) => (
          <motion.div
            key={feature.titleKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 * index + 0.4 }}
          >
            <ElevatedContainer className="group relative overflow-hidden border border-border/50 bg-card p-6 transition-all duration-300 hover:border-border hover:shadow-md hover:-translate-y-0.5 h-full">
              <div
                className={cn(
                  "absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.03] blur-2xl transition-opacity duration-500 group-hover:opacity-[0.08]",
                  feature.color === "emerald"
                    ? "bg-emerald-500"
                    : feature.color === "blue"
                      ? "bg-blue-500"
                      : "bg-purple-500",
                )}
              />
              <div className="relative space-y-4">
                <IconBox color={feature.color} size="md">
                  {feature.icon}
                </IconBox>
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-foreground text-sm">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(feature.descriptionKey)}
                  </p>
                </div>
              </div>
            </ElevatedContainer>
          </motion.div>
        ))}
      </motion.div>

      {/* How It Works */}
      <motion.div variants={itemVariants}>
        <ElevatedContainer className="relative overflow-hidden border border-border/50 bg-card p-8 sm:p-10">
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-blue-500/[0.03] blur-[60px]" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                {t("connect.stepsTitle")}
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>

            <div className="grid sm:grid-cols-3 gap-8">
              {steps.map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index + 0.5 }}
                  className="relative"
                >
                  {index < steps.length - 1 && (
                    <div className="hidden sm:block absolute top-5 left-[calc(50%+24px)] w-[calc(100%-24px)] h-px bg-gradient-to-r from-border via-border/50 to-transparent" />
                  )}
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-primary-foreground shadow-md shadow-primary/15">
                      {step.number}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
                      {t(step.key)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </ElevatedContainer>
      </motion.div>

      {/* Info Card */}
      <motion.div variants={itemVariants}>
        <ElevatedContainer className="relative overflow-hidden border border-border/50 bg-card p-6">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-blue-500/[0.04] blur-2xl" />
          <div className="relative flex gap-4">
            <IconBox color="blue" size="md" animated={false}>
              <Info className="h-5 w-5" weight="fill" />
            </IconBox>
            <div className="space-y-1.5 flex-1">
              <h3 className="font-semibold text-foreground text-sm">
                {t("connect.infoBox.title")}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("connect.infoBox.description")}
              </p>
            </div>
          </div>
        </ElevatedContainer>
      </motion.div>

      {/* Certifications & Security Footer */}
      <motion.div variants={itemVariants}>
        <div className="border-t border-border/40 pt-8 pb-4 space-y-5">
          <div className="flex items-center justify-center gap-6">
            <Image
              src={badgeSrc}
              alt="Meta Business Partner"
              width={180}
              height={102}
              className="h-auto w-full max-w-[140px] object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck
              weight="fill"
              className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0"
            />
            <p className="text-[11px] text-muted-foreground/50 text-center tracking-wide">
              {t("connect.footer")}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.main>
  );
}
