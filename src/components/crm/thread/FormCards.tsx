"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { StatusChip } from "@/components/elevated-design/status-chip";
import { ClipboardText } from "@/components/icons";
import { ResponseSheet } from "@/components/whatsapp-forms/detail/ResponseSheet";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  formMessageState,
  isMatchedResponse,
  type FormAnswerLine,
  type FormMessageBlock,
  type FormResponseBlock,
} from "@/lib/conversations/form-metadata";
import type { ConversationMessage, EntryType } from "@/lib/conversations/types";

import { FormFileList } from "./FormFileList";
import { BUBBLE_ACTION_CLASS } from "./InteractiveMessageCard";
import { useThreadRow } from "./thread-context";

const PREVIEW_ANSWERS = 3;

export function FormMessageCard({ message, block }: { message: ConversationMessage; block: FormMessageBlock }) {
  const t = useTranslations("crmConversation.thread.form");
  const { messagesById } = useThreadRow();
  const state = formMessageState(message, block, messagesById.values());

  return (
    <div data-form-card="message" className="mb-1 flex w-[min(280px,100%)] flex-col gap-2">
      {message.text ? <p className="whitespace-pre-wrap text-sm leading-snug">{message.text}</p> : null}
      <button
        type="button"
        disabled
        title={t("ctaHint")}
        className={BUBBLE_ACTION_CLASS}
      >
        <ClipboardText className="h-3.5 w-3.5" aria-hidden />
        {block.cta || t("fallbackCta")}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-2xs text-muted-foreground">
          <ClipboardText className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{block.formName || t("fallbackName")}</span>
        </span>
        {state ? (
          <StatusChip
            tone={state === "responded" ? "healthy" : "muted"}
            label={t(state === "responded" ? "responded" : "waiting")}
            className="px-1.5 py-0 text-2xs"
          />
        ) : null}
      </div>
    </div>
  );
}

function AnswerLine({ answer, entryType, entryId }: { answer: FormAnswerLine; entryType: EntryType; entryId: string }) {
  return (
    <li className="text-xs leading-snug">
      <span className="font-medium text-foreground">{answer.prompt}:</span>{" "}
      <span className="text-foreground/80">{answer.value}</span>
      <FormFileList files={answer.files} entryType={entryType} entryId={entryId} />
    </li>
  );
}

export function FormResponseCard({ message, block }: { message: ConversationMessage; block: FormResponseBlock }) {
  const t = useTranslations("crmConversation.thread.form");
  const { can } = useWorkspace();
  const [open, setOpen] = useState(false);
  const matched = isMatchedResponse(block);
  const shown = matched ? block.answers.slice(0, PREVIEW_ANSWERS) : block.answers;
  const hidden = block.answers.length - shown.length;
  const canOpen = Boolean(block.responseId) && can("whatsapp_form_responses", "read");

  return (
    <div data-form-card="response" className="mb-1 flex w-[min(300px,100%)] flex-col gap-2">
      <div className="flex items-center gap-2">
        <span aria-hidden className="tile-neutral flex h-7 w-7 shrink-0 items-center justify-center">
          <ClipboardText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{block.formName || t("fallbackName")}</p>
          <p className="truncate text-2xs text-muted-foreground">{t("responseTitle")}</p>
        </div>
      </div>
      {!matched ? <p className="text-2xs text-muted-foreground">{t("unmatched")}</p> : null}
      {shown.length > 0 ? (
        <ul className="space-y-1">
          {shown.map((answer) => (
            <AnswerLine key={answer.key} answer={answer} entryType={message.entry_type} entryId={message.entry_id} />
          ))}
        </ul>
      ) : (
        <p className="text-2xs text-muted-foreground">{t("noAnswers")}</p>
      )}
      {hidden > 0 ? <p className="text-2xs text-muted-foreground">{t("moreAnswers", { count: hidden })}</p> : null}
      {block.changed.length > 0 ? (
        <p className="text-2xs font-medium text-foreground">{t("savedToLead", { count: block.changed.length })}</p>
      ) : null}
      {canOpen ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="self-start text-xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("viewFull")}
          </button>
          {open ? <ResponseSheet responseId={block.responseId} onClose={() => setOpen(false)} /> : null}
        </>
      ) : null}
    </div>
  );
}
