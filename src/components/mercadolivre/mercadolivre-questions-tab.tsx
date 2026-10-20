"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { Notice } from "@/components/ui/notice";
import { QUESTION_STATUS_FILTERS, type QuestionStatusFilter } from "@/lib/mercadolivre/questions";
import type { MercadoLivreAccount } from "@/lib/mercadolivre/types";

import type { MercadoLivreAccountTabProps } from "./mercadolivre-account-tabs";
import { MercadoLivreListingPicker } from "./mercadolivre-listing-picker";
import { MercadoLivreQuestionList } from "./mercadolivre-question-list";
import type { QuestionRowPermissions } from "./mercadolivre-question-row";
import { MercadoLivreResponseTime } from "./mercadolivre-response-time";

export function questionPermissions(account: MercadoLivreAccount, canUpdate: boolean): QuestionRowPermissions {
  const connected = account.status === "CONNECTED";
  return {
    canAnswer: canUpdate && connected && account.canAnswerQuestions,
    canModerate: canUpdate && connected,
  };
}

export function QuestionStatusFilters({ value, onChange }: { value: QuestionStatusFilter; onChange: (next: QuestionStatusFilter) => void }) {
  const t = useTranslations("mercadolivre.questions");
  return (
    <ElevatedPillToggle<QuestionStatusFilter>
      aria-label={t("statusFilterLabel")}
      value={value}
      onChange={onChange}
      className="max-w-full flex-wrap"
      options={QUESTION_STATUS_FILTERS.map((filter) => ({ value: filter, label: t(`statusFilter.${filter}`) }))}
    />
  );
}

export function QuestionGrantNotice({ account, canUpdate }: { account: MercadoLivreAccount; canUpdate: boolean }) {
  const t = useTranslations("mercadolivre.questions");
  if (!canUpdate) return null;
  if (account.status !== "CONNECTED") return <Notice tone="neutral">{t("accountOffline")}</Notice>;
  if (!account.canAnswerQuestions) return <Notice tone="neutral">{t("answerNotGranted")}</Notice>;
  return null;
}

export function MercadoLivreQuestionsTab({ account, canUpdate }: MercadoLivreAccountTabProps) {
  const t = useTranslations("mercadolivre.questions");
  const [status, setStatus] = useState<QuestionStatusFilter>("all");
  const [itemId, setItemId] = useState("");

  if (!account.canReadQuestions) {
    return <Notice tone="neutral">{t("readNotGranted")}</Notice>;
  }

  return (
    <div className="space-y-4">
      <MercadoLivreResponseTime accountId={account.id} />
      <QuestionGrantNotice account={account} canUpdate={canUpdate} />
      <ElevatedContainer className="overflow-hidden !p-0">
        <div className="space-y-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <QuestionStatusFilters value={status} onChange={setStatus} />
            <MercadoLivreListingPicker accountId={account.id} value={itemId} onChange={setItemId} className="md:max-w-xs" />
          </div>
        </div>
        <MercadoLivreQuestionList
          key={`${status}:${itemId}`}
          accountId={account.id}
          itemId={itemId}
          status={status}
          permissions={questionPermissions(account, canUpdate)}
          showListing={itemId === ""}
        />
      </ElevatedContainer>
    </div>
  );
}
