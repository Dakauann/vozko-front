"use client";

import NextImage from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { fetchMediaFileAction } from "@/app/actions/medias";
import { CalendarBlank, CaretDown, Eye, Image as ImageIcon, Paperclip, Plus, WarningCircle, X } from "@/components/icons";
import { findFieldBlock } from "@/lib/whatsapp-forms/document-edit";
import type { Block, Display, Document, Field, Screen } from "@/lib/whatsapp-forms/types";
import { cn } from "@/lib/utils";

interface PhonePreviewProps {
  document: Document;
  screen: Screen;
  selectedBlock?: string | null;
  flagged?: ReadonlySet<string>;
  onSelectBlock?: (blockKey: string) => void;
  onInsertAt?: (index: number) => void;
  className?: string;
}

function MediaImage({ mediaId, alt }: { mediaId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let created: string | null = null;
    let cancelled = false;
    fetchMediaFileAction(mediaId).then(({ data }) => {
      if (cancelled || !data) return;
      created = URL.createObjectURL(data.blob);
      setUrl(created);
    });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [mediaId]);
  if (!url) return <ImagePlaceholder label={alt} />;
  return <NextImage src={url} alt={alt} width={320} height={192} unoptimized className="max-h-48 w-full rounded-lg object-cover" />;
}

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div role="img" aria-label={label} className="flex h-32 w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <ImageIcon className="h-6 w-6" />
    </div>
  );
}

function DisplayView({ display }: { display: Display }) {
  const t = useTranslations("whatsappForms.builder.preview");
  const text = display.text ?? "";
  switch (display.kind) {
    case "heading":
      return <h2 className="text-lg font-bold leading-snug text-foreground">{text}</h2>;
    case "subheading":
      return <h3 className="text-base font-semibold leading-snug text-foreground">{text}</h3>;
    case "paragraph":
      return <p className="whitespace-pre-line text-sm text-foreground">{text}</p>;
    case "caption":
      return <p className="whitespace-pre-line text-xs text-muted-foreground">{text}</p>;
    case "image":
      return display.mediaId ? <MediaImage mediaId={display.mediaId} alt={t("image")} /> : <ImagePlaceholder label={t("image")} />;
    case "link":
      return <span className="text-sm font-medium text-info-ink underline underline-offset-2">{text}</span>;
  }
}

function InputBox({ label, help, optional, tall, trailing }: { label: string; help?: string; optional: boolean; tall?: boolean; trailing?: ReactNode }) {
  const t = useTranslations("whatsappForms.builder.preview");
  return (
    <div className="space-y-1">
      <div className={cn("flex items-start justify-between gap-2 rounded-lg border border-border-strong bg-card px-3 py-2.5", tall && "min-h-20")}>
        <span className="text-sm text-muted-foreground">{label}</span>
        {trailing}
      </div>
      {help || optional ? (
        <p className="px-1 text-xs text-muted-foreground">{[optional ? t("optional") : "", help ?? ""].filter(Boolean).join(" · ")}</p>
      ) : null}
    </div>
  );
}

function OptionList({ field, mark }: { field: Field; mark: "radio" | "checkbox" }) {
  return (
    <ul className="divide-y divide-border">
      {(field.options ?? []).map((option) => (
        <li key={option.id} className="flex items-start justify-between gap-3 py-2">
          <span className="min-w-0">
            <span className="block text-sm text-foreground">{option.title}</span>
            {option.description ? <span className="block text-xs text-muted-foreground">{option.description}</span> : null}
          </span>
          <span aria-hidden className={cn("mt-0.5 h-5 w-5 shrink-0 border-2 border-border-strong", mark === "radio" ? "rounded-full" : "rounded")} />
        </li>
      ))}
    </ul>
  );
}

function GroupLabel({ field }: { field: Field }) {
  const t = useTranslations("whatsappForms.builder.preview");
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-semibold text-foreground">{field.label}</p>
      {field.help || !field.required ? (
        <p className="text-xs text-muted-foreground">{[!field.required ? t("optional") : "", field.help ?? ""].filter(Boolean).join(" · ")}</p>
      ) : null}
    </div>
  );
}

function FieldView({ field }: { field: Field }) {
  const t = useTranslations("whatsappForms.builder.preview");
  const optional = !field.required;
  const body = (() => {
    switch (field.kind) {
      case "short_text":
      case "email":
      case "phone":
      case "number":
        return <InputBox label={field.label} help={field.help} optional={optional} />;
      case "long_text":
        return <InputBox label={field.label} help={field.help} optional={optional} tall />;
      case "single_choice_dropdown":
        return <InputBox label={field.label} help={field.help} optional={optional} trailing={<CaretDown className="h-4 w-4 text-muted-foreground" />} />;
      case "date":
        return <InputBox label={field.label} help={field.help} optional={optional} trailing={<CalendarBlank className="h-4 w-4 text-muted-foreground" />} />;
      case "date_range":
        return (
          <div className="space-y-2">
            <GroupLabel field={field} />
            <div className="grid grid-cols-2 gap-2">
              <InputBox label={t("start")} optional={false} trailing={<CalendarBlank className="h-4 w-4 text-muted-foreground" />} />
              <InputBox label={t("end")} optional={false} trailing={<CalendarBlank className="h-4 w-4 text-muted-foreground" />} />
            </div>
          </div>
        );
      case "single_choice_radio":
        return (
          <div className="space-y-1">
            <GroupLabel field={field} />
            <OptionList field={field} mark="radio" />
          </div>
        );
      case "multi_choice_checkbox":
        return (
          <div className="space-y-1">
            <GroupLabel field={field} />
            <OptionList field={field} mark="checkbox" />
          </div>
        );
      case "multi_choice_chips":
        return (
          <div className="space-y-2">
            <GroupLabel field={field} />
            <ul className="flex flex-wrap gap-2">
              {(field.options ?? []).map((option) => (
                <li key={option.id} className="rounded-full border border-border-strong px-3 py-1 text-sm text-foreground">
                  {option.title}
                </li>
              ))}
            </ul>
          </div>
        );
      case "opt_in":
        return (
          <div className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 border-border-strong" />
            <span className="min-w-0 text-sm text-foreground">
              {field.label}
              {field.termsUrl ? <span className="ml-1 font-medium text-info-ink underline underline-offset-2">{t("readMore")}</span> : null}
            </span>
          </div>
        );
      case "photo":
      case "document":
        return (
          <div className="space-y-2">
            <GroupLabel field={field} />
            <span className="inline-flex items-center gap-2 rounded-full border border-border-strong px-3 py-1.5 text-sm font-medium text-info-ink">
              <Paperclip className="h-4 w-4" />
              {field.kind === "photo" ? t("photo") : t("upload")}
            </span>
          </div>
        );
    }
  })();
  return (
    <div className="space-y-2">
      {field.question ? <p className="whitespace-pre-line text-sm text-foreground">{field.question}</p> : null}
      {body}
    </div>
  );
}

function VisibilityMark({ document, block }: { document: Document; block: Block }) {
  const t = useTranslations("whatsappForms.builder.preview");
  if (!block.visibleIf) return null;
  const source = findFieldBlock(document, block.visibleIf.fieldKey)?.block.field;
  return (
    <span className="mb-1 inline-flex items-center gap-1 text-2xs text-muted-foreground">
      <Eye className="h-3 w-3" />
      {t("conditional", { field: source?.label || block.visibleIf.fieldKey })}
    </span>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.field) return <FieldView field={block.field} />;
  if (block.display) return <DisplayView display={block.display} />;
  return null;
}

export function PhonePreview({ document, screen, selectedBlock, flagged, onSelectBlock, onInsertAt, className }: PhonePreviewProps) {
  const t = useTranslations("whatsappForms.builder.preview");
  const interactive = Boolean(onSelectBlock);

  return (
    <div className={cn("mx-auto w-full max-w-[360px] overflow-hidden rounded-[28px] border-[6px] border-foreground/85 bg-background shadow-lg", className)}>
      <form aria-label={t("label", { title: screen.title })} onSubmit={(event) => event.preventDefault()} className="flex h-[640px] flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <X className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-foreground">{screen.title}</p>
          <span className="h-4 w-4 shrink-0" aria-hidden />
        </header>
        <div className="flex-1 space-y-1 overflow-y-auto bg-card px-4 py-3">
          {screen.blocks.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p> : null}
          {screen.blocks.map((block, index) => (
            <div key={block.key}>
              {onInsertAt ? <InsertGap label={t("insert")} onClick={() => onInsertAt(index)} /> : null}
              {interactive ? (
                <button
                  type="button"
                  aria-pressed={selectedBlock === block.key}
                  onClick={() => onSelectBlock?.(block.key)}
                  className={cn(
                    "relative block w-full rounded-lg p-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
                    selectedBlock === block.key && "ring-2 ring-primary",
                  )}
                >
                  <VisibilityMark document={document} block={block} />
                  <BlockView block={block} />
                  {flagged?.has(block.key) ? (
                    <WarningCircle aria-label={t("flagged")} weight="fill" className="absolute right-1 top-1 h-4 w-4 text-destructive" />
                  ) : null}
                </button>
              ) : (
                <div className="p-2">
                  <BlockView block={block} />
                </div>
              )}
            </div>
          ))}
          {onInsertAt ? <InsertGap label={t("insert")} onClick={() => onInsertAt(screen.blocks.length)} /> : null}
        </div>
        <footer className="border-t border-border bg-card px-4 py-3">
          <span className="block w-full rounded-full bg-[hsl(var(--healthy))] py-2.5 text-center text-sm font-semibold text-healthy-foreground">
            {screen.submitLabel || " "}
          </span>
        </footer>
      </form>
    </div>
  );
}

function InsertGap({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="group flex h-4 items-center justify-center">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
      >
        <Plus className="h-3 w-3" weight="bold" />
      </button>
    </div>
  );
}
