"use client";

import { useTranslations } from "next-intl";

import { ArrowClockwise, CheckCircle, Info, Warning, WarningCircle } from "@/components/icons";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import type { AdDraftFee } from "@/lib/advertising/draft-types";
import { nodeOfIssue, type EditorNode } from "@/lib/advertising/editor-tree";
import type { PublishBlocker, ValidationState } from "@/lib/advertising/publish";
import { readinessKey } from "@/lib/advertising/readiness";
import type { DraftIssue } from "@/lib/advertising/wizard-issues";
import type { AdAccount } from "@/lib/advertising/types";
import { formatMicrosAsBrl } from "@/lib/pricing/currency";

import { ReadinessItemAction } from "../readiness";
import type { AdReadinessState } from "../use-ad-readiness";

import { Hint, ReadOnlyFact } from "./choice-row";
import { useIssueMessage } from "./field-issues";

export interface BlockerReadiness {
  account: AdAccount;
  state: AdReadinessState;
  canCreate: boolean;
}

export function PublishBlockers({
  blockers,
  validation,
  onRevalidate,
  readiness,
}: {
  blockers: PublishBlocker[];
  validation: ValidationState;
  onRevalidate: () => void;
  readiness: BlockerReadiness;
}) {
  const t = useTranslations("adsWizard.review.blockers");
  const tReview = useTranslations("adsWizard.review");
  const tReadiness = useTranslations("adsReadiness.items");
  const issueCount = validation.status === "done" ? validation.issues.length : 0;
  const text = (blocker: PublishBlocker) => {
    const readiness = readinessKey(blocker);
    if (readiness) return tReadiness(`${readiness}.title`);
    switch (blocker) {
      case "validationFailed":
        return t("validationFailed", { message: validation.status === "failed" ? validation.message : "" });
      case "issues":
        return t("issues", { count: issueCount });
      default:
        return t(blocker);
    }
  };

  if (blockers.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-healthy-ink">
        <CheckCircle className="h-4 w-4" weight="fill" aria-hidden />
        {tReview("ready")}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-[--radius] border border-border bg-muted px-3 py-2.5" role="status">
      <p className="text-sm font-semibold text-foreground">{t("title")}</p>
      <ul className="space-y-1">
        {blockers.map((blocker) => {
          const item = readiness.state.readiness?.items.find((candidate) => candidate.key === blocker);
          return (
            <li key={blocker} className="flex items-start gap-2 text-sm text-warning-ink">
              <Warning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 space-y-1">
                <span>{text(blocker)}</span>
                {item ? <ReadinessItemAction item={item} account={readiness.account} state={readiness.state} canCreate={readiness.canCreate} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
      {!blockers.includes("validating") ? (
        <button
          type="button"
          onClick={onRevalidate}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-ink hover:underline"
        >
          <ArrowClockwise className="h-3.5 w-3.5" aria-hidden />
          {t("revalidate")}
        </button>
      ) : null}
    </div>
  );
}

export function useNodeLabel() {
  const t = useTranslations("adsEditor.levels");
  return (node: EditorNode) => (node.level === "ad" ? t("adNumbered", { index: node.index + 1 }) : t(node.level));
}

export function IssueLinks({ issues, onGoTo }: { issues: DraftIssue[]; onGoTo: (node: EditorNode) => void }) {
  const t = useTranslations("adsWizard.review");
  const message = useIssueMessage();
  const nodeLabel = useNodeLabel();
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {issues.map((issue) => {
        const node = nodeOfIssue(issue.field);
        return (
          <li key={`${issue.field}-${issue.code}`} className="flex items-start gap-2 text-sm text-destructive-ink">
            <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              {message(issue)}
              {node ? <span className="block text-2xs text-muted-foreground">{nodeLabel(node)}</span> : null}
            </span>
            {node ? (
              <button type="button" onClick={() => onGoTo(node)} className="shrink-0 text-xs font-semibold text-primary-ink hover:underline">
                {t("fix")}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function FeeSummary({ fee, ads }: { fee: AdDraftFee; ads: number }) {
  const t = useTranslations("adsWizard.review");
  const exchangeRate = useExchangeRate();
  return (
    <dl className="divide-y divide-border rounded-[--radius] border border-border bg-muted px-3 text-sm">
      <ReadOnlyFact label={t("feePerAd")} value={<span className="tabular-nums">{formatMicrosAsBrl(fee.price, exchangeRate) ?? "…"}</span>} />
      <ReadOnlyFact
        label={t("feeTotal", { count: ads })}
        value={<span className="font-semibold tabular-nums">{formatMicrosAsBrl(fee.total, exchangeRate) ?? "…"}</span>}
      />
    </dl>
  );
}

export function PublishNotes() {
  const t = useTranslations("adsWizard.review");
  return (
    <div className="space-y-2 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
      <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t("pausedNote")}</Hint>
      <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t("reviewNote")}</Hint>
      <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t("spendNote")}</Hint>
    </div>
  );
}
