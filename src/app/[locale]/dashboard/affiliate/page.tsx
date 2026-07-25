"use client";

import {
  ArrowRight,
  ChartLineUp,
  CheckCircle,
  CircleNotch,
  Copy,
  CurrencyDollar,
  Handshake,
  LinkSimple,
  Sparkle,
  UsersFour,
  Wallet,
} from "@phosphor-icons/react";
import { Link, useRouter } from "@/i18n/routing";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AffiliateProfileWithStats } from "@/lib/affiliate/types";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { cn } from "@/lib/utils";
import { getMyAffiliateAction } from "@/app/actions/affiliate";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";


function formatUSD(micros: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(micros / 1_000_000);
}

function formatInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function buildReferralUrl(code: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/register?ref=${encodeURIComponent(code)}`;
  }
  return `/register?ref=${encodeURIComponent(code)}`;
}


export default function AffiliatePage() {
  const t = useTranslations("affiliatePage");
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AffiliateProfileWithStats | null>(
    null,
  );
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await getMyAffiliateAction();
    if (res.notFound) {
      setNotFound(true);
      setProfile(null);
      setError(null);
    } else if (res.error) {
      setError(res.error);
    } else {
      setProfile(res.profile);
      setNotFound(false);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <CircleNotch
          className="h-8 w-8 animate-spin text-primary"
          weight="bold"
        />
      </div>
    );
  }

  if (notFound) {
    return (
      <AffiliateLanding
        onCta={() => router.push("/dashboard/affiliate/register")}
      />
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          {error ?? t("errors.loadProfile")}
        </p>
        <Button
          variant="secondary"
          onClick={() => void reload()}
          title={t("buttons.retry")}
        />
      </div>
    );
  }

  return (
    <AffiliateDashboard
      profile={profile}
      onCopy={(link) => {
        void navigator.clipboard.writeText(link).then(() => {
          toast({
            title: t("dashboard.referralLink.copiedTitle"),
            description: t("dashboard.referralLink.copiedDesc"),
          });
        });
      }}
    />
  );
}


function AffiliateLanding({ onCta }: { onCta: () => void }) {
  const t = useTranslations("affiliatePage");

  const perks = [
    {
      icon: CurrencyDollar,
      title: t("landing.perks.commission.title"),
      description: t("landing.perks.commission.description"),
    },
    {
      icon: Wallet,
      title: t("landing.perks.payout.title"),
      description: t("landing.perks.payout.description"),
    },
    {
      icon: ChartLineUp,
      title: t("landing.perks.track.title"),
      description: t("landing.perks.track.description"),
    },
    {
      icon: Sparkle,
      title: t("landing.perks.brand.title"),
      description: t("landing.perks.brand.description"),
    },
  ];

  const steps = [
    t("landing.steps.one"),
    t("landing.steps.two"),
    t("landing.steps.three"),
  ];

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-6"
    >
      <DashboardPageHeader
        icon={<Handshake className="h-5 w-5" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
      />

      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl border border-border bg-card/70 p-6 sm:p-10 backdrop-blur-sm"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground shadow-sm">
              <Sparkle className="h-3.5 w-3.5" weight="fill" />
              {t("landing.tagline")}
            </span>
            <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              {t("landing.title")}
            </h1>
            <p className="text-base text-muted-foreground">
              {t("landing.description")}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onCta}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-[hsl(var(--primary-hover))] active:scale-[0.98]"
              >
                {t("landing.cta")}
                <ArrowRight className="h-4 w-4" weight="bold" />
              </button>
              <span className="text-xs text-muted-foreground">
                {t("landing.ctaSub")}
              </span>
            </div>
          </div>

          <ol className="grid w-full max-w-md gap-3 lg:w-auto">
            {steps.map((step, i) => (
              <motion.li
                key={step}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 p-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-sm font-bold text-primary-foreground shadow-sm">
                  {i + 1}
                </span>
                <p className="pt-1 text-sm text-foreground">{step}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* Perks grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {perks.map((perk, i) => {
          const Icon = perk.icon;
          return (
            <motion.div
              key={perk.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-md">
                <Icon className="h-5 w-5" weight="fill" />
              </span>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {perk.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {perk.description}
              </p>
            </motion.div>
          );
        })}
      </section>
    </motion.main>
  );
}


function AffiliateDashboard({
  profile,
  onCopy,
}: {
  profile: AffiliateProfileWithStats;
  onCopy: (link: string) => void;
}) {
  const t = useTranslations("affiliatePage");
  const { affiliate, stats } = profile;

  const referralUrl = useMemo(
    () => buildReferralUrl(affiliate.code),
    [affiliate.code],
  );

  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    onCopy(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopy, referralUrl]);

  const cards = [
    {
      icon: UsersFour,
      label: t("dashboard.stats.referrals"),
      value: formatInt(stats.totalReferrals),
    },
    {
      icon: CurrencyDollar,
      label: t("dashboard.stats.totalEarnings"),
      value: formatUSD(stats.totalEarningMicros),
    },
    {
      icon: ChartLineUp,
      label: t("dashboard.stats.monthEarnings"),
      value: formatUSD(stats.monthEarningMicros),
    },
    {
      icon: Sparkle,
      label: t("dashboard.stats.commission"),
      value: formatPct(affiliate.commissionPct),
    },
  ];

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-6"
    >
      <DashboardPageHeader
        icon={<Handshake className="h-5 w-5" weight="fill" />}
        badge={t("header.badge")}
        description={t("dashboard.description", {
          brand: affiliate.brandName || affiliate.code || "—",
        })}
      />

      {/* Stats grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-sm">
                  <Icon className="h-4 w-4" weight="fill" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
                {card.value}
              </p>
            </motion.div>
          );
        })}
      </section>

      {/* Referral link card */}
      <section
        className="rounded-3xl border border-border bg-card/70 p-6 backdrop-blur-sm"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <LinkSimple className="h-3.5 w-3.5" weight="bold" />
              {t("dashboard.referralLink.badge")}
            </span>
            <h3 className="mt-1 text-lg font-semibold text-foreground">
              {t("dashboard.referralLink.title")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("dashboard.referralLink.description")}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex-1 overflow-hidden rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm text-foreground">
            <span className="block truncate">{referralUrl}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all",
              copied
                ? "bg-emerald-500 text-white"
                : "bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))] active:scale-[0.98]",
            )}
          >
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4" weight="fill" />
                {t("dashboard.referralLink.copied")}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" weight="bold" />
                {t("dashboard.referralLink.copy")}
              </>
            )}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Sparkle
              className="h-3.5 w-3.5 text-muted-foreground"
              weight="fill"
            />
            {t("dashboard.referralLink.code")}:
            <span className="font-mono font-semibold text-foreground">
              {affiliate.code}
            </span>
          </span>
        </div>
      </section>

      {/* Quick links */}
      <section className="grid gap-4 sm:grid-cols-2">
        <QuickLink
          href="/dashboard/affiliate/referrals"
          icon={UsersFour}
          title={t("dashboard.quickLinks.referrals.title")}
          description={t("dashboard.quickLinks.referrals.description")}
        />
        <QuickLink
          href="/dashboard/affiliate/earnings"
          icon={CurrencyDollar}
          title={t("dashboard.quickLinks.earnings.title")}
          description={t("dashboard.quickLinks.earnings.description")}
        />
      </section>
    </motion.main>
  );
}


function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof UsersFour;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/30"
      style={{ boxShadow: softSurfaceShadow }}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-md">
          <Icon className="h-5 w-5" weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"
          weight="bold"
        />
      </div>
    </Link>
  );
}
