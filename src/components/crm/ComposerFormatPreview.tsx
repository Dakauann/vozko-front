"use client";

import { useTranslations } from "next-intl";

import { Eye, PencilSimple } from "@/components/icons";
import FormattedMessageText from "@/components/ui/formatted-message-text";
import { cn } from "@/lib/utils";

export function ComposerPreviewToggle({ previewing, disabled, onToggle }: { previewing: boolean; disabled: boolean; onToggle: () => void }) {
  const t = useTranslations("crmComposer");
  const label = previewing ? t("edit") : t("preview");
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={previewing}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:hover:bg-transparent",
        previewing ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {previewing ? <PencilSimple weight="bold" className="h-5 w-5" /> : <Eye weight="bold" className="h-5 w-5" />}
    </button>
  );
}

export function ComposerFormatPreview({ text }: { text: string }) {
  const t = useTranslations("crmComposer");
  return (
    <div
      role="region"
      aria-label={t("previewLabel")}
      className="max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words px-2 py-2 text-sm font-medium leading-snug text-foreground"
    >
      {text.trim() ? <FormattedMessageText>{text}</FormattedMessageText> : <span className="text-muted-foreground">{t("previewEmpty")}</span>}
    </div>
  );
}
