"use client";

import { EmojiPicker } from "frimousse";
import { useLocale, useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { cn } from "@/lib/utils";

export function EmojiPickerPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const t = useTranslations("crmComposer.emoji");
  const locale = useLocale();

  return (
    <EmojiPicker.Root
      locale={locale}
      columns={8}
      onEmojiSelect={({ emoji }) => onPick(emoji)}
      className="flex h-[20rem] w-full flex-col"
    >
      <EmojiPicker.Search
        placeholder={t("search")}
        aria-label={t("search")}
        className="m-2 rounded-[--radius] border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <EmojiPicker.Viewport className="relative flex-1 outline-none">
        <EmojiPicker.Loading className="absolute inset-0">
          <ScreenLoader fit="fill" label={t("loading")} />
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {t("empty")}
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none pb-1.5"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div {...props} className="bg-popover px-3 pb-1 pt-2 text-2xs font-semibold text-muted-foreground">
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div {...props} className="scroll-my-1.5 px-1.5">
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                {...props}
                className={cn("flex size-8 items-center justify-center rounded-[--radius] text-lg", emoji.isActive && "bg-muted")}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}
