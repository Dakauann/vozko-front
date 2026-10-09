"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { PaperPlaneTilt } from "@/components/icons";
import { TypedCountConfirm } from "@/components/leads/bulk/PreviewStateBox";
import { useLeadActionPreview } from "@/components/leads/bulk/use-lead-action-preview";
import type { LeadActionRequest, LeadSelection } from "@/lib/leads/actions";
import { typedCountMatches } from "@/lib/leads/bulk-selection";
import { sendBudgetView, sendChannelOf, type LeadSendAction } from "@/lib/leads/sends";

import { SendQuoteSummary } from "./SendQuoteSummary";
import { SendReviewPanel } from "./SendReviewPanel";
import { SelectionSummaryLine } from "./SelectionSummaryLine";
import { SendSteps } from "./SendSteps";
import { useSendErrorText } from "./send-copy";
import { useLeadSendFlow } from "./use-lead-send-flow";

export const STEP_COMPOSE = 0;
export const STEP_VARIABLES = 1;
export const STEP_REVIEW = 2;

export interface LeadSendDialogProps {
  selection: LeadSelection;
  size: number;
  onClose: () => void;
}

export function useLeadSendDialog({
  action,
  request,
  onClose,
  onDepartmentRequired,
}: {
  action: LeadSendAction;
  request: LeadActionRequest | null;
  onClose: () => void;
  onDepartmentRequired: () => void;
}) {
  const t = useTranslations("leadSends");
  const [step, setStep] = useState(STEP_COMPOSE);
  const [firstN, setFirstN] = useState(false);
  const [typed, setTyped] = useState("");
  const [changedFrom, setChangedFrom] = useState<number | null>(null);
  const flow = useLeadSendFlow({ onLeftBehind: () => toast.error(t("leftBehind")) });
  const preview = useLeadActionPreview(step >= STEP_VARIABLES ? request : null);

  const close = () => {
    if (flow.busy) return;
    onClose();
    void flow.discard().then((clean) => {
      if (!clean) toast.error(t("cancelFailed"));
    });
  };

  const review = async () => {
    const current = preview.preview;
    if (!request || !current) return;
    setChangedFrom(null);
    const outcome = await flow.prepare(request, current);
    if (outcome === "ready") {
      setFirstN(false);
      setTyped("");
      setStep(STEP_REVIEW);
    }
    if (outcome === "changed") {
      setChangedFrom(current.result.expectedCount);
      void preview.refetch();
    }
    if (outcome === "department") {
      onDepartmentRequired();
      setStep(STEP_COMPOSE);
    }
  };

  const send = async () => {
    const prepared = flow.review;
    if (!prepared) return;
    const budget = sendBudgetView(prepared);
    const started = await flow.start(firstN && budget.kind === "partial" ? budget.fits : undefined);
    if (!started) return;
    toast.success(t("done", { count: started.eligible }));
    onClose();
  };

  return {
    action,
    request,
    step,
    setStep,
    firstN,
    setFirstN,
    typed,
    setTyped,
    changedFrom,
    flow,
    preview,
    close,
    review,
    send,
    clearChanged: () => setChangedFrom(null),
  };
}

export type LeadSendDialogState = ReturnType<typeof useLeadSendDialog>;

export function LeadSendDialogFrame({
  state,
  selection,
  size,
  steps,
  canContinue,
  split,
  onSplit,
  compose,
  variables,
  summary,
}: {
  state: LeadSendDialogState;
  selection: LeadSelection;
  size: number;
  steps: readonly string[];
  canContinue: boolean;
  split: boolean;
  onSplit: (split: boolean) => void;
  compose: ReactNode;
  variables: ReactNode;
  summary: ReactNode;
}) {
  const t = useTranslations("leadSends");
  const tBulk = useTranslations("leadsPage.bulk");
  const errorText = useSendErrorText();
  const { action, step, flow, preview } = state;
  const prepared = flow.review;

  const count = prepared?.entries ?? (selection.mode === "ids" ? size : (preview.preview?.result.selected ?? null));
  const title = count === null ? t(`titlePending.${action}`) : t(`title.${action}`, { count });
  const refusal = preview.refusal ? errorText(preview.refusal) : null;
  const quote = preview.preview?.send;
  const reviewable =
    state.request !== null &&
    !preview.loading &&
    !refusal &&
    quote !== undefined &&
    !quote.splitRequired &&
    (preview.preview?.result.expectedCount ?? 0) > 0;

  const budget = prepared ? sendBudgetView(prepared) : null;
  const everyone = selection.mode === "everyone";
  const typedOk = !everyone || (prepared !== null && typedCountMatches(state.typed, prepared.entries));
  const sendable =
    prepared !== null &&
    !prepared.started &&
    budget !== null &&
    (budget.kind === "fits" || (budget.kind === "partial" && state.firstN)) &&
    typedOk;
  const recipients = prepared && budget?.kind === "partial" && state.firstN ? budget.fits : (prepared?.eligible ?? 0);
  const busy = flow.busy !== null;

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && state.close()}>
      <ElevatedDialogContent className="max-h-[min(90vh,860px)] sm:max-w-[760px]">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{title}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{tBulk(`dialog.selection.${selection.mode}`, { count: size })}</ElevatedDialogDescription>
          {selection.filter ? <SelectionSummaryLine filter={selection.filter} /> : null}
          <SendSteps steps={steps} current={step} />
        </ElevatedDialogHeader>

        <ElevatedDialogBody className="space-y-4">
          {step === STEP_COMPOSE ? compose : null}

          {step === STEP_VARIABLES ? (
            <div className="space-y-4">
              {variables}
              <SendQuoteSummary
                channel={sendChannelOf(action)}
                waiting={state.request === null}
                preview={preview.preview}
                loading={preview.loading}
                refusal={refusal}
                split={split}
                onSplit={(next) => {
                  onSplit(next);
                  state.clearChanged();
                }}
                onRetry={() => void preview.refetch()}
              />
              {state.changedFrom !== null && preview.preview && !preview.loading ? (
                <p role="status" className="text-sm font-medium text-foreground">
                  {tBulk("dialog.changed", { previous: state.changedFrom, count: preview.preview.result.expectedCount })}
                </p>
              ) : null}
              {flow.busy === "preparing" ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {t("review.preparing")}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === STEP_REVIEW && prepared ? (
            <div className="space-y-4">
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                <div className="grid content-start gap-2.5">{summary}</div>
                <SendReviewPanel review={prepared} firstN={state.firstN} onFirstN={state.setFirstN} />
              </div>
              {everyone ? <TypedCountConfirm count={prepared.entries} value={state.typed} onChange={state.setTyped} /> : null}
            </div>
          ) : null}

          {flow.failure ? (
            <p role="alert" className="text-sm text-destructive-ink">
              {errorText(flow.failure)}
            </p>
          ) : null}
        </ElevatedDialogBody>

        <ElevatedDialogFooter className="sm:items-center">
          {step === STEP_REVIEW ? <p className="mr-auto text-xs text-muted-foreground">{t("review.stopped")}</p> : null}
          {step === STEP_COMPOSE ? (
            <Button variant="secondary" title={tBulk("dialog.cancel")} onClick={state.close} disabled={busy} />
          ) : (
            <Button
              variant="secondary"
              title={t("actions.back")}
              onClick={() => {
                flow.clearFailure();
                state.setStep(step - 1);
              }}
              disabled={busy}
            />
          )}
          {step === STEP_COMPOSE ? (
            <Button variant="primary" title={t("actions.next")} onClick={() => state.setStep(STEP_VARIABLES)} disabled={!canContinue} />
          ) : null}
          {step === STEP_VARIABLES ? (
            <Button
              variant="primary"
              title={flow.busy === "preparing" ? t("actions.preparing") : t("actions.review")}
              onClick={() => void state.review()}
              disabled={!reviewable || busy}
            />
          ) : null}
          {step === STEP_REVIEW ? (
            <Button
              variant="primary"
              icon={<PaperPlaneTilt className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              title={flow.busy === "starting" ? t("actions.sending") : t("actions.send", { count: recipients })}
              onClick={() => void state.send()}
              disabled={!sendable || busy}
            />
          ) : null}
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
