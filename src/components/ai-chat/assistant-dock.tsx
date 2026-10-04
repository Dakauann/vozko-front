"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import { DOCK_HEADER_ICON_BUTTON as HEADER_ICON_BUTTON, PANEL_EASE } from "@/components/docks/dock-chrome";
import { ArrowSquareOut, ArrowsInSimple, ArrowsOutSimple, Minus, Plus } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { Link, usePathname } from "@/i18n/routing";
import { activeThreadKey } from "@/lib/aichat/active-thread";
import type { AssistantContext } from "@/lib/aichat/assistant-context";
import { attachmentOfImage } from "@/lib/aichat/attachments";
import type { ChatAttachment, ChatImage } from "@/lib/aichat/types";
import { cn } from "@/lib/utils";
import { speechLang } from "@/lib/voice/speech-text";

import { useAssistantContext } from "./assistant-context";
import { AssistantLauncher } from "./assistant-launcher";
import { Composer } from "./composer";
import { MessageBubble, useBubbleLabels } from "./message-list";
import { useChatAttachments } from "./use-chat-attachments";
import { useDockOpen } from "./use-dock-open";
import { useChatConversation } from "./use-chat-conversation";
import { useChatModel } from "./use-chat-model";
import { useResizableSheet } from "./use-resizable-sheet";
import { useStickToBottom } from "./use-stick-to-bottom";
import { starterGroupsFor } from "./starter-groups";
import { StarterList } from "./starter-list";
import { useVoiceMode } from "./voice/use-voice-mode";

const SHEET_WIDTH_KEY = "assistant-dock:sheet-width";
const FULL_CHAT_PATH = "/dashboard/ai-chat";

export function AssistantDock() {
  const { can, permissionsLoading } = useWorkspace();
  const pathname = usePathname();
  if (permissionsLoading || !can("ai_chat", "create") || pathname.startsWith(FULL_CHAT_PATH)) return null;
  return <Dock />;
}

function useCopy(context: AssistantContext | null) {
  const ta = useTranslations("metricsOps.attendance.assistant");
  const td = useTranslations("aiChatPage.dock");
  if (context?.kind === "attendance") {
    return { greeting: ta("greeting"), description: ta("description"), title: ta("title") };
  }
  return { greeting: td("greeting"), description: td("description"), title: td("title") };
}

function Dock() {
  const td = useTranslations("aiChatPage.dock");
  const ta = useTranslations("metricsOps.attendance.assistant");
  const tc = useTranslations("aiChatPage");
  const context = useAssistantContext();
  const copy = useCopy(context);
  const { can, currentWorkspace } = useWorkspace();
  const pathname = usePathname();
  const locale = useLocale();
  const starters = starterGroupsFor(can, pathname);
  const [open, setOpen] = useDockOpen();
  const [input, setInput] = useState("");
  const { model, models, pricing, changeModel } = useChatModel();
  const chat = useChatConversation({
    view: context?.view,
    rememberKey: currentWorkspace ? activeThreadKey(currentWorkspace.id) : undefined,
    createError: tc("createError"),
  });
  const labels = useBubbleLabels();
  const files = useChatAttachments();
  const editImage = (image: ChatImage) => files.attach(attachmentOfImage(image));
  const { scrollRef, onScroll, showScrollDown, scrollToBottom } = useStickToBottom(chat.messages, `${open}:${chat.activeId ?? ""}`);
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const card = useResizableSheet(SHEET_WIDTH_KEY, open);
  const { expanded, setExpanded } = card;

  const submit = useCallback(
    (content: string, attachments: ChatAttachment[] = []) => {
      if (!content.trim() || chat.streaming || !model) return false;
      void chat.ask(content, model, attachments);
      return true;
    },
    [chat, model],
  );

  const ask = useCallback(
    (content: string, attachments: ChatAttachment[] = []) => {
      if (!submit(content, attachments)) return false;
      setInput("");
      return true;
    },
    [submit],
  );

  const voice = useVoiceMode({
    messages: chat.messages,
    streaming: chat.streaming,
    error: chat.error,
    lang: speechLang(locale),
    send: submit,
    stop: chat.stop,
  });
  const { disable: stopVoice } = voice;

  const minimize = useCallback(() => {
    stopVoice();
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }, [stopVoice]);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.querySelector("textarea")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (expanded) setExpanded(false);
      else minimize();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, minimize, expanded, setExpanded]);

  const isEmpty = chat.messages.length === 0;
  const sizeStyle: CSSProperties = card.pushing ? { width: card.width } : { left: 0 };
  const scope = context?.scope;
  const chips = scope
    ? [scope.period, scope.department, scope.member, scope.channel, scope.campaign].filter((v): v is string => Boolean(v))
    : [];

  return (
    <>
      {!open ? (
        <AssistantLauncher
          ref={launcherRef}
          placement="edge"
          label={td("open")}
          tabLabel={td("tabLabel")}
          busy={chat.streaming}
          onClick={() => setOpen(true)}
        />
      ) : null}
      <AnimatePresence>
        {open ? (
          <motion.section
            ref={cardRef}
            key="assistant"
            role="dialog"
            aria-modal="false"
            aria-labelledby="assistant-dock-title"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: PANEL_EASE }}
            style={{ transformOrigin: "right center", ...sizeStyle }}
            className={cn(
              "fixed bottom-0 right-0 top-12 z-[61] flex flex-col overflow-hidden border-t border-border-strong bg-card shadow-lg",
              card.pushing && "border-l",
              card.resizing && "select-none",
            )}
          >
            {card.pushing ? (
              <button
                type="button"
                aria-label={td("resize")}
                title={td("resize")}
                {...card.handleProps}
                className="group absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize touch-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring flex"
              >
                <span aria-hidden className="h-10 w-1 rounded-full bg-border-strong transition-colors duration-DEFAULT group-hover:bg-primary" />
              </button>
            ) : null}
            <header
              className="border-b border-border px-4 pb-2.5 pt-3"
              onDoubleClick={(e) => {
                if (!(e.target as HTMLElement).closest("button, a")) card.toggleExpanded();
              }}
            >
              <div className="flex items-center gap-2.5">
                <span aria-hidden className={cn("h-2 w-2 flex-shrink-0 rotate-45 rounded-[1px] bg-primary", chat.streaming && "animate-dot-pulse")} />
                <h2 id="assistant-dock-title" className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-foreground">
                  {copy.title}
                </h2>
                {!isEmpty ? (
                  <button type="button" onClick={chat.newChat} disabled={chat.streaming} className={HEADER_ICON_BUTTON}>
                    <Plus weight="bold" className="h-3 w-3" />
                    <span className="max-sm:sr-only">{td("newChat")}</span>
                  </button>
                ) : null}
                {chat.activeId ? (
                  <Link href={FULL_CHAT_PATH} className={HEADER_ICON_BUTTON}>
                    <ArrowSquareOut weight="bold" className="h-3 w-3" />
                    <span className="max-sm:sr-only">{td("openFull")}</span>
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={card.toggleExpanded}
                  aria-pressed={expanded}
                  aria-label={expanded ? td("exitFullscreen") : td("fullscreen")}
                  title={expanded ? td("exitFullscreen") : td("fullscreen")}
                  className={HEADER_ICON_BUTTON}
                >
                  {expanded ? <ArrowsInSimple weight="bold" className="h-3.5 w-3.5" /> : <ArrowsOutSimple weight="bold" className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={minimize} aria-label={td("minimize")} title={td("minimize")} className={HEADER_ICON_BUTTON}>
                  <Minus weight="bold" className="h-3.5 w-3.5" />
                </button>
              </div>
              {chips.length > 0 ? (
                <dl className="mt-2 flex min-w-0 flex-wrap items-center gap-1 text-2xs">
                  <dt className="sr-only">{ta("scope")}</dt>
                  {chips.map((value, i) => (
                    <dd
                      key={i}
                      title={value}
                      className="max-w-[10rem] truncate rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-muted-foreground"
                    >
                      {value}
                    </dd>
                  ))}
                </dl>
              ) : null}
            </header>

            <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {isEmpty ? (
                <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-end gap-3">
                  <p className="text-balance font-display text-lg font-semibold leading-snug text-foreground">{copy.greeting}</p>
                  <p className="text-xs text-muted-foreground">{copy.description}</p>
                  <div className="mt-1">
                    <StarterList groups={starters.groups} initialOpen={starters.open} onPick={ask} disabled={!model} />
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                  {chat.messages.map((m, i) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      live={chat.streaming && i === chat.messages.length - 1}
                      onApprove={(id, approval) => void chat.resolveAction(id, "approve", model, approval)}
                      onReject={(id) => void chat.resolveAction(id, "reject", model)}
                      onEditImage={editImage}
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
              onSend={(attachments) => ask(input, attachments)}
              onStop={chat.stop}
              streaming={chat.streaming}
              model={model}
              models={models}
              pricing={pricing}
              onModelChange={changeModel}
              error={chat.error}
              showScrollDown={showScrollDown}
              onScrollDown={scrollToBottom}
              voice={voice}
              files={files}
            />
            <p className="px-4 pb-2.5 text-center text-2xs text-muted-foreground">{td("footnote")}</p>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </>
  );
}
