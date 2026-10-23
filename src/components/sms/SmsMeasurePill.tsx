"use client";

import { useTranslations } from "next-intl";

import { ChatText } from "@/components/icons";
import { CheckPill } from "@/components/rcs/composer/CheckPill";
import { useCarrierErrorText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import { useMicrosMoney } from "@/lib/carrier-messaging/use-micros-money";

import type { SmsTextCheckState } from "./use-sms-text-check";

export function SmsMeasurePill({ state }: { state: SmsTextCheckState }) {
  const t = useTranslations("sms.measure");
  const money = useMicrosMoney(state.status !== "idle");
  const errorText = useCarrierErrorText();
  const { status, check, error, retry } = state;
  const measurement = check?.measurement;
  const summary = measurement
    ? t("summary", { encoding: t(`encodings.${measurement.encoding}`), segments: measurement.segments, remaining: measurement.remaining })
    : null;
  const price = check ? money(check.price.total_micros) : null;
  const label = summary && price ? t("withPrice", { summary, price }) : summary;
  return <CheckPill status={status} label={label} icon={<ChatText aria-hidden className="h-3 w-3 text-muted-foreground" />} failure={errorText(error?.code)} onRetry={retry} />;
}
