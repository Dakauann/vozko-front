"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { useEmailFormat } from "@/components/email-campaigns/shared";
import { SubdomainField, subdomainReady } from "@/components/email-marketing/subdomain-field";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ChatCircleDots, CurrencyDollar, EnvelopeSimple, Globe, PaperPlaneTilt } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useSubdomainCheck } from "@/hooks/use-email-marketing";
import type { EmailActivationRefusal, EmailPricing, EmailSubdomain } from "@/lib/email-marketing/types";

const STEPS = [
  { key: "start", icon: PaperPlaneTilt },
  { key: "grow", icon: Globe },
  { key: "replies", icon: ChatCircleDots },
] as const;

const BYTES_PER_KB = 1024;

export const PLANS_PATH = "/dashboard/plans";

export function EmailOnboarding({
  pricing,
  pricingError,
  subdomain,
  canConfigure,
  activating,
  activationError,
  planRefusal,
  onActivate,
}: {
  pricing: EmailPricing | undefined;
  pricingError: string | null;
  subdomain: EmailSubdomain;
  canConfigure: boolean | null;
  activating: boolean;
  activationError: string | null;
  planRefusal: EmailActivationRefusal | null;
  onActivate: (slug: string) => void;
}) {
  const t = useTranslations("emailMarketing.onboarding");
  const tErrors = useTranslations("emailMarketing.errors");
  const { brl, unitBrl } = useEmailFormat();
  const format = useFormatter();
  const [slug, setSlug] = useState(subdomain.slug);
  const check = useSubdomainCheck(slug, canConfigure === true);

  return (
    <section aria-labelledby="email-onboarding-title" className="well overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <h2 id="email-onboarding-title" className="font-display text-2xl font-semibold leading-tight tracking-[0.01em] text-foreground">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{t("lead")}</p>

          <ol className="mt-7 space-y-0">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const last = index === STEPS.length - 1;
              return (
                <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
                  {last ? null : <span aria-hidden="true" className="absolute left-[15px] top-9 bottom-1 w-0.5 bg-border-strong" />}
                  <span
                    aria-hidden="true"
                    className={
                      index === 0
                        ? "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border-2 border-primary-edge bg-primary text-primary-foreground"
                        : "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border-2 border-control-edge bg-card text-foreground"
                    }
                  >
                    <Icon className="h-4 w-4" weight="bold" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm font-semibold text-foreground">{t(`steps.${step.key}.title`)}</h3>
                    <p className="mt-1 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">{t(`steps.${step.key}.text`)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="flex flex-col gap-4 border-t border-border bg-muted px-5 py-6 sm:px-8 lg:border-l lg:border-t-0 lg:px-6 lg:py-8">
          <div>
            <p className="legend">{t("priceLegend")}</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="readout font-display text-3xl font-semibold text-foreground">
                {pricing ? unitBrl(pricing.send.unitBRL) : <EmptyValue />}
              </span>
              <span className="text-sm text-muted-foreground">{t("perEmail")}</span>
            </p>
            {pricing ? (
              <p className="readout mt-1 text-sm text-muted-foreground">{t("perThousandLine", { price: brl(pricing.send.thousandBRL) ?? "" })}</p>
            ) : null}
            {pricing ? (
              <p className="readout mt-1 text-sm text-muted-foreground">
                {t("repliesLine", {
                  perReply: unitBrl(pricing.receive.perMessage.unitBRL) ?? "",
                  perChunk: unitBrl(pricing.receive.perChunk.unitBRL) ?? "",
                  size: `${format.number(pricing.receive.chunkBytes / BYTES_PER_KB)} KB`,
                })}
              </p>
            ) : null}
            {pricing ? (
              <p className="readout mt-1 text-sm text-muted-foreground">
                {t("attachmentsLine", {
                  perChunk: unitBrl(pricing.sendAttachments.perChunk.unitBRL) ?? "",
                  size: `${format.number(pricing.sendAttachments.chunkBytes / BYTES_PER_KB)} KB`,
                })}
              </p>
            ) : null}
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("priceNote")}</p>
            {pricingError ? <p className="mt-2 text-xs text-destructive-ink">{pricingError}</p> : null}
          </div>

          <div className="mt-auto space-y-3">
            {canConfigure === false ? (
              <Notice tone="warning" title={t("noPermissionTitle")}>
                <p>{t("noPermissionText")}</p>
              </Notice>
            ) : (
              <>
                <SubdomainField value={slug} onChange={setSlug} state={check} />
                <Button
                  className="w-full"
                  size="lg"
                  icon={<EnvelopeSimple className="h-4 w-4" weight="bold" />}
                  iconVisible
                  title={activating ? t("activating") : t("activate")}
                  disabled={activating || canConfigure !== true || planRefusal !== null || !subdomainReady(check)}
                  onClick={() => onActivate(slug)}
                />
              </>
            )}
            {planRefusal ? (
              <Notice tone="warning" title={t("planRequiredTitle")}>
                <p>{tErrors(planRefusal)}</p>
                {planRefusal === "email_plan_required" ? (
                  <Button
                    link={PLANS_PATH}
                    newTab={false}
                    size="sm"
                    variant="outline"
                    icon={<CurrencyDollar className="h-3.5 w-3.5" weight="bold" />}
                    iconVisible
                    title={t("seePlans")}
                  />
                ) : null}
              </Notice>
            ) : null}
            {activationError ? (
              <Notice tone="fault" title={t("activationFailed")}>
                <p>{activationError}</p>
              </Notice>
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground">{t("activateNote")}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
