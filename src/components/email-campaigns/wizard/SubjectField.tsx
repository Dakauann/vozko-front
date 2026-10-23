"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { MergeTagMenu } from "@/components/email-editor/merge-tag-menu";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import type { CustomField } from "@/lib/email-design/merge-tags";
import { insertAtCaret } from "@/lib/email-design/merge-tags";
import { runeLength } from "@/lib/email-campaigns/draft";
import { cn } from "@/lib/utils";

export function CharacterCount({ value, limit }: { value: string; limit: number }) {
  const t = useTranslations("emailCampaigns.content");
  const count = runeLength(value);
  const over = count > limit;
  return (
    <span className={cn("readout text-2xs", over ? "font-semibold text-destructive-ink" : "text-muted-foreground")} aria-live="polite">
      {t("characterCount", { count, limit })}
    </span>
  );
}

export function SubjectField({
  label,
  value,
  onChange,
  limit,
  customFields,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  limit: number;
  customFields: readonly CustomField[];
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<{ start: number; end: number } | null>(null);

  const remember = () => {
    const input = inputRef.current;
    if (input) caret.current = { start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length };
  };

  const insert = (tag: string) => {
    const at = caret.current ?? { start: value.length, end: value.length };
    const next = insertAtCaret(value, at.start, at.end, tag);
    onChange(next.text);
    window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(next.caret, next.caret);
      caret.current = { start: next.caret, end: next.caret };
    });
  };

  return (
    <div className="min-w-0">
      <div className="flex items-start gap-1.5">
        <ElevatedInput
          ref={inputRef}
          label={label}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onSelect={remember}
          onKeyUp={remember}
          onBlur={remember}
          className="min-w-0 flex-1"
        />
        <div className="pt-2">
          <MergeTagMenu customFields={customFields} onPick={insert} disabled={disabled} onOpenChange={(open) => (open ? remember() : undefined)} />
        </div>
      </div>
      <div className="mt-1 flex justify-end px-1">
        <CharacterCount value={value} limit={limit} />
      </div>
    </div>
  );
}
