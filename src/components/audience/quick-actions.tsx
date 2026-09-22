"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { retryAnalyzedCommentAction } from "@/app/actions/audience";
import { hideInstagramCommentAction, privateReplyInstagramCommentAction } from "@/app/actions/instagram";
import type { AnalyzedComment } from "@/lib/audience/types";
import { useWorkspace } from "@/contexts/workspace-context";
import Button from "@/components/elevated-design/button";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { EscalateCommentDialog } from "@/components/audience/escalate-dialog";
import { ReplyCommentDialog } from "@/components/audience/reply-dialog";
import { ArrowClockwise, EyeSlash, PaperPlaneTilt, Sparkle, UsersThree, WhatsappLogo } from "@/components/icons";
import { cn } from "@/lib/utils";


export function CommentQuickActions({
  accountId,
  comment,
  hidden = false,
  onHidden,
  onOpenAuthor,
  onRetried,
  onError,
  className,
}: {
  accountId: string;
  comment: AnalyzedComment;
  hidden?: boolean;
  onHidden?: (comment: AnalyzedComment) => void;
  onOpenAuthor?: (authorExternalId: string) => void;
  onRetried?: (comment: AnalyzedComment) => void;
  onError?: (message: string) => void;
  className?: string;
}) {
  const t = useTranslations("audience.quickActions");
  const { can } = useWorkspace();
  const canSend = can("audience", "send");
  const [busy, setBusy] = useState<"hide" | "retry" | null>(null);
  const [replying, setReplying] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const hide = async () => {
    setBusy("hide");
    const result = await hideInstagramCommentAction(accountId, comment.subjectId, true);
    setBusy(null);
    if (result.error) {
      onError?.(result.error);
      return;
    }
    onHidden?.(comment);
  };

  const retry = async () => {
    setBusy("retry");
    const result = await retryAnalyzedCommentAction(comment.id);
    setBusy(null);
    if (result.error) {
      onError?.(result.error);
      return;
    }
    if (result.comment) onRetried?.(result.comment);
  };

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {
}
        {canSend ? (
          <Button
            size="sm"
            variant={comment.requiresAction ? "secondary" : "ghost"}
            icon={<Sparkle className="h-3.5 w-3.5" />}
            title={t("answer")}
            onClick={() => setAnswering(true)}
          />
        ) : null}
        {canSend ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<WhatsappLogo className="h-3.5 w-3.5" />}
            title={t("escalate")}
            onClick={() => setEscalating(true)}
          />
        ) : null}
        {onOpenAuthor ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<UsersThree className="h-3.5 w-3.5" />}
            title={t("openAuthor")}
            onClick={() => onOpenAuthor(comment.authorExternalId)}
          />
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          icon={<EyeSlash className="h-3.5 w-3.5" />}
          title={hidden ? t("hidden") : t("hide")}
          disabled={hidden || busy === "hide"}
          onClick={() => void hide()}
        />
        <Button
          size="sm"
          variant="ghost"
          icon={<PaperPlaneTilt className="h-3.5 w-3.5" />}
          title={t("privateReply")}
          onClick={() => setReplying(true)}
        />
        {}
        {comment.status === "failed" ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowClockwise className="h-3.5 w-3.5" />}
            title={busy === "retry" ? t("retrying") : t("retry")}
            disabled={busy === "retry"}
            onClick={() => void retry()}
          />
        ) : null}
      </div>
      {replying ? (
        <PrivateReplyDialog accountId={accountId} comment={comment} onClose={() => setReplying(false)} />
      ) : null}
      {answering ? <ReplyCommentDialog comment={comment} onClose={() => setAnswering(false)} /> : null}
      {escalating ? <EscalateCommentDialog comment={comment} onClose={() => setEscalating(false)} /> : null}
    </>
  );
}

function PrivateReplyDialog({
  accountId,
  comment,
  onClose,
}: {
  accountId: string;
  comment: AnalyzedComment;
  onClose: () => void;
}) {
  const t = useTranslations("audience.quickActions.privateReplyDialog");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    const result = await privateReplyInstagramCommentAction(accountId, comment.subjectId, text.trim());
    setSending(false);
    if (result.error) {
      setError(result.code === "private_reply_used" ? t("alreadyUsed") : result.error);
      return;
    }
    onClose();
  };

  return (
    <ElevatedDialog open onOpenChange={(o) => !o && onClose()}>
      <ElevatedDialogContent className="flex w-full max-w-md flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        </ElevatedDialogHeader>
        <div className="space-y-3 p-5">
          <blockquote className="rounded-[--radius] border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            {comment.excerpt}
          </blockquote>
          <ElevatedTextarea
            autoFocus
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("placeholder")}
          />
          <p className="text-2xs text-muted-foreground">{t("hint")}</p>
          {error ? <p className="text-xs text-destructive-ink">{error}</p> : null}
        </div>
        <ElevatedDialogFooter className="shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button title={t("cancel")} variant="ghost" onClick={onClose} />
          <Button
            title={sending ? t("sending") : t("send")}
            variant="primary"
            disabled={sending || text.trim() === ""}
            onClick={() => void send()}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
