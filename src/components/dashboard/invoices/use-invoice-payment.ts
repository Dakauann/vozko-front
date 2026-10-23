"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getInvoiceAction, renewInvoicePixAction } from "@/app/actions/invoices";
import type { CodedError } from "@/lib/api/coded-error";
import type { Invoice } from "@/lib/invoices/types";

export const INVOICE_PAYMENT_POLL_MS = 5000;

const STATE_CHANGING_CODES = new Set(["invoice_already_paid", "invoice_not_payable", "invoice_not_found"]);

export function awaitsPayment(invoice: Invoice | null | undefined): boolean {
  const state = invoice?.payment?.state;
  return state === "OPEN" || state === "RENEWABLE";
}

export function useInvoicePayment({
  invoice,
  open,
  onChange,
}: {
  invoice: Invoice | null;
  open: boolean;
  onChange: (invoice: Invoice) => void;
}) {
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ invoiceId: string; error: CodedError } | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const invoiceId = invoice?.id ?? null;
  const watching = open && awaitsPayment(invoice);
  const renewing = invoiceId !== null && renewingId === invoiceId;

  const refresh = useCallback(async () => {
    if (!invoiceId) return;
    const result = await getInvoiceAction(invoiceId);
    if (result.data) onChangeRef.current(result.data);
  }, [invoiceId]);

  useEffect(() => {
    if (!watching) return;
    const interval = window.setInterval(() => void refresh(), INVOICE_PAYMENT_POLL_MS);
    const onFocus = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [watching, refresh]);

  const renew = useCallback(async () => {
    if (!invoiceId || renewing) return;
    setRenewingId(invoiceId);
    setFailure(null);
    const result = await renewInvoicePixAction(invoiceId);
    setRenewingId(null);
    if (result.data) {
      onChangeRef.current(result.data);
      return;
    }
    if (result.error) {
      setFailure({ invoiceId, error: result.error });
      if (result.error.code && STATE_CHANGING_CODES.has(result.error.code)) void refresh();
    }
  }, [invoiceId, renewing, refresh]);

  const renewError = failure && failure.invoiceId === invoiceId ? failure.error : null;

  return { renew, renewing, renewError };
}
