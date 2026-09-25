"use client";

import { Plus, TrashSimple } from "@/components/icons";
import { useTranslations } from "next-intl";
import type { ChatThread } from "@/lib/aichat/types";
import { deleteChatThreadAction, listChatThreadsAction } from "@/app/actions/aichat";
import { useCallback, useEffect, useState } from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { CircuitBoard, DotMatrix } from "@/components/brand/circuit";
import { LightPool } from "@/components/brand/light-pool";
import { Composer, PANEL_EASE } from "@/components/ai-chat/composer";
import { MessageBubble, useBubbleLabels } from "@/components/ai-chat/message-list";
import { useChatConversation } from "@/components/ai-chat/use-chat-conversation";
import { useChatModel } from "@/components/ai-chat/use-chat-model";
import { useStickToBottom } from "@/components/ai-chat/use-stick-to-bottom";

export function AIChatClient() {
  const t = useTranslations("aiChatPage");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [input, setInput] = useState("");
  const { model, models, pricing, changeModel } = useChatModel();

  const refreshThreads = useCallback(async () => {
    const { data } = await listChatThreadsAction();
    if (data) setThreads(data.items);
  }, []);

  const chat = useChatConversation({
    createError: t("createError"),
    onThreadCreated: (thread) => setThreads((prev) => [thread, ...prev]),
    onTurnFinished: () => void refreshThreads(),
  });
  const { scrollRef, onScroll, showScrollDown, scrollToBottom } = useStickToBottom(chat.messages);
  const labels = useBubbleLabels();

  useEffect(() => {
    let cancelled = false;
    listChatThreadsAction().then(({ data }) => {
      if (!cancelled && data) setThreads(data.items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { activeId, newChat } = chat;
  const removeThread = useCallback(
    async (id: string) => {
      await deleteChatThreadAction(id);
      setThreads((prev) => prev.filter((th) => th.id !== id));
      if (activeId === id) newChat();
    },
    [activeId, newChat],
  );

  const handleSend = useCallback(() => {
    const content = input;
    if (!content.trim() || chat.streaming || !model) return;
    setInput("");
    void chat.ask(content, model);
  }, [input, chat, model]);

  const isEmpty = chat.messages.length === 0;
  const reduceMotion = useReducedMotion();

  const starters = [
    t("starterListAgents"),
    t("starterCreateAgent"),
    t("starterModels"),
    t("starterAgentTools"),
  ];

  return (
    <div className="-m-3 flex h-[calc(100dvh-3rem)] overflow-hidden border-y border-border bg-card sm:-m-6">
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <span className="legend">{t("threadsLegend")}</span>
          <button
            type="button"
            onClick={newChat}
            className="rounded-[--radius] inline-flex items-center gap-1.5 border border-control-edge bg-card px-2 py-1 text-2xs font-semibold text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus weight="bold" className="h-3 w-3" />
            {t("newChat")}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {threads.map((thread) => {
            const current = activeId === thread.id;
            return (
              <div
                key={thread.id}
                className={cn(
                  "group flex items-center gap-2 pr-2 text-sm transition-colors duration-DEFAULT",
                  current
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-[hsl(var(--accent-hover))] hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-3 w-[3px] flex-shrink-0 bg-lamp transition-opacity duration-DEFAULT",
                    current ? "opacity-100" : "opacity-0",
                  )}
                />
                <button
                  type="button"
                  onClick={() => void chat.selectThread(thread.id)}
                  className="min-w-0 flex-1 truncate py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {thread.title || t("untitled")}
                </button>
                <button
                  type="button"
                  onClick={() => void removeThread(thread.id)}
                  className="flex-shrink-0 text-muted-foreground opacity-0 transition-opacity duration-DEFAULT hover:text-destructive-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                  aria-label={t("deleteConversation")}
                >
                  <TrashSimple className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {threads.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noConversations")}
            </p>
          ) : null}
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-card">
        {isEmpty && (
          <>
            <LightPool />
            <CircuitBoard className="pointer-events-none absolute -right-8 -top-8 hidden h-72 w-72 sm:block xl:h-96 xl:w-96" />
            <DotMatrix
              tone="quiet"
              className="pointer-events-none absolute bottom-28 left-8 hidden h-20 w-32 lg:block"
            />
          </>
        )}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={cn(
            "min-h-0 overflow-y-auto px-4",
            isEmpty ? "flex flex-1 flex-col justify-end pb-6" : "flex-1 py-6",
          )}
        >
          {isEmpty ? (
            <h1 className="mx-auto w-full max-w-3xl text-balance text-center font-display text-2xl font-semibold tracking-[0.01em] text-foreground">
              {t("greeting")}
            </h1>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {chat.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  streaming={chat.streaming}
                  onApprove={(id) => void chat.resolveAction(id, "approve", model)}
                  onReject={(id) => void chat.resolveAction(id, "reject", model)}
                  labels={labels}
                />
              ))}
              {chat.loadingThread ? (
                <p className="text-center text-sm text-muted-foreground">{t("loading")}</p>
              ) : null}
            </div>
          )}
        </div>

        <Composer
          docked={!isEmpty}
          input={input}
          setInput={setInput}
          onSend={handleSend}
          onStop={chat.stop}
          streaming={chat.streaming}
          model={model}
          models={models}
          pricing={pricing}
          onModelChange={changeModel}
          error={chat.error}
          showScrollDown={showScrollDown}
          onScrollDown={scrollToBottom}
          labels={{
            placeholder: t("inputPlaceholder"),
            send: t("send"),
            stop: t("stop"),
            modelLabel: t("modelLabel"),
            scrollToBottom: t("scrollToBottom"),
          }}
        />

        <AnimatePresence initial={false}>
          {isEmpty ? (
            <motion.div
              key="starters"
              layout
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: PANEL_EASE }}
              className="flex flex-1 flex-col items-center px-4 pt-4"
            >
              <div className="flex w-full max-w-3xl flex-wrap justify-center gap-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="rounded-lg border border-control-edge bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    </div>
  );
}
