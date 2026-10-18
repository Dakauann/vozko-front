"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { Sparkle } from "@/components/icons";
import { MediaModelSelect } from "@/components/media-generation/media-model-select";
import { ELEMENT_PROMPT_LIMIT, ELEMENT_STYLES, elementPrompt, type ElementStyle } from "@/lib/studio/library/element-prompt";
import { cn } from "@/lib/utils";

import { FIELD_CLASS, OUTLINE_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "../image/controls";
import { LIBRARY_CATEGORIES } from "./registry";

interface ElementGeneratorProps {
  style: ElementStyle;
  blocked: boolean;
  onGenerate: (prompt: string, model: string) => void;
  children?: ReactNode;
}

export function ElementGenerator({ style: initialStyle, blocked, onGenerate, children }: ElementGeneratorProps) {
  const t = useTranslations("studio.library.generate");
  const promptId = useId();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<ElementStyle>(initialStyle);
  const [model, setModel] = useState<string | null>(null);
  const prompt = elementPrompt(description, style);
  const ready = Boolean(prompt && model) && !blocked;

  if (!open) {
    return (
      <div className="space-y-2">
        <button type="button" className={cn(OUTLINE_BUTTON_CLASS, "h-8 w-full")} onClick={() => setOpen(true)}>
          <Sparkle className="h-3.5 w-3.5" aria-hidden />
          {t("open")}
        </button>
        {children}
      </div>
    );
  }

  return (
    <form
      aria-label={t("title")}
      className="space-y-2.5 rounded-[--radius] border border-border p-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || !prompt || !model) return;
        onGenerate(prompt, model);
        setDescription("");
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-foreground">{t("title")}</h4>
        <button type="button" onClick={() => setOpen(false)} className="rounded-[--radius] px-1.5 py-0.5 text-2xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t("close")}
        </button>
      </div>
      <p className="text-2xs leading-snug text-muted-foreground">{t("hint")}</p>
      <div className="space-y-1">
        <label htmlFor={promptId} className="block text-2xs text-muted-foreground">
          {t("prompt")}
        </label>
        <textarea id={promptId} value={description} maxLength={ELEMENT_PROMPT_LIMIT} rows={3} placeholder={t("placeholder")} onChange={(event) => setDescription(event.target.value)} className={cn(FIELD_CLASS, "h-auto resize-y py-1.5 leading-snug")} />
      </div>
      <div className="space-y-1">
        <span className="block text-2xs text-muted-foreground">{t("style")}</span>
        <ElevatedPillToggle<ElementStyle> aria-label={t("style")} size="sm" value={style} onChange={setStyle} options={ELEMENT_STYLES.map((value) => ({ value, label: t(`styles.${value}`) }))} />
      </div>
      <MediaModelSelect kind="image" value={model} onChange={setModel} />
      <p className="text-2xs text-muted-foreground">{t("costNote")}</p>
      <button type="submit" disabled={!ready} className={cn(PRIMARY_BUTTON_CLASS, "h-8 w-full")}>
        <Sparkle className="h-4 w-4" aria-hidden />
        {t("run")}
      </button>
      {blocked ? <p className="text-2xs text-muted-foreground">{t("blocked")}</p> : null}
      {children}
    </form>
  );
}

export function generatesElements(categoryId: string): boolean {
  return LIBRARY_CATEGORIES.some((category) => category.id === categoryId && category.generates === "element");
}
