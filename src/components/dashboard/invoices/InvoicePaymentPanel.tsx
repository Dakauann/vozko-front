"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ArrowClockwise, Check, CheckCircle, CopySimple, PixLogo, Spinner } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { Notice } from "@/components/ui/notice";
import { codedErrorMessage, type CodedError } from "@/lib/api/coded-error";
import type { Invoice } from "@/lib/invoices/types";

const COPIED_FEEDBACK_MS = 2000;

function dateTimeFormatter(locale: string) {
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paidAtDate(paidAt: Invoice["paidAt"]): Date | null {
  return typeof paidAt === "number" && paidAt > 0 ? new Date(paidAt * 1000) : null;
}

export function InvoicePaymentPanel({
  invoice,
  renewing,
  renewError,
  onRenew,
}: {
  invoice: Invoice;
  renewing: boolean;
  renewError: CodedError | null;
  onRenew: () => void;
}) {
  const t = useTranslations("invoicesPage");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  const format = dateTimeFormatter(locale);
  const payment = invoice.payment;

  if (invoice.status === "PAID") {
    const paidAt = paidAtDate(invoice.paidAt);
    return (
      <Notice tone="healthy" icon={<CheckCircle weight="fill" />} title={t("payment.paidTitle")}>
        <p className="text-muted-foreground">
          {paidAt ? t("payment.paidAt", { date: format.format(paidAt) }) : t("payment.paidBody")}
        </p>
      </Notice>
    );
  }

  if (!payment || payment.state === "CLOSED") return null;

  const errorText = renewError ? codedErrorMessage(t, renewError, t("errors.default")) : null;
  const payableUntil = payment.payableUntil ? format.format(new Date(payment.payableUntil)) : null;

  if (payment.state === "RENEWABLE") {
    return (
      <section aria-labelledby="invoice-payment-title" className="space-y-3">
        <Notice
          tone="warning"
          title={<span id="invoice-payment-title">{t("payment.expiredTitle")}</span>}
        >
          <p className="text-muted-foreground">
            {payableUntil ? t("payment.expiredBody", { date: payableUntil }) : t("payment.expiredBodyNoDate")}
          </p>
        </Notice>
        {errorText ? (
          <Notice tone="fault">
            <p className="text-foreground">{errorText}</p>
          </Notice>
        ) : null}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={renewing || !payment.canRenew}
          onClick={onRenew}
          icon={renewing ? <Spinner className="h-4 w-4 animate-spin" /> : <ArrowClockwise className="h-4 w-4" weight="bold" />}
          iconVisible
          iconSide="left"
          title={renewing ? t("payment.renewing") : t("payment.renew")}
        />
      </section>
    );
  }

  const copyCode = async () => {
    if (!invoice.pixCopy) return;
    try {
      await navigator.clipboard.writeText(invoice.pixCopy);
    } catch {
      return;
    }
    setCopied(true);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <section aria-labelledby="invoice-payment-title" className="overflow-hidden rounded-[--radius] border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <PixLogo className="h-4 w-4 text-foreground" weight="bold" />
        <h3 id="invoice-payment-title" className="text-sm font-semibold text-foreground">
          {t("payment.title")}
        </h3>
        <span className="ml-auto inline-flex items-center gap-1.5 text-2xs font-medium text-muted-foreground" role="status">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
          {t("payment.waiting")}
        </span>
      </div>

      <div className="flex flex-col items-center gap-3 px-4 pb-4 pt-4">
        {invoice.pixQrCode ? (
          <img
            src={`data:image/png;base64,${invoice.pixQrCode}`}
            alt={t("payment.qrAlt")}
            className="h-44 w-44 rounded-[--radius] border border-border bg-white p-2"
          />
        ) : (
          <div className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-[--radius] border border-dashed border-border text-center text-muted-foreground">
            <PixLogo className="h-10 w-10" weight="duotone" />
            <span className="px-3 text-xs">{t("payment.qrUnavailable")}</span>
          </div>
        )}
        <p className="max-w-[34ch] text-center text-sm text-muted-foreground">{t("payment.scan")}</p>

        {invoice.pixCopy ? (
          <div className="flex w-full items-center gap-2 rounded-[--radius] border border-border bg-muted py-1.5 pl-3 pr-1.5">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={invoice.pixCopy}>
              {invoice.pixCopy}
            </code>
            <Button
              variant={copied ? "outline-subtle" : "secondary"}
              size="sm"
              onClick={() => void copyCode()}
              icon={copied ? <Check className="h-4 w-4 text-healthy-ink" weight="bold" /> : <CopySimple className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              title={copied ? t("payment.copied") : t("payment.copy")}
              aria-live="polite"
            />
          </div>
        ) : null}

        <dl className="grid w-full grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">{t("payment.expiresAt")}</dt>
          <dd className="text-right font-medium tabular-nums text-foreground">
            {payment.expiresAt ? format.format(new Date(payment.expiresAt)) : <EmptyValue />}
          </dd>
          {payableUntil ? (
            <>
              <dt className="text-muted-foreground">{t("payment.payableUntil")}</dt>
              <dd className="text-right font-medium tabular-nums text-foreground">{payableUntil}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </section>
  );
}
