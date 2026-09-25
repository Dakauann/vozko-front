"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowSquareOut, Plus, Sparkle } from "@/components/icons";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { Composer } from "@/components/ai-chat/composer";
import { MessageBubble, useBubbleLabels } from "@/components/ai-chat/message-list";
import { useChatConversation } from "@/components/ai-chat/use-chat-conversation";
import { useChatModel } from "@/components/ai-chat/use-chat-model";
import { useStickToBottom } from "@/components/ai-chat/use-stick-to-bottom";
import { Link } from "@/i18n/routing";
import type { ChatView } from "@/lib/aichat/types";

const STARTERS = ["summary", "team", "trend", "backlog", "why"] as const;

export interface AssistantScope {
  period: string;
  department: string;
  member: string;
  channel: string;
}

export function AttendanceAssistant({
  open,
  onOpenChange,
  view,
  scope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ChatView;
  scope: AssistantScope;
}) {
  const t = useTranslations("metricsOps.attendance.assistant");
  const tc = useTranslations("aiChatPage");
  const [input, setInput] = useState("");
  const { model, models, pricing, changeModel } = useChatModel();
  const chat = useChatConversation({ view, createError: tc("createError") });
  const labels = useBubbleLabels();
  const { scrollRef, onScroll, showScrollDown, scrollToBottom } = useStickToBottom(chat.messages);

  const ask = useCallback(
    (content: string) => {
      if (!content.trim() || chat.streaming || !model) return;
      setInput("");
      void chat.ask(content, model);
    },
    [chat, model],
  );

  const isEmpty = chat.messages.length === 0;

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[36rem]">
        <header className="border-b border-border px-5 pb-3 pt-5 pr-16">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
              <Sparkle weight="fill" className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <ElevatedSheetTitle className="font-display text-lg font-semibold leading-tight">
                {t("title")}
              </ElevatedSheetTitle>
              <ElevatedSheetDescription className="mt-0.5 text-xs text-muted-foreground">
                {t("description")}
              </ElevatedSheetDescription>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <dl className="flex min-w-0 flex-wrap items-center gap-1.5 text-2xs">
              <dt className="font-semibold text-muted-foreground">{t("scope")}</dt>
              {[scope.period, scope.department, scope.member, scope.channel].map((value, i) => (
                <dd
                  key={i}
                  className="max-w-[11rem] truncate rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-foreground"
                  title={value}
                >
                  {value}
                </dd>
              ))}
            </dl>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              {!isEmpty ? (
                <button
                  type="button"
                  onClick={chat.newChat}
                  disabled={chat.streaming}
                  className="inline-flex items-center gap-1 rounded-[--radius] border border-control-edge bg-card px-2 py-1 text-2xs font-semibold text-foreground transition-colors duration-DEFAULT hover:bg-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus weight="bold" className="h-3 w-3" />
                  {t("newChat")}
                </button>
              ) : null}
              {chat.activeId ? (
                <Link
                  href="/dashboard/ai-chat"
                  className="inline-flex items-center gap-1 rounded-[--radius] px-2 py-1 text-2xs font-semibold text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowSquareOut weight="bold" className="h-3 w-3" />
                  {t("openFull")}
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {isEmpty ? (
            <div className="flex h-full flex-col justify-end gap-4">
              <p className="text-balance font-display text-xl font-semibold leading-snug text-foreground">
                {t("greeting")}
              </p>
              <ul className="flex flex-col gap-1.5">
                {STARTERS.map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => ask(t(`starters.${key}`))}
                      disabled={!model}
                      className="w-full rounded-lg border border-control-edge bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t(`starters.${key}`)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
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
            </div>
          )}
        </div>

        <Composer
          docked
          input={input}
          setInput={setInput}
          onSend={() => ask(input)}
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
            placeholder: tc("inputPlaceholder"),
            send: tc("send"),
            stop: tc("stop"),
            modelLabel: tc("modelLabel"),
            scrollToBottom: tc("scrollToBottom"),
          }}
        />
        <p className="px-5 pb-3 text-center text-2xs text-muted-foreground">{t("footnote")}</p>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
