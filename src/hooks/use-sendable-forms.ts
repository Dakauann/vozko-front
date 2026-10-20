"use client";

import { useEffect, useState } from "react";

import { sendableFormsAction, type SendableQuery } from "@/app/actions/whatsapp-forms";
import type { CodedRefusal } from "@/lib/api/coded-error";
import type { SendableForm } from "@/lib/whatsapp-forms/types";

interface Loaded {
  key: string;
  forms: SendableForm[];
  error: CodedRefusal | null;
}

export function useSendableForms(query: SendableQuery | null, enabled = true) {
  const phoneId = query && "phoneId" in query ? query.phoneId : "";
  const metaWabaId = query && "metaWabaId" in query ? query.metaWabaId : "";
  const key = enabled && (phoneId || metaWabaId) ? `${phoneId}|${metaWabaId}` : "";
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const request: SendableQuery = phoneId ? { phoneId } : { metaWabaId };
    sendableFormsAction(request, controller.signal).then((answer) => {
      if (controller.signal.aborted) return;
      setLoaded({ key, forms: answer.data ?? [], error: answer.error });
    });
    return () => controller.abort();
  }, [key, phoneId, metaWabaId]);

  const current = loaded?.key === key ? loaded : null;
  return {
    forms: current?.forms ?? [],
    error: current?.error ?? null,
    loading: Boolean(key) && !current,
  };
}
