"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { isAdsError } from "@/app/actions/advertising";
import { validateMetaAdDraftAction } from "@/app/actions/advertising-create";
import { publishAdDraftAction } from "@/app/actions/advertising-drafts";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { CheckCircle, CircleNotch, WarningCircle } from "@/components/icons";
import { draftRowState, isEditableDraft } from "@/lib/advertising/manager-drafts";
import {
  draftOnlyBlockers,
  draftSummary,
  draftValidationKey,
  publishableDrafts,
  reviewBlockers,
  validationDone,
  type ReviewBlocker,
} from "@/lib/advertising/manager-publish";
import type { PublishBlocker, ValidationState } from "@/lib/advertising/publish";
import type { AdAccount, AdSavedDraft } from "@/lib/advertising/types";

import { FundsBanner } from "../funds-banner";
import { WizardReadinessBanner } from "../readiness";
import type { AdReadinessState } from "../use-ad-readiness";
import { useAdsErrorText } from "../use-ads-error";
import { IssueList } from "../wizard/field-issues";
import { FeeSummary, PublishBlockers, PublishNotes, type BlockerReadiness } from "../wizard/publish-check";

type PublishResult = { ok: true } | { ok: false; message: string };

function DraftCard({
  draft,
  campaignNames,
  validation,
  blockers,
  chosen,
  onChoose,
  onRevalidate,
  result,
  running,
  blockerReadiness,
}: {
  draft: AdSavedDraft;
  campaignNames: ReadonlyMap<string, string>;
  validation: ValidationState;
  blockers: ReviewBlocker[];
  chosen: boolean;
  onChoose: (chosen: boolean) => void;
  onRevalidate: () => void;
  result: PublishResult | undefined;
  running: boolean;
  blockerReadiness: BlockerReadiness;
}) {
  const t = useTranslations("adsManager.review");
  const summary = draftSummary(draft, campaignNames);
  const own = draftOnlyBlockers(blockers);
  const publishing = own.includes("publishing");
  const shown = own.filter((blocker): blocker is PublishBlocker => blocker !== "publishing");
  const fee = blockers.length === 0 && validation.status === "done" ? validation.fee : null;
  const id = `review-draft-${draft.id}`;

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-start gap-3">
        <Checkbox id={id} checked={chosen} disabled={publishing || running || !!result} onCheckedChange={(value) => onChoose(value === true)} className="mt-0.5" />
        <label htmlFor={id} className="min-w-0 flex-1 space-y-0.5">
          <span className="block truncate text-sm font-medium text-foreground">{summary.name ?? t("existingCampaign")}</span>
          <span className="block text-xs text-muted-foreground">
            {[summary.existingCampaignId ? t("inExistingCampaign") : null, t("counts", { adSets: summary.adSets, ads: summary.ads })]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </label>
        {result ? (
          result.ok ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-healthy-ink">
              <CheckCircle className="h-4 w-4" weight="fill" aria-hidden />
              {t("started")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive-ink">
              <WarningCircle className="h-4 w-4" weight="fill" aria-hidden />
              {t("failed")}
            </span>
          )
        ) : validation.status === "validating" ? (
          <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" aria-label={t("validating")} />
        ) : null}
      </div>
      <div className="space-y-2 pl-7">
        {result && !result.ok ? (
          <p className="text-xs text-destructive-ink" role="alert">
            {result.message}
          </p>
        ) : null}
        {publishing ? <p className="text-xs text-muted-foreground">{t("alreadyPublishing")}</p> : null}
        {!publishing && shown.length > 0 && !result ? <PublishBlockers blockers={shown} validation={validation} onRevalidate={onRevalidate} readiness={blockerReadiness} /> : null}
        {validation.status === "done" && !result ? <IssueList issues={validation.issues} /> : null}
        {fee && !result ? <FeeSummary fee={fee} ads={summary.ads} /> : null}
      </div>
    </li>
  );
}

function ReviewBody({
  drafts,
  preselected,
  account,
  readiness,
  canCreate,
  canPublish,
  campaignNames,
  onClose,
  onPublished,
  onRunningChange,
}: {
  drafts: AdSavedDraft[];
  preselected: string[] | null;
  account: AdAccount;
  readiness: AdReadinessState;
  canCreate: boolean;
  canPublish: boolean;
  campaignNames: ReadonlyMap<string, string>;
  onClose: () => void;
  onPublished: () => void;
  onRunningChange: (running: boolean) => void;
}) {
  const t = useTranslations("adsManager.review");
  const errorText = useAdsErrorText();
  const [validations, setValidations] = useState<Map<string, ValidationState>>(new Map());
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(preselected ?? drafts.filter((draft) => isEditableDraft(draftRowState(draft.state))).map((draft) => draft.id)),
  );
  const [results, setResults] = useState<Map<string, PublishResult>>(new Map());
  const [running, setRunning] = useState(false);
  const [revalidateToken, setRevalidateToken] = useState(0);
  const started = useRef(new Set<string>());

  useEffect(() => {
    for (const draft of drafts) {
      const key = draftValidationKey(draft);
      const runKey = `${key}#${revalidateToken}`;
      if (started.current.has(runKey)) continue;
      started.current.add(runKey);
      void validateMetaAdDraftAction(draft.draft).then((result) => {
        const state: ValidationState = isAdsError(result)
          ? { status: "failed", message: errorText(result), code: result.code }
          : validationDone(key, result.data);
        setValidations((current) => new Map(current).set(key, state));
      });
    }
  }, [drafts, revalidateToken, errorText]);

  const validationOf = (draft: AdSavedDraft): ValidationState => validations.get(draftValidationKey(draft)) ?? { status: "validating" };
  const blockersById = new Map(drafts.map((draft) => [draft.id, reviewBlockers(draft, readiness.readiness, validationOf(draft))]));
  const ready = canPublish ? publishableDrafts(drafts, blockersById, chosen).filter((id) => !results.has(id)) : [];
  const finished = results.size > 0 && !running;

  const revalidate = (draft: AdSavedDraft) => {
    setValidations((current) => {
      const next = new Map(current);
      next.delete(draftValidationKey(draft));
      return next;
    });
    setRevalidateToken((value) => value + 1);
  };

  const choose = (id: string, next: boolean) =>
    setChosen((current) => {
      const updated = new Set(current);
      if (next) updated.add(id);
      else updated.delete(id);
      return updated;
    });

  const publish = async () => {
    if (ready.length === 0 || running) return;
    setRunning(true);
    onRunningChange(true);
    const versions = new Map(drafts.map((draft) => [draft.id, draft.version]));
    for (const id of ready) {
      const version = versions.get(id);
      if (version === undefined) continue;
      const result = await publishAdDraftAction(id, version);
      setResults((current) => new Map(current).set(id, isAdsError(result) ? { ok: false, message: errorText(result) } : { ok: true }));
    }
    setRunning(false);
    onRunningChange(false);
    onPublished();
  };

  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
      </ElevatedDialogHeader>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto">
        <FundsBanner account={account} state={readiness} />
        <WizardReadinessBanner account={account} state={readiness} canCreate={canCreate} defaultOpen />
        {drafts.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
        <ul className="divide-y divide-border">
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              campaignNames={campaignNames}
              validation={validationOf(draft)}
              blockers={blockersById.get(draft.id) ?? []}
              chosen={chosen.has(draft.id)}
              onChoose={(next) => choose(draft.id, next)}
              onRevalidate={() => revalidate(draft)}
              result={results.get(draft.id)}
              running={running}
              blockerReadiness={{ account, state: readiness, canCreate }}
            />
          ))}
        </ul>
        <PublishNotes />
      </div>
      <ElevatedDialogFooter>
        <Button variant="ghost" size="sm" title={finished ? t("close") : t("cancel")} onClick={onClose} disabled={running} />
        {!finished ? (
          <Button
            variant="primary"
            size="sm"
            title={running ? t("publishing") : t("publish", { count: ready.length })}
            onClick={() => void publish()}
            disabled={running || ready.length === 0}
          />
        ) : null}
      </ElevatedDialogFooter>
    </>
  );
}

export function PublishReviewDialog({
  open,
  drafts,
  preselected,
  account,
  readiness,
  canCreate,
  canPublish,
  campaignNames,
  onClose,
  onPublished,
}: {
  open: boolean;
  drafts: AdSavedDraft[];
  preselected: string[] | null;
  account: AdAccount;
  readiness: AdReadinessState;
  canCreate: boolean;
  canPublish: boolean;
  campaignNames: ReadonlyMap<string, string>;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <ElevatedDialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <ElevatedDialogContent className="sm:max-w-2xl">
        {open ? (
          <ReviewBody
            drafts={drafts}
            preselected={preselected}
            account={account}
            readiness={readiness}
            canCreate={canCreate}
            canPublish={canPublish}
            campaignNames={campaignNames}
            onClose={onClose}
            onPublished={onPublished}
            onRunningChange={setBusy}
          />
        ) : null}
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
