"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

interface MessageEditorProps {
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export function MessageEditor({ initialText, onSave, onCancel }: MessageEditorProps) {
  const t = useTranslations("crmMessage.edit");
  const [text, setText] = useState(initialText);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);

  const save = () => onSave(text);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save();
    }
  };

  return (
    <div className="min-w-[14rem]">
      <textarea
        ref={fieldRef}
        value={text}
        rows={Math.min(6, Math.max(2, text.split("\n").length))}
        aria-label={t("label")}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        className="block w-full resize-none rounded-[--radius] border border-border bg-background px-2 py-1.5 text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-2xs text-muted-foreground">{t("hint")}</p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[--radius] px-2 py-1 text-2xs font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!text.trim()}
            className="rounded-[--radius] bg-primary px-2 py-1 text-2xs font-semibold text-primary-foreground hover:bg-[hsl(var(--primary-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
