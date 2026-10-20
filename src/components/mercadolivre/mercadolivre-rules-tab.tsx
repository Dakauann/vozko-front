"use client";

import { useTranslations } from "next-intl";

import type { MercadoLivreAccount } from "@/lib/mercadolivre/types";

import type { MercadoLivreAccountTabProps } from "./mercadolivre-account-tabs";
import { MercadoLivreCommentRulesPanel } from "./mercadolivre-comment-rules-panel";

export function useRuleManagement(account: MercadoLivreAccount, canUpdate: boolean) {
  const t = useTranslations("mercadolivre.commentRules");
  if (!canUpdate) return { canManage: false, disabledReason: t("noPermission") };
  if (account.status !== "CONNECTED") return { canManage: false, disabledReason: t("accountOffline") };
  return { canManage: true, disabledReason: undefined };
}

export function MercadoLivreRulesTab({ account, canUpdate }: MercadoLivreAccountTabProps) {
  const management = useRuleManagement(account, canUpdate);
  return <MercadoLivreCommentRulesPanel accountId={account.id} {...management} />;
}
