"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  answerMercadoLivreQuestionAction,
  deleteMercadoLivreQuestionAction,
  setMercadoLivreQuestionAuthorBlockedAction,
} from "@/app/actions/mercadolivre";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ArrowSquareOut, ChatCircleDots, Prohibit, Trash } from "@/components/icons";
import { CommentAuthorLine, CommentIconAction, CommentText } from "@/components/social/comment-row-parts";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { answeredByKey, questionStatusKey, questionStatusTone } from "@/lib/mercadolivre/questions";
import type { MercadoLivreQuestion } from "@/lib/mercadolivre/types";
import { fromMercadoLivreQuestion } from "@/lib/social/comments";

import { MercadoLivreAnswerBox } from "./mercadolivre-answer-box";
import { MercadoLivreListingThumb } from "./mercadolivre-listing-thumb";
import { useMercadoLivreError } from "./use-mercadolivre-error";
import { useCheckedDate } from "@/components/channels/use-purge-date";

type Confirming = "delete" | "block" | "unblock" | null;

export interface QuestionRowPermissions {
  canAnswer: boolean;
  canModerate: boolean;
}

export function MercadoLivreQuestionRow({
  question,
  permissions,
  showListing,
  askerBlocked,
  onChanged,
  onRemoved,
  onClosedElsewhere,
  onAskerBlocked,
}: {
  question: MercadoLivreQuestion;
  permissions: QuestionRowPermissions;
  showListing: boolean;
  askerBlocked: boolean;
  onChanged: (question: MercadoLivreQuestion) => void;
  onRemoved: (question: MercadoLivreQuestion) => void;
  onClosedElsewhere: () => void;
  onAskerBlocked: (mlUserId: string, blocked: boolean) => void;
}) {
  const t = useTranslations("mercadolivre.questions");
  const describeError = useMercadoLivreError();
  const formatDate = useCheckedDate();
  const comment = fromMercadoLivreQuestion(question, permissions);
  const [answering, setAnswering] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askerName = comment.author ?? t("unknownUser");
  const answeredBy = answeredByKey(question.answeredBy);
  const listingTitle = question.listing?.title || t("listingFallback", { id: question.itemId });

  const sendAnswer = async (text: string) => {
    setError(null);
    const result = await answerMercadoLivreQuestionAction(question.accountId, question.questionId, text);
    if ("error" in result) {
      if (result.code === "question_not_open") {
        setAnswering(false);
        onClosedElsewhere();
        return;
      }
      setError(describeError(result));
      return;
    }
    setAnswering(false);
    onChanged({ ...question, ...result.question, asker: question.asker, listing: question.listing });
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteMercadoLivreQuestionAction(question.accountId, question.questionId);
    setBusy(false);
    if ("error" in result) {
      setError(describeError(result));
      return;
    }
    onRemoved(question);
  };

  const setBlocked = async (blocked: boolean) => {
    setBusy(true);
    setError(null);
    const result = await setMercadoLivreQuestionAuthorBlockedAction(question.accountId, question.questionId, blocked);
    setBusy(false);
    if ("error" in result) {
      setError(describeError(result));
      return;
    }
    if (question.asker) onAskerBlocked(question.asker.mlUserId, blocked);
  };

  return (
    <div className="border-b border-border px-4 py-3">
      {showListing ? (
        <div className="mb-2 flex items-center gap-2">
          <MercadoLivreListingThumb url={question.listing?.thumbnailUrl} className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{listingTitle}</p>
            <p className="text-2xs text-muted-foreground">{question.itemId}</p>
          </div>
          {question.listing?.permalink ? (
            <a
              href={question.listing.permalink}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t("openListing")}
              title={t("openListing")}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowSquareOut size={14} />
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <CommentAuthorLine author={comment.author} fallback={t("unknownUser")}>
            {question.suspectedSpam ? <StatusChip tone="warning" label={t("suspectedSpam")} className="ml-1.5 px-1.5 py-0 text-2xs" /> : null}
            {askerBlocked ? <StatusChip tone="muted" label={t("block.blockedMark")} className="ml-1.5 px-1.5 py-0 text-2xs" /> : null}
          </CommentAuthorLine>
          <CommentText text={comment.text} />
          <div className="mt-1 flex flex-wrap items-center gap-3 text-2xs text-muted-foreground">
            <span>{formatDate(question.askedAt)}</span>
            <StatusChip tone={questionStatusTone(question.status)} label={t(questionStatusKey(question.status))} className="px-1.5 py-0 text-2xs" />
            {comment.canReply && !answering ? (
              <button
                type="button"
                onClick={() => setAnswering(true)}
                className="flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary-ink"
              >
                <ChatCircleDots size={12} />
                {t("answer.open")}
              </button>
            ) : null}
          </div>
        </div>

        {permissions.canModerate ? (
          <div className="flex shrink-0 items-center gap-1">
            {question.asker ? (
              <CommentIconAction
                label={askerBlocked ? t("block.unblockAction") : t("block.blockAction")}
                onClick={() => setConfirming(askerBlocked ? "unblock" : "block")}
                disabled={busy}
                pressed={askerBlocked}
              >
                <Prohibit size={14} weight={askerBlocked ? "fill" : "regular"} />
              </CommentIconAction>
            ) : null}
            <CommentIconAction label={t("delete.action")} onClick={() => setConfirming("delete")} disabled={busy} danger>
              <Trash size={14} />
            </CommentIconAction>
          </div>
        ) : null}
      </div>

      {answering ? <MercadoLivreAnswerBox onSend={sendAnswer} onCancel={() => setAnswering(false)} /> : null}

      {question.answerText || question.answerStatus === "BANNED" ? (
        <div className="ml-4 mt-2 border-l-2 border-border pl-3">
          {question.answerStatus === "BANNED" ? (
            <p className="text-xs text-muted-foreground">{t("answerBanned")}</p>
          ) : (
            <CommentText text={question.answerText ?? ""} />
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
            <span>{t("answeredByPrefix")}</span>
            {answeredBy ? <span className="font-medium text-foreground">{t(answeredBy)}</span> : <span>{t("answeredByUnknown")}</span>}
            {question.answeredAt ? <span>{formatDate(question.answeredAt)}</span> : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-1.5 text-2xs text-destructive-ink">{error}</p> : null}

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={t("delete.title")}
        description={t("delete.body", { name: askerName })}
        confirmLabel={t("delete.confirm")}
        onConfirm={remove}
      />
      <ConfirmDialog
        open={confirming === "block"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={t("block.blockTitle")}
        description={t("block.blockBody", { name: askerName })}
        confirmLabel={t("block.blockConfirm")}
        onConfirm={() => setBlocked(true)}
      />
      <ConfirmDialog
        open={confirming === "unblock"}
        onOpenChange={(open) => !open && setConfirming(null)}
        tone="default"
        title={t("block.unblockTitle")}
        description={t("block.unblockBody", { name: askerName })}
        confirmLabel={t("block.unblockConfirm")}
        onConfirm={() => setBlocked(false)}
      />
    </div>
  );
}
