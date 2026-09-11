"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { postCommentReplyAction, suggestCommentReplyAction } from "@/app/actions/comment-analysis";
import type { AnalyzedComment } from "@/lib/comment-analysis/types";
import Button from "@/components/elevated-design/button";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { Chip } from "@/components/audience/shared";
import { PaperPlaneTilt, Sparkle, Warning } from "@/components/icons";

/*
 * "Responder com IA" (§6).
 *
 * The draft is a draft. It arrives in an editable field, nothing sends itself,
 * and the send button says what it does. Publishing posts the text ON SCREEN,
 * not a fresh generation, so what the operator read is what the public sees.
 *
 * The reply is public and in the customer's voice, so the dialog says whose
 * words are about to be published and marks a draft the model wrote.
 */

export function ReplyCommentDialog({
  comment,
  onClose,
  onPosted,
}: {
  comment: AnalyzedComment;
  onClose: () => void;
  onPosted?: (text: string) => void;
}) {
  const t = useTranslations("commentAnalysis.reply");
  const [text, setText] = useState("");
  const [fromModel, setFromModel] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = async () => {
    setDrafting(true);
    const result = await suggestCommentReplyAction(comment.id);
    setDrafting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setText(result.suggestion?.text ?? "");
    setFromModel(true);
  };

  const publish = async () => {
    setSending(true);
    const result = await postCommentReplyAction(comment.id, text.trim());
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onPosted?.(result.reply?.text ?? text.trim());
    onClose();
  };

  return (
    <ElevatedDialog open onOpenChange={(o) => !o && onClose()}>
      <ElevatedDialogContent className="flex w-full max-w-lg flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t("description")}</p>
        </ElevatedDialogHeader>

        <div className="space-y-3 p-5">
          <blockquote className="rounded-[--radius] border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span className="mb-1 block font-medium text-foreground">
              {comment.authorHandle ? `@${comment.authorHandle}` : comment.authorExternalId}
            </span>
            {comment.excerpt}
          </blockquote>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Sparkle className="h-3.5 w-3.5" />}
              title={drafting ? t("drafting") : text ? t("redraft") : t("draft")}
              disabled={drafting}
              onClick={() => void draft()}
            />
            {fromModel ? <Chip>{t("fromModel")}</Chip> : null}
          </div>

          <ElevatedTextarea
            rows={4}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // Once a person edits it, it is their text, not the model's.
              setFromModel(false);
            }}
            placeholder={t("placeholder")}
          />
          <p className="text-2xs text-muted-foreground">{t("publicHint")}</p>

          {error ? (
            <p className="flex items-center gap-2 text-xs text-destructive-ink">
              <Warning className="h-3.5 w-3.5" /> {error}
            </p>
          ) : null}
        </div>

        <ElevatedDialogFooter className="shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button title={t("cancel")} variant="ghost" onClick={onClose} />
          <Button
            icon={<PaperPlaneTilt className="h-3.5 w-3.5" />}
            title={sending ? t("publishing") : t("publish")}
            variant="primary"
            disabled={sending || text.trim() === ""}
            onClick={() => void publish()}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
