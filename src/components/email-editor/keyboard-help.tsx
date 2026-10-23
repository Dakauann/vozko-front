"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chordKeys, platformOf, type Platform } from "@/lib/keyboard/chord";

import { Keyboard } from "./glyphs";

export const SHORTCUTS = [
  { id: "undo", chord: "Mod+z" },
  { id: "redo", chord: "Mod+Shift+z" },
  { id: "duplicate", chord: "Mod+d" },
  { id: "remove", chord: "Delete" },
  { id: "moveUp", chord: "Alt+ArrowUp" },
  { id: "moveDown", chord: "Alt+ArrowDown" },
  { id: "deselect", chord: "Escape" },
  { id: "bold", chord: "Mod+b" },
  { id: "italic", chord: "Mod+i" },
  { id: "underline", chord: "Mod+u" },
  { id: "paragraph", chord: "Enter" },
  { id: "lineBreak", chord: "Shift+Enter" },
] as const;

export function KeyboardHelp() {
  const t = useTranslations("emailEditor.keyboard");
  const [platform, setPlatform] = useState<Platform>("other");
  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setPlatform(platformOf(typeof navigator === "undefined" ? undefined : navigator));
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("title")}
          title={t("title")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[--radius] text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Keyboard className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">{t("title")}</p>
        <dl className="space-y-0.5 p-2">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.id} className="flex items-center justify-between gap-3 rounded-[--radius] px-2 py-1.5">
              <dt className="text-xs text-foreground">{t(shortcut.id)}</dt>
              <dd className="flex shrink-0 items-center gap-1">
                {chordKeys(shortcut.chord, platform).map((key) => (
                  <kbd key={key} className="readout min-w-[22px] rounded-[4px] border border-border-strong bg-muted px-1.5 py-0.5 text-center text-2xs font-semibold text-foreground">
                    {t.has(`keys.${key}`) ? t(`keys.${key}`) : key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
