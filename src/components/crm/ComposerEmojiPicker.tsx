"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Smiley } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { EmojiPickerPanel } from "./EmojiPickerPanel";

interface ComposerEmojiPickerProps {
  disabled?: boolean;
  onPick: (emoji: string) => void;
  onClosed?: () => void;
}

export function ComposerEmojiPicker({ disabled = false, onPick, onClosed }: ComposerEmojiPickerProps) {
  const t = useTranslations("crmComposer.emoji");
  const [open, setOpen] = useState(false);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) onClosed?.();
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={t("open")}
          title={t("open")}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Smiley weight="bold" className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-[19rem] p-0"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <EmojiPickerPanel
          onPick={(emoji) => {
            onPick(emoji);
            changeOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
