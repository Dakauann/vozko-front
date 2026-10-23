"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { BracketsCurly } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MAX_FALLBACK_RUNES } from "@/lib/email-design/limits";
import { formatMergeTag, mergeTagCatalog, type CustomField, type MergeTagOption } from "@/lib/email-design/merge-tags";
import { cn } from "@/lib/utils";

interface MergeTagMenuProps {
  customFields?: readonly CustomField[];
  onPick: (text: string) => void;
  onOpenChange?: (open: boolean) => void;
  trigger?: (props: { label: string }) => ReactNode;
  disabled?: boolean;
  align?: "start" | "center" | "end";
}

export function MergeTagMenu({ customFields = [], onPick, onOpenChange, trigger, disabled, align = "end" }: MergeTagMenuProps) {
  const t = useTranslations("emailEditor.mergeTags");
  const [open, setOpen] = useState(false);
  const [fallback, setFallback] = useState("");
  const catalog = mergeTagCatalog(customFields);
  const contact = catalog.filter((option) => option.group === "contact");
  const fields = catalog.filter((option) => option.group === "field");
  const label = t("insert");

  const change = (next: boolean) => {
    setOpen(next);
    if (!next) setFallback("");
    onOpenChange?.(next);
  };

  const pick = (option: MergeTagOption) => {
    onPick(formatMergeTag(option.tag, fallback));
    change(false);
  };

  const optionLabel = (option: MergeTagOption) => (option.group === "contact" ? t(`tags.${option.tag}`) : option.label);

  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger ? (
          trigger({ label })
        ) : (
          <button
            type="button"
            aria-label={label}
            className="inline-flex h-7 items-center gap-1.5 rounded-[--radius] px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
          >
            <BracketsCurly className="h-3.5 w-3.5" />
            {t("short")}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-0" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="border-b border-border px-3 pb-3 pt-3">
          <p className="text-sm font-semibold text-foreground">{t("title")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("description")}</p>
          <ElevatedInput
            className="mt-3"
            controlSize="sm"
            label={t("fallback")}
            value={fallback}
            maxLength={MAX_FALLBACK_RUNES}
            onChange={(event) => setFallback(event.target.value)}
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          <TagGroup title={t("contactGroup")} options={contact} label={optionLabel} onPick={pick} />
          {fields.length > 0 ? <TagGroup title={t("fieldGroup")} options={fields} label={optionLabel} onPick={pick} /> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TagGroup({ title, options, label, onPick }: { title: string; options: MergeTagOption[]; label: (option: MergeTagOption) => string; onPick: (option: MergeTagOption) => void }) {
  return (
    <div role="group" aria-label={title} className="py-1">
      <p className="legend px-2 pb-1">{title}</p>
      {options.map((option) => (
        <button
          key={option.tag}
          type="button"
          onClick={() => onPick(option)}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-[--radius] px-2 py-1.5 text-left text-sm text-foreground transition-colors",
            "hover:bg-[hsl(var(--accent-hover))] focus-visible:bg-[hsl(var(--accent-hover))] focus-visible:outline-none",
          )}
        >
          <span className="min-w-0 truncate">{label(option)}</span>
          <code className="shrink-0 rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">{option.tag}</code>
        </button>
      ))}
    </div>
  );
}
