"use client";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import type { UnofficialWhatsAppInstance } from "@/lib/unofficial-whatsapp/types";
import { useTranslations } from "next-intl";

/**
 * Pacing and daily cap.
 *
 * This panel has no counterpart on the official channel and is not a settings
 * nicety: on a linked-device session a constant cadence is the most legible
 * automation signature there is, and the cost of looking automated is the
 * customer losing their WhatsApp number.
 *
 * Two rules are surfaced rather than hidden, because an operator who does not
 * understand them will "fix" the campaign by making it faster:
 *
 *  - a campaign may be SLOWER than its number, never faster;
 *  - the effective daily cap is the LOWER of the campaign's and the number's,
 *    and a new number's cap ramps over its first weeks.
 */
export function CampaignPacingPanel({
  minMs,
  maxMs,
  dailyCap,
  instance,
  onChange,
  disabled,
}: {
  minMs: number;
  maxMs: number;
  dailyCap: number;
  instance?: UnofficialWhatsAppInstance | null;
  onChange: (patch: { minMs?: number; maxMs?: number; dailyCap?: number }) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("unofficialWhatsappCampaigns");

  const instanceMin = instance?.sendDelayMinMs ?? 0;
  const instanceCap = instance?.dailySendCap ?? 0;
  const warming = Boolean(instance?.warmupStartedAt);

  // The effective cap, computed the same way the backend does, so the number on
  // screen is the number that will actually be enforced.
  const effectiveCap =
    dailyCap > 0 && instanceCap > 0
      ? Math.min(dailyCap, instanceCap)
      : dailyCap > 0
        ? dailyCap
        : instanceCap;

  const tooFast = instanceMin > 0 && minMs < instanceMin;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{t("form.pacingTitle")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("form.pacingHelp")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ElevatedInput
          type="number"
          label={t("form.delayMin")}
          value={String(minMs)}
          onChange={(e) => onChange({ minMs: Number(e.target.value) })}
          disabled={disabled}
          controlSize="sm"
        />
        <ElevatedInput
          type="number"
          label={t("form.delayMax")}
          value={String(maxMs)}
          onChange={(e) => onChange({ maxMs: Number(e.target.value) })}
          disabled={disabled}
          controlSize="sm"
        />
        <ElevatedInput
          type="number"
          label={t("form.dailyCap")}
          value={String(dailyCap)}
          onChange={(e) => onChange({ dailyCap: Number(e.target.value) })}
          disabled={disabled}
          controlSize="sm"
        />
      </div>

      {tooFast ? (
        <p className="text-xs font-semibold text-warning-ink">
          {t("form.pacingClamped", { min: instanceMin })}
        </p>
      ) : null}

      {effectiveCap > 0 ? (
        <p className="text-xs text-muted-foreground">
          {warming
            ? t("form.effectiveCapWarmup", { cap: effectiveCap })
            : t("form.effectiveCap", { cap: effectiveCap })}
        </p>
      ) : null}
    </div>
  );
}
