"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { readStudioMode, writeStudioMode } from "@/lib/aichat/chat-mode";
import { CHAT_MODES, type ChatMode } from "@/lib/aichat/types";

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function useStudioMode(): [ChatMode, (mode: ChatMode) => void] {
  const [mode, setMode] = useState<ChatMode>(() => readStudioMode(browserStorage()));
  const change = useCallback((next: ChatMode) => {
    setMode(next);
    writeStudioMode(browserStorage(), next);
  }, []);
  return [mode, change];
}

export function StudioModePicker({ mode, onChange, disabled }: { mode: ChatMode; onChange: (mode: ChatMode) => void; disabled: boolean }) {
  const t = useTranslations("aiChatPage.dock.modes");
  return (
    <div className="space-y-1 px-4 pb-1 pt-2">
      <ElevatedPillToggle<ChatMode>
        aria-label={t("label")}
        size="sm"
        value={mode}
        onChange={onChange}
        className="flex w-full [&>button]:flex-1"
        options={CHAT_MODES.map((value) => ({ value, label: t(`${value}.title`), disabled }))}
      />
      <p className="text-2xs text-muted-foreground">{t(`${mode}.hint`)}</p>
    </div>
  );
}
