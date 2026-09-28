"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { retryAnalyzedCommentAction } from "@/app/actions/audience";
import type { AnalyzedComment } from "@/lib/audience/types";
import { isCommentSource } from "@/lib/audience/types";
import { commentActionsFor } from "@/lib/social/comment-sources";
import { useWorkspace } from "@/contexts/workspace-context";
import Button from "@/components/elevated-design/button";
import { EscalateCommentDialog } from "@/components/audience/escalate-dialog";
import { ReplyCommentDialog } from "@/components/audience/reply-dialog";
import { PrivateReplyDialog } from "@/components/social/private-reply-dialog";
import { ArrowClockwise, EyeSlash, PaperPlaneTilt, Sparkle, UsersThree, WhatsappLogo } from "@/components/icons";
import { cn } from "@/lib/utils";


export function CommentQuickActions({
  comment,
  hidden = false,
  onHidden,
  onOpenAuthor,
  onRetried,
  onError,
  className,
}: {
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
  const moderation = isCommentSource(comment.source) ? commentActionsFor(comment.source, comment.accountId) : null;
  const channel = { channel: comment.source };

  const hide = async () => {
    if (!moderation) return;
    setBusy("hide");
    const result = await moderation.setHidden(comment.subjectId, true);
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
        {moderation ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<EyeSlash className="h-3.5 w-3.5" />}
            title={hidden ? t("hidden") : t("hide")}
            disabled={hidden || busy === "hide"}
            onClick={() => void hide()}
          />
        ) : null}
        {moderation ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<PaperPlaneTilt className="h-3.5 w-3.5" />}
            title={t("privateReply", channel)}
            onClick={() => setReplying(true)}
          />
        ) : null}
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
      {replying && moderation ? (
        <PrivateReplyDialog
          excerpt={comment.excerpt}
          translationNamespace="audience.quickActions.privateReplyDialog"
          values={channel}
          onSend={(text) => moderation.privateReply(comment.subjectId, text)}
          onClose={() => setReplying(false)}
        />
      ) : null}
      {answering ? <ReplyCommentDialog comment={comment} onClose={() => setAnswering(false)} /> : null}
      {escalating ? <EscalateCommentDialog comment={comment} onClose={() => setEscalating(false)} /> : null}
    </>
  );
}
