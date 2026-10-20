"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedSheet, ElevatedSheetContent, ElevatedSheetDescription, ElevatedSheetHeader, ElevatedSheetTitle } from "@/components/elevated-design/elevated-sheet";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ArrowClockwise, PaperPlaneTilt } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { publicationTone } from "@/lib/whatsapp-forms/status";
import type { FormDetail, Outcome, Problem, Publication, PublicationStatus } from "@/lib/whatsapp-forms/types";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";

import { ProblemList } from "./ProblemList";

export interface AccountRow {
  metaWabaId: string;
  name: string;
  status: PublicationStatus | null;
  versionNumber: number | null;
  numbers: string[];
  error?: string;
  problems: Problem[];
  publication?: Publication;
  updatedAt?: string;
}

const DEPRECATABLE: readonly PublicationStatus[] = ["published", "throttled", "blocked"];

export function accountRows(detail: FormDetail, outcomes: readonly Outcome[], phones: readonly WhatsAppBusinessPhone[]): AccountRow[] {
  const ids: string[] = [];
  const add = (id: string) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  detail.publications.forEach((publication) => add(publication.metaWabaId));
  outcomes.forEach((outcome) => add(outcome.metaWabaId));
  phones.forEach((phone) => add(phone.wabaId));
  const versionNumber = (versionId: string | undefined) => {
    if (!versionId) return null;
    if (detail.published?.id === versionId) return detail.published.number;
    if (detail.draft.id === versionId) return detail.draft.number;
    return null;
  };
  return ids.map((metaWabaId) => {
    const publication = detail.publications.find((candidate) => candidate.metaWabaId === metaWabaId);
    const outcome = outcomes.find((candidate) => candidate.metaWabaId === metaWabaId);
    const owned = phones.filter((phone) => phone.wabaId === metaWabaId || (publication && phone.wabaId === publication.wabaId));
    return {
      metaWabaId,
      name: owned.find((phone) => phone.wabaName)?.wabaName ?? metaWabaId,
      status: outcome?.status ?? publication?.status ?? null,
      versionNumber: versionNumber(publication?.versionId),
      numbers: owned.map((phone) => formatPhoneForDisplay(phone.displayPhoneNumber)),
      error: outcome?.error ?? publication?.lastError,
      problems: outcome?.problems ?? publication?.problems ?? [],
      publication,
      updatedAt: publication?.updatedAt,
    };
  });
}

export function PublishPanel({
  open,
  onOpenChange,
  detail,
  outcomes,
  phones,
  problems,
  publishing,
  canPublish,
  onPublish,
  onDeprecate,
  onJump,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: FormDetail;
  outcomes: readonly Outcome[];
  phones: readonly WhatsAppBusinessPhone[];
  problems: readonly Problem[];
  publishing: boolean;
  canPublish: boolean;
  onPublish: () => void;
  onDeprecate: (metaWabaId: string) => Promise<void>;
  onJump: (problem: Problem) => void;
}) {
  const t = useTranslations("whatsappForms");
  const format = useFormatter();
  const [deprecating, setDeprecating] = useState<AccountRow | null>(null);
  const rows = accountRows(detail, outcomes, phones);

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle>{t("publish.title")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{t("publish.description")}</ElevatedSheetDescription>
        </ElevatedSheetHeader>
        <div className="space-y-5 px-6 pb-6">
          {problems.length > 0 ? (
            <section className="space-y-2 rounded-[--radius] border border-border p-3">
              <h3 className="text-sm font-semibold text-foreground">{t("publish.problemsTitle")}</h3>
              <ProblemList document={detail.draft.document} problems={problems} onJump={onJump} />
            </section>
          ) : null}

          {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("publish.noAccounts")}</p> : null}
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.metaWabaId} className="space-y-2 rounded-[--radius] border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.numbers.length > 0 ? row.numbers.join(", ") : t("publish.noNumbers")}</p>
                  </div>
                  {row.status ? <StatusChip tone={publicationTone(row.status)} label={t(`status.${row.status}`)} /> : <StatusChip tone="outline" label={t("publish.notPublished")} />}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">{t("publish.version")}</dt>
                  <dd className="text-right text-foreground">{row.versionNumber !== null ? t("versions.number", { number: row.versionNumber }) : <EmptyValue />}</dd>
                  <dt className="text-muted-foreground">{t("publish.updated")}</dt>
                  <dd className="text-right text-foreground">{row.updatedAt ? format.dateTime(new Date(row.updatedAt), { dateStyle: "short", timeStyle: "short" }) : <EmptyValue />}</dd>
                </dl>
                {row.error ? <p className="text-xs text-foreground">{t("publish.lastError", { error: row.error })}</p> : null}
                {row.status === "blocked" ? <p className="text-xs text-muted-foreground">{t("publish.blockedSteps")}</p> : null}
                {row.status === "throttled" ? <p className="text-xs text-muted-foreground">{t("publish.throttledSteps")}</p> : null}
                {row.problems.length > 0 ? <ProblemList document={detail.draft.document} problems={row.problems} onJump={onJump} /> : null}
                {canPublish ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {row.status === "failed" ? (
                      <Button variant="secondary" size="sm" title={t("publish.retry")} icon={<ArrowClockwise className="h-3.5 w-3.5" />} iconVisible iconSide="left" disabled={publishing} onClick={onPublish} />
                    ) : null}
                    {row.status && DEPRECATABLE.includes(row.status) ? (
                      <Button variant="ghost" size="sm" title={t("publish.deprecate")} disabled={publishing} onClick={() => setDeprecating(row)} />
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {canPublish ? (
            <Button
              variant="primary"
              className="w-full"
              title={publishing ? t("publish.publishing") : detail.form.publishedVersionId ? t("publish.confirmNew") : t("publish.confirm")}
              icon={<PaperPlaneTilt className="h-4 w-4" weight="fill" />}
              iconVisible
              iconSide="left"
              disabled={publishing}
              onClick={onPublish}
            />
          ) : (
            <p className="text-xs text-muted-foreground">{t("publish.noPermission")}</p>
          )}
        </div>
      </ElevatedSheetContent>
      <ConfirmDialog
        open={deprecating !== null}
        onOpenChange={(next) => !next && setDeprecating(null)}
        title={t("publish.deprecateTitle")}
        description={t("publish.deprecateDescription", { name: deprecating?.name ?? "" })}
        confirmLabel={t("publish.deprecate")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onConfirm={async () => {
          if (deprecating) await onDeprecate(deprecating.metaWabaId);
          setDeprecating(null);
        }}
      />
    </ElevatedSheet>
  );
}
