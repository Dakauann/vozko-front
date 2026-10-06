"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import { Info, WarningCircle, X } from "@/components/icons";
import type { Refusal } from "@/lib/studio/selection-edit";
import { cn } from "@/lib/utils";

import { NOTICE_MS } from "../editor-notice";

export type SelectionMessage = Refusal | "copied" | "noKeys" | "clipboardEmpty";

const INFO_MESSAGES: ReadonlySet<SelectionMessage> = new Set<SelectionMessage>(["copied"]);

interface NoticeState {
  message: SelectionMessage | null;
  serial: number;
}

const noticeStore = createStore<NoticeState>()(() => ({ message: null, serial: 0 }));

export function reportSelection(message: SelectionMessage) {
  noticeStore.setState((state) => ({ message, serial: state.serial + 1 }));
}

function dismiss() {
  noticeStore.setState({ message: null });
}

export function SelectionNotice() {
  const t = useTranslations("studio.video.inspector");
  const tc = useTranslations("studio.video");
  const message = useStore(noticeStore, (s) => s.message);
  const serial = useStore(noticeStore, (s) => s.serial);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(dismiss, NOTICE_MS);
    return () => clearTimeout(timer);
  }, [message, serial]);

  if (!message) return null;
  const info = INFO_MESSAGES.has(message);
  return (
    <div role={info ? "status" : "alert"} className={cn("notice sticky top-0 z-10 mx-3 mt-3 flex items-start gap-2 px-2 py-1.5 text-2xs", info ? "notice-info" : "notice-fault")}>
      {info ? <Info className="notice-ink mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> : <WarningCircle className="notice-ink mt-px h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1 text-foreground">{t(`notices.${message}`)}</span>
      <button
        type="button"
        aria-label={tc("dismiss")}
        onClick={dismiss}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}
