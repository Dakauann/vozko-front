"use client";

import { useTranslations } from "next-intl";

import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { missingPortal } from "@/lib/advertising/page-capabilities";
import type { AdPage } from "@/lib/advertising/types";

import { LeadTermsNotice } from "../requirement-steps";
import { Hint } from "./choice-row";
import { FieldIssues } from "./field-issues";
import { useWizard } from "./wizard-context";

const NO_INSTAGRAM = "none";

export function IdentityFields({ instagramRequired = false }: { instagramRequired?: boolean }) {
  const t = useTranslations("adsWizard.identity");
  const { form, update, pages, page, issues } = useWizard();
  const list: AdPage[] = pages.status === "ready" ? pages.data : [];
  const termsPortal = page && form.destination === "ON_AD" ? missingPortal(page, "lead_forms") : null;

  const choosePage = (pageId: string) => {
    const next = list.find((candidate) => candidate.pageId === pageId);
    const numbers = next?.numbers ?? [];
    update((current) => ({
      ...current,
      pageId,
      instagramUserId: next?.instagramUserId ?? "",
      whatsAppNumber: numbers.length === 1 ? numbers[0].number : "",
      ads: current.ads.map((ad) => ({ ...ad, post: null, leadFormId: "", instantExperienceId: "" })),
    }));
  };

  return (
    <div className="space-y-3">
      {pages.status === "loading" ? <div className="h-11 animate-pulse rounded-[--radius] bg-muted" /> : null}
      {pages.status === "error" ? <p className="text-sm text-destructive-ink">{pages.message}</p> : null}
      {pages.status === "ready" && list.length === 0 ? <p className="text-sm text-muted-foreground">{t("noPages")}</p> : null}
      {list.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ElevatedSelect label={t("page")} value={form.pageId} onValueChange={choosePage}>
            {list.map((candidate) => (
              <ElevatedSelectItem key={candidate.pageId} value={candidate.pageId} disabled={!candidate.canAdvertise}>
                {candidate.canAdvertise ? candidate.name : t("pageCannotAdvertise", { name: candidate.name })}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          <ElevatedSelect
            label={t("instagram")}
            value={form.instagramUserId || NO_INSTAGRAM}
            disabled={!page}
            onValueChange={(value) => update((current) => ({ ...current, instagramUserId: value === NO_INSTAGRAM ? "" : value }))}
          >
            {!instagramRequired ? <ElevatedSelectItem value={NO_INSTAGRAM}>{t("instagramNone")}</ElevatedSelectItem> : null}
            {page?.instagramUserId ? (
              <ElevatedSelectItem value={page.instagramUserId}>
                {page.instagramUsername ? `@${page.instagramUsername}` : page.instagramUserId}
              </ElevatedSelectItem>
            ) : null}
          </ElevatedSelect>
        </div>
      ) : null}
      {page && !page.instagramUserId ? <Hint>{t("noInstagram")}</Hint> : <Hint>{t("hint")}</Hint>}
      {page && termsPortal ? <LeadTermsNotice pageName={page.name} href={termsPortal} checking={pages.status === "loading"} onRecheck={pages.reload} /> : null}
      <FieldIssues issues={issues} field="identity" nested />
      <FieldIssues issues={issues} field="adSet.instagramUserId" />
    </div>
  );
}
