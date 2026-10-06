"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Info, WarningCircle, X } from "@/components/icons";
import { cn } from "@/lib/utils";

import { useVideoEditor, useViewState } from "./editor-context";

export const NOTICE_MS = 5000;

export function EditorNotice() {
  const t = useTranslations("studio.video.notices");
  const tc = useTranslations("studio.video");
  const { view } = useVideoEditor();
  const notice = useViewState((s) => s.notice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => view.setState({ notice: null }), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, view]);

  if (!notice) return null;
  const error = notice.tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "notice pointer-events-auto fixed bottom-4 left-1/2 z-[150] flex max-w-md -translate-x-1/2 items-center gap-2 px-3 py-2 text-xs shadow-lg",
        error ? "notice-fault" : "notice-info",
      )}
    >
      {error ? <WarningCircle className="notice-ink h-4 w-4 shrink-0" aria-hidden /> : <Info className="notice-ink h-4 w-4 shrink-0" aria-hidden />}
      <span className="text-foreground">{t(notice.key)}</span>
      <button
        type="button"
        aria-label={tc("dismiss")}
        onClick={() => view.setState({ notice: null })}
        className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
