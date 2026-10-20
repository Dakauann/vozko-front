"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, type UIEvent } from "react";
import { useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { MediaGalleryProvider } from "@/components/crm/thread/MediaGallery";
import { READ_ONLY_THREAD_ROW, ThreadRowProvider, useThreadToolCopy, type ThreadRowContextValue } from "@/components/crm/thread/thread-context";
import { ThreadRowView } from "@/components/crm/thread/ThreadRowView";
import Button from "@/components/elevated-design/button";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import { ArrowClockwise, ChatsCircle, WarningCircle } from "@/components/icons";
import { useThreadAnchor } from "@/hooks/use-thread-anchor";
import { galleryItems } from "@/lib/conversations/media-gallery";
import { buildThreadRows, daySections } from "@/lib/conversations/thread-rows";
import type { ConversationMessage } from "@/lib/conversations/types";
import { atHistoryStart, feedConversation, toThreadMessage } from "@/lib/unofficial-whatsapp-groups/group-feed";

import { QuietEmpty } from "../kit/empty";
import type { GroupFeed } from "./use-group-feed";

const LOAD_OLDER_WITHIN_PX = 120;
const FEED_BOX = "h-[min(60vh,34rem)] rounded-[--radius] bg-muted/30";

export function FeedRefreshButton({ feed }: { feed: GroupFeed }) {
  const t = useTranslations("unofficialGroups.detail.messagesTab");
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("refresh")}
      icon={<ArrowClockwise weight="bold" className="h-4 w-4" />}
      iconVisible
      onClick={feed.refresh}
      disabled={feed.state.phase === "loading" || feed.state.loadingOlder}
    />
  );
}

export function GroupMessageFeed({ conversationId, feed }: { conversationId: string; feed: GroupFeed }) {
  const t = useTranslations("unofficialGroups.detail.messagesTab");
  const empty = useEmptyValue();
  const toolCopy = useThreadToolCopy();
  const { state, generation, refresh, loadOlder } = feed;

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const lockedRef = useRef(false);

  useEffect(() => {
    pinnedRef.current = true;
  }, [generation]);

  const labels = useMemo(() => ({ ourTeam: t("ourTeam"), unknown: empty }), [t, empty]);
  const messages = useMemo<ConversationMessage[]>(() => state.messages.map((m) => toThreadMessage(m, labels)), [state.messages, labels]);
  const sections = useMemo(() => daySections(buildThreadRows(messages, { unreadFrom: null })), [messages]);
  const gallery = useMemo(() => galleryItems(messages), [messages]);
  const messagesById = useMemo(() => new Map(messages.map((m): [string, ConversationMessage] => [m.id, m])), [messages]);

  const showsThread = state.phase === "ready" && messages.length > 0;
  const trackAnchor = useThreadAnchor({
    containerRef,
    contentRef,
    pinnedRef,
    lockedRef,
    threadKey: showsThread ? `${conversationId}:${generation}` : undefined,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.clientHeight === 0) return;
    if (container.scrollHeight <= container.clientHeight) loadOlder();
  }, [messages, loadOlder]);

  const jumpToMessage = useCallback((id: string) => {
    const target = containerRef.current?.querySelector(`[data-msg-id="${CSS.escape(id)}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const rowContext = useMemo<ThreadRowContextValue>(
    () => ({ ...READ_ONLY_THREAD_ROW, conversation: feedConversation(conversationId), messagesById, onJumpToMessage: jumpToMessage, toolCopy }),
    [conversationId, messagesById, jumpToMessage, toolCopy],
  );

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    trackAnchor();
    if (event.currentTarget.scrollTop <= LOAD_OLDER_WITHIN_PX) loadOlder();
  };

  if (state.phase === "loading") {
    return (
      <div className={`flex items-center justify-center ${FEED_BOX}`}>
        <ScreenLoader fit="inline" label={t("loading")} />
      </div>
    );
  }

  if (state.phase === "failed") {
    return (
      <QuietEmpty
        icon={<WarningCircle className="text-destructive" weight="fill" />}
        message={t("error")}
        action={<Button variant="secondary" size="sm" title={t("retry")} icon={<ArrowClockwise />} iconVisible onClick={refresh} />}
      />
    );
  }

  if (messages.length === 0) {
    return <QuietEmpty icon={<ChatsCircle />} message={t("empty")} />;
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      role="region"
      aria-label={t("feedRegion")}
      aria-busy={state.loadingOlder}
      tabIndex={0}
      className={`relative overflow-y-auto px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${FEED_BOX}`}
    >
      <ThreadRowProvider value={rowContext}>
        <MediaGalleryProvider items={gallery}>
          <div ref={contentRef} className="mx-auto max-w-3xl space-y-1">
            <FeedTop loadingOlder={state.loadingOlder} olderFailed={state.olderFailed} atStart={atHistoryStart(state)} onRetry={loadOlder} />
            {sections.map((section) => (
              <section key={section.day.key}>
                <ThreadRowView row={section.day} />
                {section.rows.map((row) => (
                  <Fragment key={row.key}>
                    {"runGap" in row && row.runGap ? <div aria-hidden="true" className="h-1" /> : null}
                    <ThreadRowView row={row} />
                  </Fragment>
                ))}
              </section>
            ))}
          </div>
        </MediaGalleryProvider>
      </ThreadRowProvider>
    </div>
  );
}

function FeedTop({
  loadingOlder,
  olderFailed,
  atStart,
  onRetry,
}: {
  loadingOlder: boolean;
  olderFailed: boolean;
  atStart: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("unofficialGroups.detail.messagesTab");
  if (loadingOlder) {
    return (
      <div className="flex justify-center py-2">
        <ScreenLoader fit="inline" label={t("loadingOlder")} />
      </div>
    );
  }
  if (olderFailed) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 py-2 text-xs text-foreground">
        <WarningCircle aria-hidden className="h-4 w-4 text-destructive" weight="fill" />
        <span>{t("olderError")}</span>
        <Button variant="secondary" size="sm" title={t("retry")} onClick={onRetry} />
      </div>
    );
  }
  if (atStart) {
    return (
      <div className="flex justify-center py-2">
        <span className="rounded-lg bg-card px-3 py-1 text-2xs font-medium text-muted-foreground shadow-sm">{t("historyStart")}</span>
      </div>
    );
  }
  return null;
}
