"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { ElevatedSheet, ElevatedSheetContent, ElevatedSheetDescription, ElevatedSheetHeader, ElevatedSheetTitle } from "@/components/elevated-design/elevated-sheet";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ArrowClockwise, PaperPlaneTilt } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { publicationTone } from "@/lib/whatsapp-forms/status";
import type { FormDetail, Outcome, Problem, Publication, PublicationStatus, PublishTarget } from "@/lib/whatsapp-forms/types";
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
  target?: PublishTarget;
  updatedAt?: string;
}

const DEPRECATABLE: readonly PublicationStatus[] = ["published", "throttled", "blocked"];

export function accountRows(
  detail: FormDetail,
  outcomes: readonly Outcome[],
  phones: readonly WhatsAppBusinessPhone[],
  targets: readonly PublishTarget[],
): AccountRow[] {
  const ids: string[] = [];
  const add = (id: string) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  detail.publications.forEach((publication) => add(publication.metaWabaId));
  outcomes.forEach((outcome) => add(outcome.metaWabaId));
  phones.forEach((phone) => add(phone.wabaId));
  targets.forEach((target) => add(target.metaWabaId));
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
      target: targets.find((candidate) => candidate.metaWabaId === metaWabaId),
      updatedAt: publication?.updatedAt,
    };
  });
}

function defaultChoice(rows: readonly AccountRow[]): string[] {
  const publishable = rows.filter((row) => row.target?.supported);
  const live = publishable.filter((row) => row.publication && row.publication.status !== "deprecated").map((row) => row.metaWabaId);
  if (live.length > 0) return live;
  return publishable.length === 1 ? [publishable[0].metaWabaId] : [];
}

export function PublishPanel({
  open,
  onOpenChange,
  detail,
  outcomes,
  phones,
  targets,
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
  targets: readonly PublishTarget[];
  problems: readonly Problem[];
  publishing: boolean;
  canPublish: boolean;
  onPublish: (metaWabaIds: string[]) => void;
  onDeprecate: (metaWabaId: string) => Promise<void>;
  onJump: (problem: Problem) => void;
}) {
  const t = useTranslations("whatsappForms");
  const format = useFormatter();
  const [deprecating, setDeprecating] = useState<AccountRow | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const rows = accountRows(detail, outcomes, phones, targets);
  const chosen = picked ?? defaultChoice(rows);
  const toggle = (metaWabaId: string, on: boolean) =>
    setPicked(on ? [...chosen.filter((id) => id !== metaWabaId), metaWabaId] : chosen.filter((id) => id !== metaWabaId));

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
                  <label className="flex min-w-0 items-start gap-2">
                    {canPublish && row.target?.supported ? (
                      <Checkbox
                        className="mt-0.5"
                        checked={chosen.includes(row.metaWabaId)}
                        disabled={publishing}
                        onCheckedChange={(next) => toggle(row.metaWabaId, next === true)}
                        aria-label={t("publish.choose", { name: row.name })}
                      />
                    ) : null}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{row.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{row.numbers.length > 0 ? row.numbers.join(", ") : t("publish.noNumbers")}</span>
                    </span>
                  </label>
                  {row.status ? <StatusChip tone={publicationTone(row.status)} label={t(`status.${row.status}`)} /> : <StatusChip tone="outline" label={t("publish.notPublished")} />}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">{t("publish.version")}</dt>
                  <dd className="text-right text-foreground">{row.versionNumber !== null ? t("versions.number", { number: row.versionNumber }) : <EmptyValue />}</dd>
                  <dt className="text-muted-foreground">{t("publish.updated")}</dt>
                  <dd className="text-right text-foreground">{row.updatedAt ? format.dateTime(new Date(row.updatedAt), { dateStyle: "short", timeStyle: "short" }) : <EmptyValue />}</dd>
                </dl>
                {row.target && !row.target.supported ? (
                  <Notice tone="neutral" title={t("publish.unsupportedTitle")}>
                    <p>{t("publish.unsupportedBody")}</p>
                  </Notice>
                ) : null}
                {row.target?.supported && !row.target.businessVerified ? (
                  <Notice tone="warning" title={t("publish.unverifiedTitle")}>
                    <p>{t("publish.unverifiedBody")}</p>
                  </Notice>
                ) : null}
                {row.error ? <p className="text-xs text-foreground">{t("publish.lastError", { error: row.error })}</p> : null}
                {row.status === "blocked" ? <p className="text-xs text-muted-foreground">{t("publish.blockedSteps")}</p> : null}
                {row.status === "throttled" ? <p className="text-xs text-muted-foreground">{t("publish.throttledSteps")}</p> : null}
                {row.problems.length > 0 ? <ProblemList document={detail.draft.document} problems={row.problems} onJump={onJump} /> : null}
                {canPublish ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {row.status === "failed" && row.target?.supported ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        title={t("publish.retry")}
                        icon={<ArrowClockwise className="h-3.5 w-3.5" />}
                        iconVisible
                        iconSide="left"
                        disabled={publishing}
                        onClick={() => onPublish([row.metaWabaId])}
                      />
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
              title={
                publishing
                  ? t("publish.publishing")
                  : chosen.length === 0
                    ? t("publish.chooseAccount")
                    : detail.form.publishedVersionId
                      ? t("publish.confirmNew", { count: chosen.length })
                      : t("publish.confirm", { count: chosen.length })
              }
              icon={<PaperPlaneTilt className="h-4 w-4" weight="fill" />}
              iconVisible
              iconSide="left"
              disabled={publishing || chosen.length === 0}
              onClick={() => onPublish(chosen)}
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
