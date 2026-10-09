"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CircleNotch, WarningCircle } from "@/components/icons";
import { LeadActionCountRows } from "@/components/leads/bulk/LeadActionCounts";
import { PreviewStateBox } from "@/components/leads/bulk/PreviewStateBox";
import { useFinishedLeadActionPreview, type FinishedPreviewProblem } from "@/components/leads/bulk/use-lead-action-preview";
import { CountedNotice, SendBudgetNotice, SendCounts, SendPartsNote, SendQuoteFacts } from "@/components/leads/sends/SendReviewPanel";
import { useSendErrorText } from "@/components/leads/sends/send-copy";
import {
  leadActionProposalCounts,
  parseLeadActionProposal,
  showsQuoteFacts,
  withFinishedCount,
  type LeadActionProposal,
} from "@/lib/aichat/lead-action-proposal";
import { isLeadSendAction } from "@/lib/leads/actions";
import { sendBudgetView, sendChannelOf, type LeadSendAction } from "@/lib/leads/sends";

const BOX = "grid gap-3 rounded-lg border border-border bg-muted p-3";

export function LeadActionProposalPreview({ data, open }: { data: unknown; open: boolean }) {
  const proposal = parseLeadActionProposal(data);
  if (!proposal) return null;
  if (proposal.stage === "cancel") return <DiscardedSends proposal={proposal} />;
  if (proposal.partial && proposal.previewId) return <CountingPreview proposal={proposal} previewId={proposal.previewId} open={open} />;
  return <CountedPreview proposal={proposal} footer={proposal.partial ? <PartialNote /> : null} />;
}

function CountingPreview({ proposal, previewId, open }: { proposal: LeadActionProposal; previewId: string; open: boolean }) {
  const { preview, problem, counting, refetch } = useFinishedLeadActionPreview(previewId, open);
  const shown = preview ? withFinishedCount(proposal, preview) : proposal;
  if (!open || !shown.partial) return <CountedPreview proposal={shown} footer={shown.partial ? <PartialNote /> : null} />;
  return <CountedPreview proposal={shown} footer={counting ? <CountingNote /> : <UnfinishedNote problem={problem} onRetry={() => void refetch()} />} />;
}

function CountedPreview({ proposal, footer }: { proposal: LeadActionProposal; footer: ReactNode }) {
  return (
    <div className={BOX}>
      {isLeadSendAction(proposal.action) ? <SendPreview proposal={proposal} action={proposal.action} /> : <RecordsPreview proposal={proposal} />}
      {footer}
    </div>
  );
}

function CountingNote() {
  const t = useTranslations("aiChatPage.previews.leadAction");
  return (
    <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
      <CircleNotch weight="bold" className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
      {t("counting")}
    </p>
  );
}

function UnfinishedNote({ problem, onRetry }: { problem: FinishedPreviewProblem | null; onRetry: () => void }) {
  const t = useTranslations("aiChatPage.previews.leadAction");
  const errorText = useSendErrorText();
  if (problem?.kind === "expired") return <p className="text-xs text-muted-foreground">{t("expired")}</p>;
  if (problem?.kind === "failed") {
    return (
      <p role="alert" className="notice notice-fault flex items-start gap-2 px-3 py-2.5 text-xs">
        <WarningCircle className="notice-ink mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {errorText(problem.refusal)} {t("failed")}
        </span>
      </p>
    );
  }
  return (
    <>
      {problem ? <PreviewStateBox refusal={errorText(problem.refusal)} onRetry={onRetry} /> : null}
      <PartialNote />
    </>
  );
}

function PartialNote() {
  const t = useTranslations("aiChatPage.previews.leadAction");
  return <p className="text-xs text-muted-foreground">{t("partial")}</p>;
}

function RecordsPreview({ proposal }: { proposal: LeadActionProposal }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      <LeadActionCountRows action={proposal.action} selected={proposal.selected} eligible={proposal.eligible} skipped={proposal.skipped} />
    </dl>
  );
}

function SendPreview({ proposal, action }: { proposal: LeadActionProposal; action: LeadSendAction }) {
  const counts = leadActionProposalCounts(proposal);
  const { quote } = proposal;
  const started = proposal.stage === "start";
  return (
    <>
      <SendCounts selected={counts.selected} eligible={started ? counts.eligible : undefined} skipped={started ? counts.skipped : []} />
      {started ? <CountedNotice counted={counts.counted} /> : null}
      {quote && showsQuoteFacts(proposal) ? <SendQuoteFacts channel={sendChannelOf(action)} quote={quote} /> : null}
      <SendPartsNote parts={started ? proposal.parts.length : (quote?.parts ?? 0)} />
      {quote ? <SendBudgetNotice budget={sendBudgetView({ eligible: quote.count, quote })} quote={quote} eligible={quote.count} /> : null}
    </>
  );
}

function DiscardedSends({ proposal }: { proposal: LeadActionProposal }) {
  const t = useTranslations("aiChatPage.previews.leadAction");
  return (
    <div className={BOX}>
      <p className="text-xs font-medium text-muted-foreground">{t("cancel")}</p>
      <ul className="grid gap-1 text-sm">
        {proposal.parts.map((part) => (
          <li key={part.campaignId} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-foreground">{part.name}</span>
            <span className="readout shrink-0 text-muted-foreground">{t("entries", { count: part.entries })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
