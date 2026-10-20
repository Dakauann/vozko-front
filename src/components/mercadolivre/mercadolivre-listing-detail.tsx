"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { ArrowLeft, ArrowSquareOut, ChatCircleDots, TreeStructure } from "@/components/icons";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { listingStatusKey, listingStatusTone, type QuestionStatusFilter } from "@/lib/mercadolivre/questions";
import type { MercadoLivreAccount, MercadoLivreListing } from "@/lib/mercadolivre/types";

import { MercadoLivreCommentRulesPanel } from "./mercadolivre-comment-rules-panel";
import { MercadoLivreListingThumb } from "./mercadolivre-listing-thumb";
import { MercadoLivreQuestionList } from "./mercadolivre-question-list";
import { QuestionGrantNotice, QuestionStatusFilters, questionPermissions } from "./mercadolivre-questions-tab";
import { useRuleManagement } from "./mercadolivre-rules-tab";

export function MercadoLivreListingDetail({
  account,
  listing,
  canUpdate,
  onBack,
}: {
  account: MercadoLivreAccount;
  listing: MercadoLivreListing;
  canUpdate: boolean;
  onBack: () => void;
}) {
  const t = useTranslations("mercadolivre");
  const [status, setStatus] = useState<QuestionStatusFilter>("all");
  const rules = useRuleManagement(account, canUpdate);

  return (
    <div className="space-y-4">
      <Button
        size="sm"
        variant="ghost"
        title={t("listings.back")}
        icon={<ArrowLeft className="h-4 w-4" />}
        iconVisible
        iconSide="left"
        onClick={onBack}
      />
      <ElevatedContainer className="flex items-center gap-3 p-4">
        <MercadoLivreListingThumb url={listing.thumbnailUrl} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">{listing.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{listing.itemId}</span>
            <StatusChip tone={listingStatusTone(listing.status)} label={t(listingStatusKey(listing.status))} className="px-1.5 py-0 text-2xs" />
          </div>
        </div>
        {listing.permalink ? (
          <a
            href={listing.permalink}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowSquareOut className="h-3.5 w-3.5" />
            {t("listings.viewOnMercadoLivre")}
          </a>
        ) : null}
      </ElevatedContainer>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions" className="gap-1.5">
            <ChatCircleDots className="h-4 w-4" weight="fill" />
            {t("listings.detailTabs.questions")}
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <TreeStructure className="h-4 w-4" weight="fill" />
            {t("listings.detailTabs.rules")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="questions" className="mt-4 space-y-4">
          {account.canReadQuestions ? (
            <>
              <QuestionGrantNotice account={account} canUpdate={canUpdate} />
              <ElevatedContainer className="overflow-hidden !p-0">
                <div className="space-y-3 border-b border-border px-5 py-3">
                  <p className="text-xs text-muted-foreground">{t("questions.listingSubtitle")}</p>
                  <QuestionStatusFilters value={status} onChange={setStatus} />
                </div>
                <MercadoLivreQuestionList
                  key={status}
                  accountId={account.id}
                  itemId={listing.itemId}
                  status={status}
                  permissions={questionPermissions(account, canUpdate)}
                  showListing={false}
                />
              </ElevatedContainer>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("questions.readNotGranted")}</p>
          )}
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <MercadoLivreCommentRulesPanel accountId={account.id} itemId={listing.itemId} {...rules} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
