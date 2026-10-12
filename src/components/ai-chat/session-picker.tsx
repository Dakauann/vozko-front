"use client";

import { useId, useRef } from "react";
import { useTranslations } from "next-intl";

import { DOCK_HEADER_ICON_BUTTON } from "@/components/docks/dock-chrome";
import { ClockCounterClockwise } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useLiveThreads } from "./background-turns";
import { ChatThreadList } from "./chat-thread-list";
import { useChatThreads } from "./use-chat-threads";

interface SessionPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeId: string | null;
  projectId?: string;
  disabled: boolean;
  onPick: (threadId: string) => void;
  onActiveRemoved: () => void;
}

export function SessionPicker({ open, onOpenChange, activeId, projectId, disabled, onPick, onActiveRemoved }: SessionPickerProps) {
  const t = useTranslations("aiChatPage");
  const threads = useChatThreads(open);
  const live = useLiveThreads();
  const searchRef = useRef<HTMLInputElement>(null);
  const picked = useRef(false);
  const runningId = useId();
  const elsewhere = live.some((threadId) => threadId !== activeId);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t("threadsLegend")} aria-describedby={elsewhere ? runningId : undefined} className={cn(DOCK_HEADER_ICON_BUTTON, "relative")}>
          <ClockCounterClockwise weight="bold" className="h-3 w-3" />
          <span aria-hidden className="max-sm:hidden">
            {t("threadsLegend")}
          </span>
          {elsewhere ? <span aria-hidden className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rotate-45 rounded-[1px] bg-primary animate-dot-pulse" /> : null}
        </button>
      </PopoverTrigger>
      {elsewhere ? (
        <span id={runningId} className="sr-only">
          {t("sessions.runningElsewhere")}
        </span>
      ) : null}
      <PopoverContent
        aria-label={t("threadsLegend")}
        align="end"
        sideOffset={6}
        collisionPadding={16}
        className="flex max-h-[min(30rem,70dvh)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          if (picked.current) e.preventDefault();
          picked.current = false;
        }}
      >
        <h3 className="border-b border-border px-3 py-2.5 font-display text-xs font-semibold text-foreground">{t("threadsLegend")}</h3>
        <ChatThreadList
          threads={threads}
          activeId={activeId}
          projectId={projectId}
          disabled={disabled}
          searchRef={searchRef}
          onActiveRemoved={onActiveRemoved}
          onPick={(threadId) => {
            picked.current = true;
            onOpenChange(false);
            onPick(threadId);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
