"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { CaretDown, FileCsv, Table } from "@/components/icons";
import { useFieldSourceLabel } from "@/components/leads/sends/send-copy";
import { Notice } from "@/components/ui/notice";
import type { AudienceChannel, BindableField, ListPreview, MetadataGap, VariableColumn, VariableCount } from "@/lib/campaign-audience/types";
import { cn } from "@/lib/utils";

import { useSlotLabel } from "./use-audience-copy";

export function ListFileLine({ preview }: { preview: ListPreview }) {
  const t = useTranslations("campaignAudience.step.list");
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[--radius] border border-border px-3 py-2.5 text-sm">
      <FileCsv className="h-[18px] w-[18px] text-muted-foreground" aria-hidden />
      <span className="min-w-0">
        <b className="font-semibold text-foreground">{preview.fileName}</b>{" "}
        <span className="text-muted-foreground">· {t("lines", { count: preview.lines })}</span>
      </span>
      <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
        <span aria-hidden className="h-2 w-2 rounded-full bg-healthy" />
        {t("checked")}
      </span>
    </div>
  );
}

function ColumnLine({ column, labelOf, slotLabel }: { column: VariableColumn; labelOf: (source: string) => string; slotLabel: (key: string) => string }) {
  const t = useTranslations("campaignAudience.step.list.columns");
  const slot = slotLabel(String(column.slot));
  const what: ReactNode =
    column.fill === "column" && column.column ? (
      <>
        <span className="font-mono">{column.column}</span> {t("fills", { slot })}
      </>
    ) : (
      t(`fill.${column.fill}`, { slot })
    );
  return (
    <>
      <span className={cn("flex text-muted-foreground", column.fill === "none" && "text-warning-ink")}>
        <Table className="size-3.5" aria-hidden />
      </span>
      <span>{what}</span>
      <span className="text-right text-muted-foreground">{column.field ? labelOf(column.field) : t("free")}</span>
    </>
  );
}

export function ListColumnsNotice({ preview, fields, variables }: { preview: ListPreview; fields: readonly BindableField[]; variables: readonly VariableCount[] }) {
  const t = useTranslations("campaignAudience.step.list.columns");
  const labelOf = useFieldSourceLabel(fields);
  const slotLabel = useSlotLabel(variables);
  if (preview.columns.variables.length === 0) return null;
  return (
    <Notice tone="info" title={t("title")}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 text-[13px] text-foreground">
        {preview.columns.variables.map((column) => (
          <ColumnLine key={column.slot} column={column} labelOf={labelOf} slotLabel={slotLabel} />
        ))}
      </div>
      <p>{t("fillHint")}</p>
    </Notice>
  );
}

export function SkippedLinesNotice({ preview }: { preview: ListPreview }) {
  const t = useTranslations("campaignAudience.step.list.skipped");
  const [open, setOpen] = useState(false);
  const { total, lines } = preview.skipped;
  if (total === 0) return null;
  return (
    <Notice tone="warning">
      <button type="button" aria-expanded={open} className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(!open)}>
        <span className="flex-1 text-sm font-semibold text-foreground">{t(open ? "titleOpen" : "titleClosed", { count: total })}</span>
        <CaretDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="space-y-1.5">
          <ul className="max-h-60 space-y-1.5 overflow-y-auto">
            {lines.map((line) => (
              <li key={`${line.line}-${line.reason}`} className="flex flex-wrap items-baseline gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground">
                <b className="font-semibold">{t("line", { line: line.line })}</b>
                <span className="break-all font-mono text-muted-foreground">{line.raw}</span>
                <span className="ml-auto font-medium">{t.has(`reasons.${line.reason}`) ? t(`reasons.${line.reason}`, { line: line.duplicateOf ?? 0 }) : t("reasons.other")}</span>
              </li>
            ))}
          </ul>
          {lines.length < total ? <p>{t("shown", { shown: lines.length, total })}</p> : null}
        </div>
      ) : null}
    </Notice>
  );
}

export function ListMetadataNotice({ gaps }: { gaps: readonly MetadataGap[] }) {
  const t = useTranslations("campaignAudience.step.list.metadataMissing");
  const [open, setOpen] = useState(false);
  if (gaps.length === 0) return null;
  const partial = gaps.some((gap) => gap.lines.length < gap.missing);
  return (
    <Notice tone="warning">
      <button type="button" aria-expanded={open} className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(!open)}>
        <span className="flex-1 text-sm font-semibold text-foreground">{t(open ? "titleOpen" : "titleClosed", { count: gaps.length })}</span>
        <CaretDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="space-y-1.5">
          <ul className="max-h-60 space-y-1.5 overflow-y-auto">
            {gaps.map((gap) => (
              <li key={gap.key} className="flex flex-wrap items-baseline gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground">
                <b className="font-mono font-semibold">{gap.key}</b>
                <span className="text-muted-foreground">{t("line", { count: gap.missing })}</span>
                {gap.lines.length > 0 ? <span className="ml-auto font-medium">{t("lines", { count: gap.lines.length, lines: gap.lines.join(", ") })}</span> : null}
              </li>
            ))}
          </ul>
          {partial ? <p>{t("partial")}</p> : null}
        </div>
      ) : null}
      <p>{t("hint")}</p>
    </Notice>
  );
}

export function ListMatchingNotice({ preview, channel }: { preview: ListPreview; channel: AudienceChannel }) {
  const t = useTranslations("campaignAudience.step.list");
  const locale = useLocale();
  const format = (value: number) => value.toLocaleString(locale);
  return (
    <Notice tone="info">
      <p>
        {t.rich(channel === "email" ? "matchingEmail" : "matching", {
          rows: preview.rows,
          existing: format(preview.existing),
          created: format(preview.new),
          b: (chunks) => <b className="text-foreground">{chunks}</b>,
        })}
      </p>
    </Notice>
  );
}

export function ListMissingNotice({ variables, onShow }: { variables: readonly VariableCount[]; onShow: () => void }) {
  const t = useTranslations("campaignAudience.step.list.missing");
  const slotLabel = useSlotLabel(variables);
  const missing = variables.filter((variable) => variable.missing > 0);
  if (missing.length === 0) return null;
  return (
    <Notice tone="warning" title={t("title")}>
      <ul className="space-y-1.5 text-foreground">
        {missing.map((variable) => (
          <li key={variable.key}>
            <span className="font-mono font-semibold">{slotLabel(variable.key)}</span> · {t("line", { count: variable.missing })}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onShow} className="text-xs font-medium text-foreground underline hover:text-muted-foreground">
        {t("show")}
      </button>
    </Notice>
  );
}
