"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { AttentionControls } from "@/components/attention/attention-controls";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { SectionError } from "@/components/dashboard/attendance/primitives";
import { BellSlash, ChatsCircle, Gear, Plus, X } from "@/components/icons";
import { MessageTime } from "@/components/crm/thread/message-parts";
import { useTeamChatAccess, useTeamChatMe, useTeamChatThreads } from "@/hooks/use-team-chat";
import { isBusySectionError, sectionErrorCode } from "@/lib/analytics/section-query";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { threadTitle } from "@/lib/team-chat/messages";
import { closeTeamChat, openTeamChat, startNewTeamChat } from "@/lib/team-chat/panel";
import type { TeamChatThread } from "@/lib/team-chat/types";
import { cn } from "@/lib/utils";

import { BADGE, ICON_BUTTON, ThreadAvatar, useThreadPreview } from "./team-chat-parts";

export function ThreadList() {
  const t = useTranslations("teamChat");
  const access = useTeamChatAccess();
  const [settings, setSettings] = useState(false);

  return (
    <>
      <header className="flex items-center gap-1 border-b border-border py-2.5 pl-4 pr-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{t("title")}</h2>
        {access.send ? (
          <button type="button" onClick={startNewTeamChat} aria-label={t("list.newChat")} title={t("list.newChat")} className={ICON_BUTTON}>
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setSettings((open) => !open)}
          aria-pressed={settings}
          aria-label={t("list.alerts")}
          title={t("list.alerts")}
          className={cn(ICON_BUTTON, settings && "bg-muted text-foreground")}
        >
          <Gear className="h-4 w-4" />
        </button>
        <button type="button" onClick={closeTeamChat} aria-label={t("close")} title={t("close")} className={ICON_BUTTON}>
          <X className="h-4 w-4" />
        </button>
      </header>
      {settings ? (
        <section aria-label={t("list.alerts")} className="border-b border-border px-4 py-3">
          <AttentionControls />
        </section>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Threads />
      </div>
    </>
  );
}

function Threads() {
  const t = useTranslations("teamChat");
  const me = useTeamChatMe();
  const access = useTeamChatAccess();
  const list = useTeamChatThreads(true);

  if (list.isPending) return <ScreenLoader fit="fill" className="min-h-48" />;
  if (list.isError && !list.data) {
    return (
      <div className="p-4">
        <SectionError
          busy={isBusySectionError(list.error)}
          retrying={list.isFetching}
          onRetry={() => void list.refetch()}
          message={codedErrorMessage(t, { code: sectionErrorCode(list.error) }, t("list.loadFailed"))}
        />
      </div>
    );
  }
  if (list.threads.length === 0) {
    return (
      <div className="flex flex-col items-center px-8 py-10 text-center">
        <span aria-hidden className="tile-neutral flex h-10 w-10 items-center justify-center">
          <ChatsCircle className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground">{t("list.emptyTitle")}</p>
        <p className="mt-1 max-w-[32ch] text-xs leading-relaxed text-muted-foreground">{t("list.emptyText")}</p>
        {access.send ? (
          <button type="button" onClick={startNewTeamChat} className="mt-4 text-xs font-semibold text-primary hover:underline">
            {t("list.newChat")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {list.threads.map((thread) => (
          <li key={thread.id}>
            <ThreadRow thread={thread} me={me} />
          </li>
        ))}
      </ul>
      {list.hasMore ? (
        <div className="px-4 py-3">
          <button
            type="button"
            disabled={list.loadingMore}
            onClick={() => void list.loadMore()}
            className="w-full rounded-[--radius] px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {list.loadingMore ? t("list.loadingMore") : t("list.loadMore")}
          </button>
        </div>
      ) : null}
    </>
  );
}

function ThreadRow({ thread, me }: { thread: TeamChatThread; me: string }) {
  const t = useTranslations("teamChat.list");
  const preview = useThreadPreview();
  const title = threadTitle(thread, me);
  const unread = thread.unread > 0;
  return (
    <button
      type="button"
      onClick={() => openTeamChat(thread.id)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent-hover focus-visible:bg-accent-hover focus-visible:outline-none"
    >
      <ThreadAvatar thread={thread} me={me} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-sm text-foreground", unread ? "font-semibold" : "font-medium")}>{title}</span>
          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
            <MessageTime iso={thread.last_message_at} />
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")}>{preview(thread, me)}</span>
          {thread.me.muted ? <BellSlash aria-label={t("muted")} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
          {thread.unread_mentions > 0 ? (
            <span aria-label={t("mentions", { count: thread.unread_mentions })} className={BADGE}>
              @
            </span>
          ) : null}
          {unread ? (
            <span aria-label={t("unread", { count: thread.unread })} className={BADGE}>
              {thread.unread > 99 ? "99+" : thread.unread}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
