"use client";

import { ArrowDown, ArrowsLeftRight, CalendarBlank, Receipt } from "@/components/icons";
import { useLocale, useTranslations } from "next-intl";

import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import type { Invoice, InvoiceLineItem } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

type Translate = ReturnType<typeof useTranslations<"invoicesPage">>;

/** A channel line's label is an addon key (e.g. whatsapp_channel); localize it, else show the raw label. */
function lineLabel(item: InvoiceLineItem, t: Translate): string {
  if (item.kind === "PLAN") return item.label;
  const key = `lineItems.channelLabels.${item.label}` as Parameters<Translate>[0];
  return t.has(key) ? t(key) : item.label;
}

export function InvoiceDetailDialog({
  invoice,
  open,
  onClose,
}: {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("invoicesPage");
  const locale = useLocale();

  if (!invoice) return null;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const lineItems = invoice.lineItems ?? [];
  const hasBreakdown = lineItems.length > 0;
  const creditedBRL = lineItems
    .filter((i) => i.creditable)
    .reduce((sum, i) => sum + i.amountBRL, 0);

  return (
    <ElevatedDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
              <Receipt className="h-4 w-4" weight="fill" />
            </span>
            {t("detail.title")}
          </ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {invoice.purpose === "MONTHLY_BILLING"
              ? t("detail.monthlyDescription")
              : t("detail.genericDescription")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="space-y-4">
          {invoice.dueDate ? (
            <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-3 py-2 text-sm">
              <CalendarBlank className="h-4 w-4 text-lamp-ink" weight="bold" />
              <span className="text-muted-foreground">{t("detail.dueDate")}</span>
              <span className="ml-auto font-medium text-foreground">
                {dateFmt.format(new Date(invoice.dueDate))}
              </span>
            </div>
          ) : null}

          {hasBreakdown ? (
            <div className="overflow-hidden rounded-[--radius] border border-border">
              <div className="border-b border-border bg-muted px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("detail.breakdown")}
              </div>
              <ul className="divide-y divide-border/40">
                {lineItems.map((item, idx) => (
                  <li
                    key={`${item.kind}-${item.label}-${idx}`}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {lineLabel(item, t)}
                        {item.quantity && item.quantity > 1 ? (
                          <span className="ml-1 text-muted-foreground">
                            ×{item.quantity}
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-[--radius] px-1.5 py-0.5 text-[10px] font-medium",
                            item.creditable
                              ? "bg-healthy/10 text-healthy"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {item.creditable ? (
                            <ArrowDown className="h-2.5 w-2.5" weight="bold" />
                          ) : (
                            <ArrowsLeftRight className="h-2.5 w-2.5" weight="bold" />
                          )}
                          {item.creditable
                            ? t("detail.creditedTag")
                            : t("detail.passthroughTag")}
                        </span>
                        {item.prorated ? (
                          <span className="inline-flex items-center rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                            {t("detail.proratedTag")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                      {formatBRL(item.amountBRL)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-border bg-muted px-3 py-2.5">
                <span className="text-sm font-semibold text-foreground">
                  {t("detail.total")}
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatBRL(invoice.amountBRL)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-[--radius] border border-border bg-muted px-3 py-3">
              <span className="text-sm font-semibold text-foreground">
                {t("detail.total")}
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {formatBRL(invoice.amountBRL)}
              </span>
            </div>
          )}

          {creditedBRL > 0 ? (
            <p className="flex items-start gap-2 rounded-[--radius] bg-healthy/5 px-3 py-2.5 text-xs text-healthy">
              <ArrowDown className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="bold" />
              <span>
                {t("detail.saldoNote", { amount: formatBRL(creditedBRL) })}
              </span>
            </p>
          ) : null}

          {invoice.purpose === "MONTHLY_BILLING" &&
          lineItems.some((i) => !i.creditable) ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("detail.passthroughNote")}
            </p>
          ) : null}
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
