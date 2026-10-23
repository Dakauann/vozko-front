"use client";

import { useTranslations } from "next-intl";

import { Receipt } from "@/components/icons";
import { useCarrierErrorText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import { useMicrosMoney } from "@/lib/carrier-messaging/use-micros-money";

import { CheckPill } from "./CheckPill";
import type { RcsContentCheckState } from "./use-rcs-content-check";

export function RcsPricePill({ state }: { state: RcsContentCheckState }) {
  const t = useTranslations("rcs");
  const money = useMicrosMoney(state.status !== "idle");
  const errorText = useCarrierErrorText();
  const { status, check, error, retry } = state;
  const kind = check ? t(`billingClass.${check.billing_class}`) : null;
  const price = check ? money(check.price.total_micros) : null;
  const label = kind && price ? t("composer.check.summary", { kind, price }) : kind;
  return (
    <CheckPill
      status={status}
      label={label}
      icon={<Receipt aria-hidden className="h-3 w-3 text-muted-foreground" />}
      failure={errorText(error?.code)}
      onRetry={retry}
    />
  );
}
