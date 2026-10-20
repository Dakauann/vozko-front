"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export type ComposerMode = "message" | "note";

const MODES: readonly ComposerMode[] = ["message", "note"];

export function ComposerModeSwitch({ mode, onChange }: { mode: ComposerMode; onChange: (mode: ComposerMode) => void }) {
  const t = useTranslations("crmMessage.composer");
  return (
    <div role="radiogroup" aria-label={t("mode")} className="flex items-center gap-1 px-3 pt-2">
      {MODES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={mode === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-full px-2.5 py-1 text-2xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mode === option ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {t(option)}
        </button>
      ))}
    </div>
  );
}
