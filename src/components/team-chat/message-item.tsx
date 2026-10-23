"use client";

import { useTranslations } from "next-intl";

import { CHAT_AUTHOR, CHAT_BUBBLE, CHAT_BUBBLE_OTHER, CHAT_BUBBLE_OWN, chatMetaClass, chatRowClass } from "@/components/chat/chat-styles";
import { bubbleCorners } from "@/components/crm/thread/bubble-corners";
import { CollapsibleMessageText, MessageTime } from "@/components/crm/thread/message-parts";
import { ArrowBendUpLeft, Check, Checks, PencilSimple, Trash, Warning } from "@/components/icons";
import type { GroupPosition } from "@/lib/chat/message-groups";
import type { PendingMessage } from "@/lib/team-chat/messages";
import type { TeamChatMessage } from "@/lib/team-chat/types";
import { cn } from "@/lib/utils";

const ACTION =
  "inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Quote({ quoted, mine }: { quoted: TeamChatMessage | null | undefined; mine: boolean }) {
  const t = useTranslations("teamChat.thread");
  return (
    <div className={cn("mb-1.5 rounded-[--radius] border-l-2 px-2 py-1 text-2xs", mine ? "border-background/50 bg-background/10 text-background/80" : "border-border-strong bg-muted text-muted-foreground")}>
      {quoted ? (
        <>
          <span className="block font-semibold">{quoted.author_name}</span>
          <span className="line-clamp-2">{quoted.deleted_at ? t("deleted") : quoted.body}</span>
        </>
      ) : (
        <span>{t("replyUnavailable")}</span>
      )}
    </div>
  );
}

function Footer({ message, mine, read }: { message: TeamChatMessage; mine: boolean; read: boolean | null }) {
  const t = useTranslations("teamChat.thread");
  return (
    <p className={chatMetaClass(mine)}>
      {message.edited_at ? <span>{t("edited")}</span> : null}
      <MessageTime iso={message.created_at} />
      {mine && read !== null ? (
        read ? (
          <Checks aria-label={t("read")} weight="bold" className="h-3.5 w-3.5 text-primary" />
        ) : (
          <Check aria-label={t("delivered")} weight="bold" className="h-3.5 w-3.5" />
        )
      ) : null}
    </p>
  );
}

export function MessageItem({
  message,
  position,
  mine,
  showAuthor,
  quoted,
  read,
  canReply,
  onReply,
  onEdit,
  onDelete,
}: {
  message: TeamChatMessage;
  position: GroupPosition;
  mine: boolean;
  showAuthor: boolean;
  quoted?: TeamChatMessage | null;
  read: boolean | null;
  canReply: boolean;
  onReply: (message: TeamChatMessage) => void;
  onEdit: (message: TeamChatMessage) => void;
  onDelete: (message: TeamChatMessage) => void;
}) {
  const t = useTranslations("teamChat.thread");
  const deleted = Boolean(message.deleted_at);
  const actions = !deleted ? (
    <span className="flex shrink-0 opacity-0 transition-opacity group-hover/msg:opacity-100 group-focus-within/msg:opacity-100">
      {canReply ? (
        <button type="button" className={ACTION} aria-label={t("reply")} title={t("reply")} onClick={() => onReply(message)}>
          <ArrowBendUpLeft weight="bold" className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {mine ? (
        <>
          <button type="button" className={ACTION} aria-label={t("edit")} title={t("edit")} onClick={() => onEdit(message)}>
            <PencilSimple weight="bold" className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={ACTION} aria-label={t("delete")} title={t("delete")} onClick={() => onDelete(message)}>
            <Trash weight="bold" className="h-3.5 w-3.5" />
          </button>
        </>
      ) : null}
    </span>
  ) : null;

  return (
    <div className={chatRowClass(mine, position)}>
      {mine ? actions : null}
      <div
        className={cn(
          CHAT_BUBBLE,
          deleted ? "bg-transparent text-muted-foreground shadow-none ring-1 ring-border" : mine ? CHAT_BUBBLE_OWN : CHAT_BUBBLE_OTHER,
          bubbleCorners(position, mine),
        )}
      >
        {showAuthor && !mine ? <p className={CHAT_AUTHOR}>{message.author_name}</p> : null}
        {message.reply_to_id && !deleted ? <Quote quoted={quoted} mine={mine} /> : null}
        {deleted ? <p className="text-sm italic">{t("deleted")}</p> : <CollapsibleMessageText text={message.body} />}
        {deleted ? null : <Footer message={message} mine={mine} read={read} />}
      </div>
      {mine ? null : actions}
    </div>
  );
}

export function PendingItem({ pending, onRetry, onDiscard }: { pending: PendingMessage; onRetry: () => void; onDiscard: () => void }) {
  const t = useTranslations("teamChat.thread");
  return (
    <div className="flex flex-col items-end pt-1">
      <div className={cn(CHAT_BUBBLE, CHAT_BUBBLE_OWN, !pending.failed && "opacity-70")}>
        <CollapsibleMessageText text={pending.body} />
        <p className="mt-0.5 text-right text-[10px] text-background/65">{pending.failed ? t("notSent") : t("sending")}</p>
      </div>
      {pending.failed ? (
        <p className="mt-1 flex items-center gap-2 text-2xs text-muted-foreground">
          <Warning aria-hidden className="h-3.5 w-3.5 text-destructive" weight="fill" />
          <button type="button" className="font-semibold text-foreground hover:underline" onClick={onRetry}>
            {t("retry")}
          </button>
          <button type="button" className="hover:underline" onClick={onDiscard}>
            {t("discard")}
          </button>
        </p>
      ) : null}
    </div>
  );
}
