"use client";

import { Plus, TrashSimple, MagnifyingGlass, ChatsCircle, List } from "@/components/icons";
import { useTranslations } from "next-intl";
import type { ChatAttachment, ChatThread } from "@/lib/aichat/types";
import { deleteChatThreadAction, listChatThreadsAction } from "@/app/actions/aichat";
import { useCallback, useEffect, useState } from "react";

import { EloAvatar, EloMark } from "@/components/ai-chat/elo-mark";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StarterList } from "@/components/ai-chat/starter-list";
import { starterGroupsFor } from "@/components/ai-chat/starter-groups";

import { cn } from "@/lib/utils";
import { Composer } from "@/components/ai-chat/composer";
import { MessageBubble, useBubbleLabels } from "@/components/ai-chat/message-list";
import { useChatConversation } from "@/components/ai-chat/use-chat-conversation";
import { useChatModel } from "@/components/ai-chat/use-chat-model";
import { useWorkspace } from "@/contexts/workspace-context";
import { activeThreadKey } from "@/lib/aichat/active-thread";
import { useStickToBottom } from "@/components/ai-chat/use-stick-to-bottom";

export function AIChatClient() {
  const t = useTranslations("aiChatPage");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const { model, models, pricing, changeModel } = useChatModel();

  const refreshThreads = useCallback(async () => {
    const { data } = await listChatThreadsAction();
    if (data) setThreads(data.items);
  }, []);

  const { currentWorkspace, can } = useWorkspace();
  const chat = useChatConversation({
    rememberKey: currentWorkspace ? activeThreadKey(currentWorkspace.id) : undefined,
    createError: t("createError"),
    onThreadCreated: (thread) => setThreads((prev) => [thread, ...prev]),
    onTurnFinished: () => void refreshThreads(),
  });
  const { scrollRef, onScroll, showScrollDown, scrollToBottom } = useStickToBottom(chat.messages);
  const labels = useBubbleLabels();

  useEffect(() => {
    let cancelled = false;
    listChatThreadsAction().then(({ data, error }) => {
      if (cancelled) return;
      if (data) setThreads(data.items);
      setHistoryError(error ? t("historyError") : null);
    });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const { activeId, newChat } = chat;
  const removeThread = useCallback(
    async (id: string) => {
      setDeleting(id);
      const { error } = await deleteChatThreadAction(id);
      setDeleting(null);
      if (error) { setHistoryError(t("deleteError")); return; }
      setHistoryError(null);
      setThreads((prev) => prev.filter((th) => th.id !== id));
      if (activeId === id) newChat();
    },
    [activeId, newChat, t],
  );

  const handleSend = useCallback(
    (attachments: ChatAttachment[]) => {
      const content = input;
      if (!content.trim() || chat.streaming || chat.loadingThread || !model) return false;
      setInput("");
      void chat.ask(content, model, attachments);
      return true;
    },
    [input, chat, model],
  );

  const isEmpty = chat.messages.length === 0;
  const busy = chat.streaming || chat.loadingThread;
  const starters = starterGroupsFor(can, "/dashboard/ai-chat");
  const visibleThreads = threads.filter((thread) => (thread.title || t("untitled")).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const startNew = () => { newChat(); setInput(""); setHistoryOpen(false); };
  const buttonClass = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";
  const history = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-4 p-4">
        <button type="button" onClick={startNew} disabled={busy} className={cn(buttonClass, "w-full border border-control-edge bg-card text-foreground")}>
          <Plus className="h-4 w-4" />{t("newChat")}
        </button>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 focus-within:ring-2 focus-within:ring-ring">
          <MagnifyingGlass className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchHistory")} aria-label={t("searchHistory")} className="h-9 min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {historyError ? <p role="alert" className="px-2 py-3 text-xs text-destructive-ink">{historyError}</p> : null}
        {visibleThreads.map((thread) => (
          <div key={thread.id} className={cn("group mb-1 flex items-center rounded-lg", activeId === thread.id ? "bg-muted font-semibold text-foreground ring-1 ring-inset ring-control-edge" : "text-muted-foreground hover:bg-muted")}>
            <button type="button" disabled={busy} aria-current={activeId === thread.id ? "true" : undefined} onClick={() => { setHistoryOpen(false); setInput(""); void chat.selectThread(thread.id); }} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
              <ChatsCircle className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{thread.title || t("untitled")}</span>
            </button>
            <button type="button" disabled={busy || deleting !== null} onClick={() => void removeThread(thread.id)} aria-label={t("deleteConversation")} className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
              <TrashSimple className="h-4 w-4" />
            </button>
          </div>
        ))}
        {!visibleThreads.length ? <p className="px-3 py-6 text-sm leading-relaxed text-muted-foreground">{search ? t("noSearchResults") : t("noConversations")}</p> : null}
      </div>
      <p className="border-t border-border p-4 text-xs leading-relaxed text-muted-foreground">{t("historyHint")}</p>
    </div>
  );

  return (
    <div className="-m-3 flex h-[calc(100dvh-3rem)] min-h-0 overflow-hidden bg-card sm:-m-6">
      <aside aria-label={t("threadsLegend")} className="hidden w-60 shrink-0 flex-col border-r border-border bg-background lg:flex xl:w-64">
        <h2 className="flex h-[73px] shrink-0 items-center border-b border-border px-4 text-sm font-semibold">{t("threadsLegend")}</h2>
        {history}
      </aside>
      <section aria-label={t("assistantName")} className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[73px] shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogTrigger asChild><button type="button" className={cn(buttonClass, "px-2 lg:hidden")} aria-label={t("threadsLegend")}><List className="h-5 w-5" /></button></DialogTrigger>
            <DialogContent aria-describedby={undefined} className="flex h-[min(640px,85dvh)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0">
              <DialogTitle className="border-b border-border px-4 py-5 text-base">{t("threadsLegend")}</DialogTitle>
              {history}
            </DialogContent>
          </Dialog>
          <EloAvatar />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-semibold">{t("assistantName")}</h1>
            <p className="truncate text-xs text-muted-foreground">{t("assistantRole")}</p>
          </div>
          <button type="button" onClick={startNew} disabled={busy} className={buttonClass}><Plus className="h-4 w-4" /><span className="hidden sm:inline">{t("newChat")}</span><span className="sr-only sm:hidden">{t("newChat")}</span></button>
        </header>
        <div ref={scrollRef} onScroll={onScroll} aria-busy={chat.loadingThread} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6">
          {chat.loadingThread ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">{t("loading")}</p> : isEmpty ? (
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center py-8 sm:py-12">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-control-edge bg-background text-foreground"><EloMark className="h-11 w-11" /></div>
              <h2 className="max-w-xl text-balance font-display text-2xl font-semibold leading-tight sm:text-3xl">{t("greeting")}</h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{t("description")}</p>
              {starters.groups.length ? (
                <div className="mt-7">
                  <StarterList groups={starters.groups} initialOpen={starters.open} disabled={busy} onPick={(question) => {
                    setInput(question);
                    document.getElementById("elo-page-composer")?.querySelector("textarea")?.focus();
                  }} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-8 py-6 sm:py-8">
              {chat.messages.map((m, i) => <MessageBubble elo key={m.id} message={m} live={chat.streaming && i === chat.messages.length - 1} onApprove={(id) => void chat.resolveAction(id, "approve", model)} onReject={(id) => void chat.resolveAction(id, "reject", model)} labels={labels} />)}
            </div>
          )}
        </div>
        <div id="elo-page-composer" className="shrink-0 bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Composer docked spacious placeholder={t("eloPlaceholder")} input={input} setInput={setInput} onSend={handleSend} onStop={chat.stop} streaming={chat.streaming} disabled={chat.loadingThread} model={model} models={models} pricing={pricing} onModelChange={changeModel} error={chat.error} showScrollDown={showScrollDown} onScrollDown={scrollToBottom} />
          <p className="mx-auto max-w-3xl px-4 text-center text-2xs leading-relaxed text-muted-foreground">{t("disclaimer")}</p>
        </div>
      </section>
    </div>
  );
}
