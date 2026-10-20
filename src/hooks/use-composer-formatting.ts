"use client";

import { useCallback } from "react";

import { useShortcuts } from "@/hooks/use-shortcuts";
import { toggleMarker, type WhatsAppMarker } from "@/lib/conversations/composer-format";

interface ComposerFormattingOptions {
  textarea: HTMLTextAreaElement | null;
  enabled: boolean;
  onText: (text: string) => void;
}

export function useComposerFormatting({ textarea, enabled, onText }: ComposerFormattingOptions) {
  const wrap = useCallback(
    (marker: WhatsAppMarker) => {
      if (!textarea) return;
      const next = toggleMarker({ text: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd }, marker);
      onText(next.text);
      requestAnimationFrame(() => textarea.setSelectionRange(next.start, next.end));
    },
    [onText, textarea],
  );

  useShortcuts(
    "composer",
    {
      "composer.bold": () => wrap("*"),
      "composer.italic": () => wrap("_"),
      "composer.strike": () => wrap("~"),
    },
    { element: textarea, enabled },
  );
}
