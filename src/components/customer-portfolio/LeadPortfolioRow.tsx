"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { UserCheck } from "@/components/icons";
import { DetailRow } from "@/components/leads/detail/DetailRow";
import { useLeadHolding, usePortfolioAccess } from "@/hooks/use-customer-portfolio";
import { holdingState } from "@/lib/customer-portfolio/portfolio";

import { usePortfolioCommands } from "./use-portfolio-commands";

export function LeadPortfolioRow({ leadId }: { leadId: string }) {
  const t = useTranslations("customerPortfolio");
  const { views, uses, userId } = usePortfolioAccess();
  const holding = useLeadHolding(leadId);
  const { busy, placeLead, remove } = usePortfolioCommands();
  if (!views) return null;

  const current = holding.data;
  const state = current ? holdingState(current, userId) : null;
  const entry = current?.entry ?? null;

  const action =
    state === "free" && uses ? (
      <Button variant="ghost" size="sm" title={t("lead.add")} disabled={busy} onClick={() => void placeLead(leadId)} />
    ) : state === "mine" && uses && entry ? (
      <Button variant="ghost" size="sm" title={t("lead.remove")} disabled={busy} onClick={() => void remove(entry.id)} />
    ) : undefined;

  return (
    <DetailRow icon={<UserCheck />} label={t("lead.label")} action={action}>
      <span className="inline-flex items-center gap-1.5">
        {state === "free" ? (
          <span className="font-normal text-muted-foreground">{t("lead.none")}</span>
        ) : state === "mine" ? (
          t("lead.mine")
        ) : state === "other" && entry ? (
          t("lead.other", { name: entry.holderName || t("page.unknownMember") })
        ) : holding.isError ? (
          <EmptyValue />
        ) : (
          <span className="font-normal text-muted-foreground">…</span>
        )}
        <ExplainerHint id="crm.customerPortfolio" align="end" />
      </span>
    </DetailRow>
  );
}
