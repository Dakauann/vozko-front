"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { privateReplyError, type CommentActionResult, type PrivateReplyErrorKey } from "@/lib/social/comments";

const ERROR_KEYS: Record<PrivateReplyErrorKey, string> = {
  privateReplyUsed: "alreadyUsed",
  privateReplyExpired: "expired",
  privateReplyDeadlineUnknown: "deadlineUnknown",
};

export function PrivateReplyDialog({
  excerpt,
  translationNamespace,
  values,
  onSend,
  onClose,
}: {
  excerpt: string;
  translationNamespace: string;
  values?: Record<string, string>;
  onSend: (text: string) => Promise<CommentActionResult>;
  onClose: () => void;
}) {
  const t = useTranslations(translationNamespace);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    const result = await onSend(text.trim());
    setSending(false);
    if (result.error) {
      const known = privateReplyError(result.code);
      setError(known ? t(ERROR_KEYS[known.key], values) : result.error);
      return;
    }
    onClose();
  };

  return (
    <ElevatedDialog open onOpenChange={(o) => !o && onClose()}>
      <ElevatedDialogContent className="flex w-full max-w-md flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <ElevatedDialogTitle>{t("title", values)}</ElevatedDialogTitle>
        </ElevatedDialogHeader>
        <div className="space-y-3 p-5">
          <blockquote className="rounded-[--radius] border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            {excerpt}
          </blockquote>
          <ElevatedTextarea
            autoFocus
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("placeholder", values)}
          />
          <p className="text-2xs text-muted-foreground">{t("hint", values)}</p>
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
