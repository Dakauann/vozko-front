"use client";

import { useCallback } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { useMissingSlotText } from "@/components/leads/sends/send-copy";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { carrierErrorTarget, carrierRefusalDetail } from "@/lib/carrier-messaging/errors";
import { useMicrosMoney } from "@/lib/carrier-messaging/use-micros-money";
import { RCS_ERROR_CODES } from "@/lib/rcs/errors";
import { SMS_ERROR_CODES } from "@/lib/sms/errors";

const CHANNEL_CODES = { rcs: RCS_ERROR_CODES, sms: SMS_ERROR_CODES };

export function useCarrierErrorText() {
  const tRcs = useTranslations("rcs");
  const tSms = useTranslations("sms");
  const tShared = useTranslations("carrierMessaging");
  return useCallback(
    (code: string | undefined) => {
      const target = carrierErrorTarget(code, CHANNEL_CODES);
      if (target.namespace === "rcs") return tRcs(target.key);
      if (target.namespace === "sms") return tSms(target.key);
      return tShared(target.key);
    },
    [tRcs, tSms, tShared],
  );
}

export function useCarrierRefusalText() {
  const errorText = useCarrierErrorText();
  const t = useTranslations("carrierMessaging.errorDetails");
  const format = useFormatter();
  const money = useMicrosMoney();
  const missingSlot = useMissingSlotText();
  return useCallback(
    (refusal: Pick<CodedRefusal, "code" | "details"> | null | undefined) => {
      const base = errorText(refusal?.code);
      const detail = refusal ? carrierRefusalDetail(refusal) : null;
      if (detail?.kind === "missing") {
        const amount = money(detail.micros);
        return amount ? `${base} ${t("missing", { amount })}` : base;
      }
      if (detail?.kind === "nextOpen") {
        const date = new Date(detail.at);
        if (Number.isNaN(date.getTime())) return base;
        return `${base} ${t("nextOpen", { when: format.dateTime(date, { dateStyle: "short", timeStyle: "short" }) })}`;
      }
      if (detail?.kind === "missingVariable") return `${base} ${missingSlot({ slot: detail.slot, source: detail.source })}`;
      if (detail?.kind === "audienceChanged") return `${base} ${t("audienceChanged", { expected: detail.expected, matched: detail.matched })}`;
      if (detail?.kind === "notReady") return `${base} ${t(`blockers.${detail.blocker}`)}`;
      return base;
    },
    [errorText, t, format, money, missingSlot],
  );
}
