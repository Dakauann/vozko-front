"use client";

import { useId, useState, type Ref } from "react";
import { useLocale, useTranslations } from "next-intl";

import { MagnifyingGlass, TrashSimple } from "@/components/icons";
import { matchesTitle, threadActivity, threadPlace, type ThreadPlace } from "@/lib/aichat/thread-list";
import type { ChatThread } from "@/lib/aichat/types";
import { cn } from "@/lib/utils";

import { useLiveThreads } from "./background-turns";
import type { ChatThreads } from "./use-chat-threads";

interface ChatThreadListProps {
  threads: ChatThreads;
  activeId: string | null;
  projectId?: string;
  disabled?: boolean;
  onPick: (threadId: string) => void;
  onActiveRemoved: () => void;
  searchRef?: Ref<HTMLInputElement>;
  className?: string;
}

interface ThreadRowProps {
  thread: ChatThread;
  active: boolean;
  running: boolean;
  place: ThreadPlace;
  now: Date;
  disabled: boolean;
  deleteDisabled: boolean;
  onPick: () => void;
  onRemove: () => void;
}

function ThreadRow({ thread, active, running, place, now, disabled, deleteDisabled, onPick, onRemove }: ThreadRowProps) {
  const t = useTranslations("aiChatPage");
  const locale = useLocale();
  const metaId = useId();
  const activity = threadActivity(thread, now, locale);
  const placeLabel = place === "general" ? null : t(`sessions.places.${place}`);
  const hasMeta = running || activity !== null || placeLabel !== null;

  return (
    <li
      className={cn(
        "group relative mb-1 flex items-center rounded-lg",
        active ? "bg-muted text-foreground ring-1 ring-inset ring-control-edge" : "text-muted-foreground hover:bg-muted",
      )}
    >
      <div className="min-w-0 flex-1 px-3 py-2">
        <button
          type="button"
          disabled={disabled}
          aria-current={active ? "true" : undefined}
          aria-describedby={hasMeta ? metaId : undefined}
          onClick={onPick}
          className={cn(
            "block w-full truncate text-left text-sm after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring disabled:opacity-40",
            active ? "font-semibold" : "font-medium text-foreground",
          )}
        >
          {thread.title || t("untitled")}
        </button>
        {hasMeta ? (
          <p id={metaId} className="mt-0.5 flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
            {running ? (
              <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary-ink">
                <span aria-hidden className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-primary animate-dot-pulse" />
                {t("sessions.running")}
              </span>
            ) : null}
            {activity ? <span className="shrink-0 tabular-nums">{activity.day === "yesterday" ? t("sessions.yesterday") : activity.text}</span> : null}
            {placeLabel ? <span className="truncate rounded-full border border-border px-1.5">{placeLabel}</span> : null}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={deleteDisabled}
        onClick={onRemove}
        aria-label={t("deleteConversation")}
        className="relative z-10 mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <TrashSimple className="h-4 w-4" />
      </button>
    </li>
  );
}

export function ChatThreadList({ threads, activeId, projectId, disabled = false, onPick, onActiveRemoved, searchRef, className }: ChatThreadListProps) {
  const t = useTranslations("aiChatPage");
  const live = useLiveThreads();
  const [now] = useState(() => new Date());
  const visible = threads.items.filter((thread) => matchesTitle(thread, threads.query, t("untitled")));

  const remove = async (threadId: string) => {
    if ((await threads.remove(threadId)) && threadId === activeId) onActiveRemoved();
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="px-3 pb-2 pt-3">
        <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 focus-within:ring-2 focus-within:ring-ring">
          <MagnifyingGlass className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={searchRef}
            value={threads.query}
            onChange={(e) => threads.search(e.target.value)}
            placeholder={t("searchHistory")}
            aria-label={t("searchHistory")}
            className="h-9 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>
      <div aria-busy={threads.loading} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        {threads.failure ? (
          <p role="alert" className="px-2 py-3 text-xs text-destructive-ink">
            {threads.failure === "delete" ? t("deleteError") : t("historyError")}
          </p>
        ) : null}
        <ul aria-label={t("threadsLegend")}>
          {visible.map((thread) => {
            const running = live.includes(thread.id) || thread.running === true;
            return (
              <ThreadRow
                key={thread.id}
                thread={thread}
                active={thread.id === activeId}
                running={running}
                place={threadPlace(thread.projectId, projectId)}
                now={now}
                disabled={disabled}
                deleteDisabled={running || threads.removing !== null}
                onPick={() => onPick(thread.id)}
                onRemove={() => void remove(thread.id)}
              />
            );
          })}
        </ul>
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-sm leading-relaxed text-muted-foreground">
            {threads.loading ? t("loading") : threads.query.trim() ? t("noSearchResults") : t("noConversations")}
          </p>
        ) : null}
        {threads.hasMore ? (
          <button
            type="button"
            onClick={threads.loadMore}
            disabled={threads.loading}
            className="mt-1 flex min-h-9 w-full items-center justify-center rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            {t("sessions.loadMore")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
