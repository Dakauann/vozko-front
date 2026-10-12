"use client";

import { Plus, List } from "@/components/icons";
import { useLocale, useTranslations } from "next-intl";
import { attachmentOfImage } from "@/lib/aichat/attachments";
import type { ChatAttachment, ChatMedia } from "@/lib/aichat/types";
import { useCallback, useState } from "react";

import { EloAvatar, EloMark } from "@/components/ai-chat/elo-mark";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StarterList } from "@/components/ai-chat/starter-list";
import { starterGroupsFor } from "@/components/ai-chat/starter-groups";

import { cn } from "@/lib/utils";
import { Composer } from "@/components/ai-chat/composer";
import { MessageBubble, useBubbleLabels } from "@/components/ai-chat/message-list";
import { useChatAttachments } from "@/components/ai-chat/use-chat-attachments";
import { useChatConversation } from "@/components/ai-chat/use-chat-conversation";
import { useStudioMode } from "@/components/ai-chat/studio-mode";
import { useVoiceMode } from "@/components/ai-chat/voice/use-voice-mode";
import { speechLang } from "@/lib/voice/speech-text";
import { useChatModel } from "@/components/ai-chat/use-chat-model";
import { useWorkspace } from "@/contexts/workspace-context";
import { activeThreadKey } from "@/lib/aichat/active-thread";
import { useStickToBottom } from "@/components/ai-chat/use-stick-to-bottom";
import { ThreadCostBadge } from "@/components/ai-chat/thread-cost";
import { QueuedMessages } from "@/components/ai-chat/queued-messages";
import { ChatThreadList } from "@/components/ai-chat/chat-thread-list";
import { useChatThreads } from "@/components/ai-chat/use-chat-threads";

export function AIChatClient() {
  const t = useTranslations("aiChatPage");
  const locale = useLocale();
  const threads = useChatThreads(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const { model, models, pricing, changeModel, reasoning } = useChatModel();

  const { currentWorkspace, can } = useWorkspace();
  const [studioMode] = useStudioMode();
  const chat = useChatConversation({
    mode: studioMode,
    reasoning,
    rememberKey: currentWorkspace ? activeThreadKey(currentWorkspace.id) : undefined,
    createError: t("createError"),
    onThreadCreated: threads.add,
  });
  const { scrollRef, onScroll, showScrollDown, scrollToBottom } = useStickToBottom(chat.messages, chat.activeId);
  const labels = useBubbleLabels();
  const files = useChatAttachments();
  const editImage = (image: ChatMedia) => files.attach(attachmentOfImage(image));

  const { newChat } = chat;

  const submit = useCallback(
    (content: string, attachments: ChatAttachment[] = []) => {
      if (!content.trim() || chat.loadingThread || !model) return false;
      void chat.ask(content, model, attachments);
      return true;
    },
    [chat, model],
  );

  const handleSend = useCallback(
    (attachments: ChatAttachment[]) => {
      if (!submit(input, attachments)) return false;
      setInput("");
      return true;
    },
    [input, submit],
  );

  const voice = useVoiceMode({
    messages: chat.messages,
    streaming: chat.streaming,
    error: chat.error,
    lang: speechLang(locale),
    send: submit,
    stop: chat.stop,
  });

  const isEmpty = chat.messages.length === 0;
  const busy = chat.streaming || chat.loadingThread;
  const starters = starterGroupsFor(can, "/dashboard/ai-chat");
  const startNew = () => { newChat(); setInput(""); setHistoryOpen(false); };
  const pick = (threadId: string) => { setHistoryOpen(false); setInput(""); void chat.selectThread(threadId); };
  const buttonClass = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";
  const history = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4">
        <button type="button" onClick={startNew} disabled={busy} className={cn(buttonClass, "w-full border border-control-edge bg-card text-foreground")}>
          <Plus className="h-4 w-4" />{t("newChat")}
        </button>
      </div>
      <ChatThreadList threads={threads} activeId={chat.activeId} disabled={chat.loadingThread} onPick={pick} onActiveRemoved={newChat} className="pt-1" />
      <p className="border-t border-border p-4 text-xs leading-relaxed text-muted-foreground">{t("historyHint")}</p>
    </div>
  );

  return (
    <div className="-m-3 flex h-[calc(100dvh_-_var(--dashboard-header-h))] min-h-0 overflow-hidden bg-card sm:-m-6">
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
          <ThreadCostBadge threadId={chat.activeId} streaming={chat.streaming} />
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
              {chat.messages.map((m, i) => <MessageBubble elo key={m.id} message={m} live={chat.streaming && i === chat.messages.length - 1} onApprove={(id, approval) => void chat.resolveAction(id, "approve", model, approval)} onReject={(id) => void chat.resolveAction(id, "reject", model)} onEditImage={editImage} labels={labels} />)}
              <QueuedMessages items={chat.queued} streaming={chat.streaming} awaitingApproval={chat.awaitingApproval} onRemove={(clientId) => void chat.unqueue(clientId)} onSendNow={() => void chat.sendQueued(model)} />
            </div>
          )}
        </div>
        <div id="elo-page-composer" className="shrink-0 bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Composer docked placeholder={t("eloPlaceholder")} input={input} setInput={setInput} onSend={handleSend} onStop={chat.stop} streaming={chat.streaming} disabled={chat.loadingThread} model={model} models={models} pricing={pricing} onModelChange={changeModel} error={chat.error} showScrollDown={showScrollDown} onScrollDown={scrollToBottom} voice={voice} files={files} />
          <p className="mx-auto max-w-3xl px-4 text-center text-2xs leading-relaxed text-muted-foreground">{t("disclaimer")}</p>
        </div>
      </section>
    </div>
  );
}
