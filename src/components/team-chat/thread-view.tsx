"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useStickToBottom } from "@/components/ai-chat/use-stick-to-bottom";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { ChatScrollDownButton } from "@/components/chat/chat-parts";
import { CHAT_CANVAS, CHAT_CANVAS_BODY, CHAT_EMPTY, CHAT_HEADER, CHAT_HEADER_SUBTITLE, CHAT_HEADER_TITLE, CHAT_LOAD_OLDER, CHAT_SYSTEM_LINE, CHAT_SYSTEM_ROW } from "@/components/chat/chat-styles";
import { DayLabel, TypingIndicator } from "@/components/crm/thread/message-parts";
import { ArrowLeft, Clock, Gear, X } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTeamChatAccess, useTeamChatMe, useTeamChatThread } from "@/hooks/use-team-chat";
import { useTeamChatMessages } from "@/hooks/use-team-chat-messages";
import { useTeamChatScheduled } from "@/hooks/use-team-chat-scheduled";
import { useTeamChatTyping } from "@/hooks/use-team-chat-typing";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { opensGroup } from "@/lib/chat/message-groups";
import { lastSeq, readByOthers, threadRows, threadTitle } from "@/lib/team-chat/messages";
import { closeTeamChat, showTeamChatList } from "@/lib/team-chat/panel";
import type { TeamChatMessage, TeamChatThread } from "@/lib/team-chat/types";
import { cn } from "@/lib/utils";

import { Composer, type ComposedMessage } from "./composer";
import { MessageItem, PendingItem } from "./message-item";
import { ScheduledPanel } from "./scheduled-panel";
import { ICON_BUTTON, ThreadAvatar, useSystemLine } from "./team-chat-parts";
import { ThreadSettings } from "./thread-settings";

const READ_SETTLE_MS = 600;

export function ThreadView({ threadId }: { threadId: string }) {
  const t = useTranslations("teamChat");
  const me = useTeamChatMe();
  const thread = useTeamChatThread(threadId);
  const [settings, setSettings] = useState(false);

  if (thread.isPending) return <ScreenLoader fit="fill" className="min-h-48" />;
  if (!thread.data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-sm text-muted-foreground">{t("thread.unavailable")}</p>
        <button type="button" onClick={showTeamChatList} className="text-xs font-semibold text-primary hover:underline">
          {t("back")}
        </button>
      </div>
    );
  }
  if (settings) return <ThreadSettings thread={thread.data} me={me} onBack={() => setSettings(false)} />;
  return <Conversation thread={thread.data} me={me} onSettings={() => setSettings(true)} />;
}

function Conversation({ thread, me, onSettings }: { thread: TeamChatThread; me: string; onSettings: () => void }) {
  const t = useTranslations("teamChat");
  const access = useTeamChatAccess();
  const chat = useTeamChatMessages(thread.id);
  const typing = useTeamChatTyping(thread.id, me, thread.members);
  const scheduled = useTeamChatScheduled(thread.id, access.send);
  const systemLine = useSystemLine();
  const [showScheduled, setShowScheduled] = useState(false);
  const [replyTo, setReplyTo] = useState<TeamChatMessage | null>(null);
  const [editing, setEditing] = useState<TeamChatMessage | null>(null);
  const [deleting, setDeleting] = useState<TeamChatMessage | null>(null);

  const rows = useMemo(() => threadRows(chat.messages), [chat.messages]);
  const byId = useMemo(() => new Map(chat.messages.map((m) => [m.id, m])), [chat.messages]);
  const { scrollRef, onScroll, showScrollDown, scrollToBottom } = useStickToBottom(
    `${chat.messages.length}:${chat.pending.length}:${typing.names.length}`,
    thread.id,
  );

  const anchor = useRef<number | null>(null);
  const loadOlder = () => {
    const el = scrollRef.current;
    if (el) anchor.current = el.scrollHeight - el.scrollTop;
    void chat.loadOlder();
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || anchor.current === null || chat.loadingOlder) return;
    el.scrollTop = el.scrollHeight - anchor.current;
    anchor.current = null;
  }, [chat.messages, chat.loadingOlder, scrollRef]);

  const highest = lastSeq(chat.messages);
  const { markRead } = chat;
  useEffect(() => {
    if (highest <= thread.me.last_read_seq) return;
    const mark = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) markRead(highest);
    };
    const timer = setTimeout(mark, READ_SETTLE_MS);
    window.addEventListener("focus", mark);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", mark);
    };
  }, [highest, markRead, thread.me.last_read_seq]);

  const failure = (error: { code?: string } | null, fallback: string) => {
    if (error) toast.error(codedErrorMessage(t, error, fallback));
  };

  const send = (message: ComposedMessage) => {
    setReplyTo(null);
    scrollToBottom();
    void chat.send(message).then((error) => failure(error, t("thread.sendFailed")));
  };

  const schedule = async (message: ComposedMessage, sendAt: Date) => {
    const error = await scheduled.schedule({ ...message, send_at: sendAt.toISOString() });
    failure(error, t("scheduled.failed"));
    if (!error) {
      setReplyTo(null);
      setShowScheduled(true);
      toast.success(t("scheduled.done"));
    }
    return !error;
  };

  const direct = thread.kind === "direct";
  const subtitle = direct ? null : t("thread.members", { count: thread.members.length });

  return (
    <>
      <header className={CHAT_HEADER}>
        <button type="button" onClick={showTeamChatList} aria-label={t("back")} title={t("back")} className={ICON_BUTTON}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <ThreadAvatar thread={thread} me={me} className="h-7 w-7" />
        <div className="min-w-0 flex-1 pl-1">
          <h2 className={CHAT_HEADER_TITLE}>{threadTitle(thread, me)}</h2>
          {subtitle ? <p className={CHAT_HEADER_SUBTITLE}>{subtitle}</p> : null}
        </div>
        {access.send ? (
          <button
            type="button"
            onClick={() => setShowScheduled((on) => !on)}
            aria-pressed={showScheduled}
            aria-label={t("scheduled.title")}
            title={t("scheduled.title")}
            className={cn(ICON_BUTTON, "relative", showScheduled && "bg-muted text-foreground")}
          >
            <Clock className="h-4 w-4" />
            {scheduled.scheduled.length > 0 ? (
              <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold text-primary-foreground">
                {scheduled.scheduled.length}
              </span>
            ) : null}
          </button>
        ) : null}
        <button type="button" onClick={onSettings} aria-label={t("settings.title")} title={t("settings.title")} className={ICON_BUTTON}>
          <Gear className="h-4 w-4" />
        </button>
        <button type="button" onClick={closeTeamChat} aria-label={t("close")} title={t("close")} className={ICON_BUTTON}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className={CHAT_CANVAS}>
          <div className={CHAT_CANVAS_BODY}>
            {chat.hasOlder ? (
              <div className="flex justify-center pb-2">
                <button type="button" onClick={loadOlder} disabled={chat.loadingOlder} className={CHAT_LOAD_OLDER}>
                  {chat.loadingOlder ? t("thread.loadingOlder") : t("thread.loadOlder")}
                </button>
              </div>
            ) : null}
            {!chat.loaded && !chat.failed ? <ScreenLoader fit="fill" className="min-h-40" /> : null}
            {chat.failed && !chat.loaded ? <p className="py-6 text-center text-xs text-muted-foreground">{t("thread.loadFailed")}</p> : null}
            {chat.loaded && chat.messages.length === 0 && chat.pending.length === 0 ? (
              <p className={CHAT_EMPTY}>{t("thread.empty")}</p>
            ) : null}
            {rows.map((row) => {
              if (row.kind === "day") {
                return (
                  <div key={row.key} className="pointer-events-none sticky top-0 z-10 flex justify-center py-2">
                    <span className="pointer-events-auto rounded-lg bg-card px-3 py-1 text-2xs font-medium text-muted-foreground shadow-sm">
                      <DayLabel iso={row.iso} />
                    </span>
                  </div>
                );
              }
              if (row.kind === "system") {
                return (
                  <div key={row.key} className={CHAT_SYSTEM_ROW}>
                    <span className={CHAT_SYSTEM_LINE}>
                      {systemLine(row.message, thread, me)}
                    </span>
                  </div>
                );
              }
              const mine = row.message.author_id === me;
              return (
                <MessageItem
                  key={row.key}
                  message={row.message}
                  position={row.position}
                  mine={mine}
                  showAuthor={opensGroup(row.position) && !direct}
                  quoted={row.message.reply_to_id ? (byId.get(row.message.reply_to_id) ?? null) : undefined}
                  read={direct && mine ? readByOthers(thread, row.message, me) : null}
                  canReply={access.send}
                  onReply={setReplyTo}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              );
            })}
            {chat.pending.map((pending) => (
              <PendingItem
                key={pending.client_id}
                pending={pending}
                onRetry={() => void chat.retry(pending.client_id).then((error) => failure(error, t("thread.sendFailed")))}
                onDiscard={() => chat.discard(pending.client_id)}
              />
            ))}
            {typing.names.length > 0 ? <TypingIndicator names={typing.names} /> : null}
          </div>
        </div>
        {showScrollDown ? <ChatScrollDownButton label={t("thread.latest")} onClick={scrollToBottom} /> : null}
      </div>

      {showScheduled && access.send ? <ScheduledPanel scheduled={scheduled.scheduled} onCancel={scheduled.cancel} /> : null}

      {access.send ? (
        <Composer
          me={me}
          members={thread.members}
          replyTo={replyTo}
          editing={editing}
          canSchedule
          onCancelReply={() => setReplyTo(null)}
          onCancelEdit={() => setEditing(null)}
          onSend={send}
          onEdit={(message, body) => {
            setEditing(null);
            void chat.edit(message.id, body).then((error) => failure(error, t("thread.editFailed")));
          }}
          onSchedule={schedule}
          onTyping={typing.notifyTyping}
        />
      ) : (
        <p className="border-t border-border px-4 py-3 text-center text-2xs text-muted-foreground">{t("thread.readOnly")}</p>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("thread.deleteTitle")}
        description={t("thread.deleteDescription")}
        confirmLabel={t("thread.delete")}
        onConfirm={async () => {
          if (!deleting) return;
          const error = await chat.remove(deleting.id);
          failure(error, t("thread.deleteFailed"));
          setDeleting(null);
        }}
      />
    </>
  );
}
