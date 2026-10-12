"use client";

import { useTranslations } from "next-intl";

import { PaperPlaneTilt, X } from "@/components/icons";
import type { QueuedMessage } from "@/lib/aichat/queue";

import { AttachmentChip } from "./attachment-chip";

export function QueuedMessages({
  items,
  streaming,
  awaitingApproval,
  onRemove,
  onSendNow,
}: {
  items: QueuedMessage[];
  streaming: boolean;
  awaitingApproval: boolean;
  onRemove: (clientId: string) => void;
  onSendNow: () => void;
}) {
  const t = useTranslations("aiChatPage.queue");
  if (items.length === 0) return null;
  const hint = streaming ? t("hintRunning") : awaitingApproval ? t("hintApproval") : t("hintStopped");

  return (
    <section aria-label={t("title")} className="flex flex-col items-end gap-2">
      <ol className="flex w-full flex-col items-end gap-2">
        {items.map((item) => (
          <li key={item.clientId} className="flex max-w-[85%] items-start gap-2 rounded-lg border border-dashed border-control-edge bg-card px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-2xs font-medium text-muted-foreground">{t("badge")}</p>
              {item.content ? <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{item.content}</p> : null}
              {item.attachments && item.attachments.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {item.attachments.map((file) => (
                    <AttachmentChip key={file.mediaId} name={file.name} attachment={file} className="max-w-full bg-muted" />
                  ))}
                </ul>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.clientId)}
              className="-mr-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("remove")}
              title={t("remove")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ol>
      <div className="flex max-w-[85%] items-center gap-2">
        <p className="text-2xs text-muted-foreground">{hint}</p>
        {streaming ? null : (
          <button
            type="button"
            onClick={onSendNow}
            className="flex h-7 flex-shrink-0 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-2.5 text-xs font-medium text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PaperPlaneTilt weight="fill" className="h-3 w-3" />
            {t("sendNow")}
          </button>
        )}
      </div>
    </section>
  );
}
