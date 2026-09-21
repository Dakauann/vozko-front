"use client";

import * as React from "react";

import {
  CapacityCard,
  type CapacitySnapshot,
} from "@/components/dashboard/addons/WhatsAppCapacityCard";
import type { UnofficialWhatsAppAllowance } from "@/lib/unofficial-whatsapp/types";
import { useTranslations } from "next-intl";

export default function UnofficialWhatsAppCapacityCard({
  allowance,
  className,
  variant = "card",
}: {
  allowance: UnofficialWhatsAppAllowance | null;
  className?: string;
  variant?: "card" | "bare";
}) {
  const t = useTranslations("unofficialWhatsapp");

  const snapshot: CapacitySnapshot = React.useMemo(
    () => ({
      loading: allowance === null,
      used: allowance?.used ?? 0,
      total: allowance?.limit ?? 0,
      planBase: allowance?.granted ?? 0,
      addonUnits: allowance?.purchased ?? 0,
      remaining: allowance?.remaining ?? 0,
      hasPlan: (allowance?.limit ?? 0) > 0,
      atLimit: Boolean(allowance && !allowance.canConnect && allowance.limit > 0),
    }),
    [allowance],
  );

  return (
    <CapacityCard
      capacity={snapshot}
      channel="unofficial_whatsapp"
      className={className}
      variant={variant}
      labels={{
        label: t("capacity.label"),
        breakdown: t("capacity.breakdown", {
          planBase: snapshot.planBase,
          addonUnits: snapshot.addonUnits,
        }),
        remaining: t("capacity.remaining", { count: snapshot.remaining }),
        full: t("capacity.full"),
        fullHint: t("capacity.fullHint"),
        noPlan: t("capacity.noPlan"),
        noPlanHint: t("capacity.noPlanHint"),
        buyMore: t("capacity.buyMore"),
        manage: t("capacity.manage"),
      }}
    />
  );
}
