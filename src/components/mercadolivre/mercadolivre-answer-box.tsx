"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { TextLimitFeedback } from "@/components/crm/TextLimitFeedback";
import Button from "@/components/elevated-design/button";
import Textarea from "@/components/elevated-design/elevated-textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { textLimitState } from "@/lib/conversations/text-limit";
import { MERCADOLIVRE_ANSWER_LIMIT } from "@/lib/mercadolivre/questions";

export function MercadoLivreAnswerBox({
  onSend,
  onCancel,
}: {
  onSend: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("mercadolivre.questions.answer");
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);

  const answer = text.trim();
  const limit = textLimitState(answer, MERCADOLIVRE_ANSWER_LIMIT);
  const blocked = answer === "" || (limit?.refused ?? true);

  return (
    <div className="mt-2 space-y-2">
      <Notice tone="warning">
        <p>{t("publicFinal")}</p>
      </Notice>
      <div>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          aria-label={t("label")}
          placeholder={t("placeholder")}
          className="resize-y"
        />
        <TextLimitFeedback state={textLimitState(text, MERCADOLIVRE_ANSWER_LIMIT)} />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" title={t("cancel")} onClick={onCancel} />
        <Button size="sm" variant="primary" title={t("send")} disabled={blocked} onClick={() => setConfirming(true)} />
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="default"
        title={t("confirmTitle")}
        description={t("confirmBody")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => onSend(answer)}
      >
        <blockquote className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-[--radius] border border-border bg-muted p-3 text-sm text-foreground">
          {answer}
        </blockquote>
      </ConfirmDialog>
    </div>
  );
}
