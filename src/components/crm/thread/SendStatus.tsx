"use client";

import { useTranslations } from "next-intl";

import { Clock, WarningCircle } from "@/components/icons";
import { sendErrorKey } from "@/lib/conversations/send-errors";
import type { ConversationMessage } from "@/lib/conversations/types";

import { useThreadRow } from "./thread-context";

export function PendingSendMark() {
  const t = useTranslations("crmConversation.thread");
  return (
    <span role="img" aria-label={t("sendPending")} className="inline-flex">
      <Clock weight="bold" aria-hidden className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    </span>
  );
}

function RetryRow({ reason, busy, onRetry }: { reason: string; busy: boolean; onRetry: () => void }) {
  const t = useTranslations("crmConversation.thread");
  return (
    <div className="mt-1 flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-2xs">
      <span className="inline-flex items-center gap-1 text-foreground">
        <WarningCircle weight="fill" aria-hidden className="h-3.5 w-3.5 flex-shrink-0 text-destructive-ink" />
        {reason}
      </span>
      {busy ? (
        <span className="text-muted-foreground">{t("resending")}</span>
      ) : (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-sm font-semibold text-primary-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("retrySend")}
        </button>
      )}
    </div>
  );
}

export function SendFailure({ message }: { message: ConversationMessage }) {
  const tThread = useTranslations("crmConversation.thread");
  const tError = useTranslations("crmConversation.sendError");
  const { onRetrySend, onResendMessage, resendingIds, messageActions } = useThreadRow();
  const local = message.local_send;

  if (local) {
    if (local.state !== "failed" || !onRetrySend) return null;
    return <RetryRow reason={tError(sendErrorKey(local.failure))} busy={false} onRetry={() => onRetrySend(local.requestId)} />;
  }
  if (!onResendMessage || !messageActions.actionsFor(message).resend) return null;
  return (
    <RetryRow
      reason={tThread("sendFailed")}
      busy={resendingIds.has(message.id)}
      onRetry={() => onResendMessage(message.id)}
    />
  );
}
