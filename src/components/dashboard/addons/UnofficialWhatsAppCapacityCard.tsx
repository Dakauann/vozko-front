"use client";

import * as React from "react";

import {
  CapacityCard,
  type CapacitySnapshot,
} from "@/components/dashboard/addons/WhatsAppCapacityCard";
import type { UnofficialWhatsAppAllowance } from "@/lib/unofficial-whatsapp/types";
import { useTranslations } from "next-intl";

/**
 * The unofficial channel's capacity meter.
 *
 * The twin of WhatsAppCapacityCard, and deliberately just as thin: both resolve
 * their own strings and delegate to the same CapacityCard, so the pips, the
 * at-limit state and the route to buy more cannot diverge between the two
 * channels. An operator who has learnt to read one has learnt to read both.
 *
 * The `planBase` it reports is the platform GRANT, not a plan field — this
 * channel's allowance is set per workspace by an administrator. The card only
 * needs to know there are two halves to name; which half came from where is the
 * server's business.
 */
export default function UnofficialWhatsAppCapacityCard({
  allowance,
  className,
  variant = "card",
}: {
  /** Null while the allowance is still loading. */
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
      // Over-limit reads as "at limit" for the meter: both mean no new number
      // can be connected, and the numbers above already tell the fuller story.
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
