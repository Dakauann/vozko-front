"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

import { ArrowSquareOut, ArrowsInSimple, ArrowsOutSimple, Minus, Plus } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { Link, usePathname } from "@/i18n/routing";
import { activeThreadKey } from "@/lib/aichat/active-thread";
import type { AssistantContext } from "@/lib/aichat/assistant-context";
import type { ChatAttachment } from "@/lib/aichat/types";
import { cn } from "@/lib/utils";

import { useAssistantContext } from "./assistant-context";
import { AssistantLauncher } from "./assistant-launcher";
import { Composer, PANEL_EASE } from "./composer";
import { MessageBubble, useBubbleLabels } from "./message-list";
import { useChatConversation } from "./use-chat-conversation";
import { useChatModel } from "./use-chat-model";
import { useResizableCard } from "./use-resizable-card";
import { useStickToBottom } from "./use-stick-to-bottom";
import { starterGroupsFor } from "./starter-groups";
import { StarterList } from "./starter-list";

const CARD_SIZE_KEY = "assistant-dock:size";
const FULL_CHAT_PATH = "/dashboard/ai-chat";
const HEADER_ICON_BUTTON =
  "inline-flex h-7 items-center gap-1 rounded-[--radius] px-2 text-2xs font-semibold text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
  const starters = starterGroupsFor(can, pathname);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { model, models, pricing, changeModel } = useChatModel();
  const chat = useChatConversation({
    view: context?.view,
    rememberKey: currentWorkspace ? activeThreadKey(currentWorkspace.id) : undefined,
    createError: tc("createError"),
  });
  const labels = useBubbleLabels();
  const { scrollRef, onScroll, showScrollDown, scrollToBottom } = useStickToBottom(chat.messages);
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const card = useResizableCard(CARD_SIZE_KEY);
  const { expanded, setExpanded } = card;

  const ask = useCallback(
    (content: string, attachments: ChatAttachment[] = []) => {
      if (!content.trim() || chat.streaming || !model) return false;
      setInput("");
      void chat.ask(content, model, attachments);
      return true;
    },
    [chat, model],
  );

  const minimize = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

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
  const sizeStyle = { "--card-w": `${card.size.width}px`, "--card-h": `${card.size.height}px` } as CSSProperties;
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
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, x: 16 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, x: 12 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: PANEL_EASE }}
            style={{ transformOrigin: "right center", ...sizeStyle }}
            className={cn(
              "fixed z-[60] flex flex-col overflow-hidden rounded-2xl border border-border-strong bg-card shadow-lg",
              expanded
                ? "inset-2 sm:inset-4"
                : "inset-x-2 bottom-20 top-14 sm:inset-x-auto sm:bottom-24 sm:right-6 sm:top-auto sm:h-[min(var(--card-h),calc(100dvh-10.5rem))] sm:w-[min(var(--card-w),calc(100vw-3rem))]",
              card.resizing && "select-none",
            )}
          >
            {!expanded ? (
              <button
                type="button"
                aria-label={td("resize")}
                title={td("resize")}
                {...card.handleProps}
                className="group absolute left-0 top-0 z-10 hidden h-6 w-6 cursor-nwse-resize touch-none items-start justify-start p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex"
              >
                <svg aria-hidden viewBox="0 0 10 10" className="h-2.5 w-2.5 text-muted-foreground/60 transition-colors duration-DEFAULT group-hover:text-foreground">
                  <path d="M1 9V1h8M1 5.5V5.5M5.5 1H5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
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
            />
            <p className="px-4 pb-2.5 text-center text-2xs text-muted-foreground">{td("footnote")}</p>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </>
  );
}
