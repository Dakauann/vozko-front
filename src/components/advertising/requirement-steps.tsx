"use client";

import { useTranslations } from "next-intl";

import { ArrowClockwise } from "@/components/icons";
import { usePortalPopup } from "@/hooks/use-portal-popup";

import { ExternalLink } from "./wizard/choice-row";

export function RecheckButton({ checking, onRecheck }: { checking: boolean; onRecheck: () => void }) {
  const t = useTranslations("adsRequirements");
  return (
    <button
      type="button"
      onClick={onRecheck}
      disabled={checking}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-ink hover:underline disabled:opacity-50"
    >
      <ArrowClockwise className={checking ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
      {checking ? t("checking") : t("recheck")}
    </button>
  );
}

export function RequirementSteps({
  title,
  steps,
  href,
  linkLabel,
  checking,
  onRecheck,
}: {
  title: string;
  steps: string[];
  href: string;
  linkLabel: string;
  checking: boolean;
  onRecheck: () => void;
}) {
  const { openPortal } = usePortalPopup(onRecheck);
  return (
    <div className="space-y-2 rounded-[--radius] border border-warning-ink/30 bg-muted px-3 py-2.5">
      <p className="text-sm font-semibold text-warning-ink">{title}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        <ExternalLink href={href} onOpen={openPortal}>
          {linkLabel}
        </ExternalLink>
        <RecheckButton checking={checking} onRecheck={onRecheck} />
      </div>
    </div>
  );
}

export function LeadTermsNotice({ pageName, href, checking, onRecheck }: { pageName: string; href: string; checking: boolean; onRecheck: () => void }) {
  const t = useTranslations("adsRequirements.leadTerms");
  return (
    <RequirementSteps
      title={t("title", { page: pageName })}
      steps={[t("open"), t("choosePage", { page: pageName }), t("accept"), t("comeBack")]}
      href={href}
      linkLabel={t("openButton")}
      checking={checking}
      onRecheck={onRecheck}
    />
  );
}
