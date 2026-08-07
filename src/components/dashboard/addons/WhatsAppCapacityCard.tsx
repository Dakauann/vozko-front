"use client";

import * as React from "react";

import { CheckCircle, PuzzlePiece, WarningCircle } from "@/components/icons";
import { ChannelTile } from "@/components/channels/channel-tile";
import { motion, useReducedMotion } from "framer-motion";

import Button from "@/components/elevated-design/button";
import type { WhatsAppCapacity } from "@/hooks/use-whatsapp-capacity";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/**
 * The shape the meter needs, independent of which channel supplies it.
 *
 * Narrower than WhatsAppCapacity on purpose: the official channel's value
 * carries onboarding-path detail this card never reads, and the unofficial one
 * has no such concept at all. Both satisfy this.
 */
export interface CapacitySnapshot {
  loading: boolean;
  used: number;
  total: number;
  /** The allowance that came with the plan or the platform grant. */
  planBase: number;
  /** Units bought as add-ons. */
  addonUnits: number;
  remaining: number;
  hasPlan: boolean;
  atLimit: boolean;
}

/** The strings the card renders, resolved by the caller from its own namespace. */
export interface CapacityLabels {
  label: string;
  breakdown: string;
  remaining: string;
  full: string;
  fullHint: string;
  noPlan: string;
  noPlanHint: string;
  buyMore: string;
  manage: string;
}

const ADDONS_HREF = "/dashboard/addons";
/** Above this, individual slot pips stop being legible; fall back to a bar. */
const MAX_PIPS = 20;

type CapacityState = "healthy" | "atLimit" | "noPlan";

function resolveState(capacity: CapacitySnapshot): CapacityState {
  if (!capacity.hasPlan) return "noPlan";
  if (capacity.atLimit) return "atLimit";
  return "healthy";
}

/**
 * WhatsAppCapacityCard renders the workspace's WhatsApp number allowance as a
 * calm, instrument-grade meter: one filled pip per number in use, empty pips for
 * free slots, and a context-aware call to action. When every slot is taken it
 * becomes the gate that routes the operator to buy more capacity.
 *
 * Purely presentational: pass the resolved value from `useWhatsAppCapacity`.
 */
export function CapacityCard({
  capacity,
  labels,
  channel = "whatsapp",
  className,
  variant = "card",
}: {
  capacity: CapacitySnapshot;
  labels: CapacityLabels;
  /**
   * Which channel's plate and mark to wear. The meter, the states and the
   * calls to action are identical across channels — only the lockup and the
   * words differ — so a second copy of this file would be a second place for
   * the at-limit behaviour to drift.
   */
  channel?: string;
  className?: string;
  variant?: "card" | "bare";
}) {
  const reduceMotion = useReducedMotion();
  const t = labels;

  const shell = cn(
    variant === "card" && "rounded-lg border border-border bg-card p-5 shadow-sm",
    className,
  );

  if (capacity.loading) {
    return (
      <section className={shell} aria-busy="true" aria-label={t.label}>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-muted" />
      </section>
    );
  }

  const state = resolveState(capacity);
  const { used, total, planBase, addonUnits, remaining } = capacity;
  const isBlocked = state !== "healthy";

  return (
    <section className={shell} aria-label={t.label}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {/* The product's own channel lockup, not a hand-built box.
              Reaching for ChannelLogo here rendered the unofficial mark, which
              carries its own `text-muted-foreground` — grey on the graphite
              plate, which is nearly invisible. ChannelTile pairs each plate with
              the white glyph it was designed for, and it is the same lockup the
              inbox and the sidebar use. */}
          <ChannelTile channel={channel} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              {t.label}
            </p>
            <p className="mt-0.5 text-xl font-semibold leading-none tracking-tight text-foreground">
              <span className="tabular-nums">{used}</span>
              {capacity.hasPlan && (
                <span className="font-normal text-muted-foreground">
                  {" / "}
                  <span className="tabular-nums">{total}</span>
                </span>
              )}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t.breakdown}
            </p>
          </div>
        </div>

        <Button
          link={ADDONS_HREF}
          newTab={false}
          variant={isBlocked ? "primary" : "outline"}
          size="sm"
          title={isBlocked ? t.buyMore : t.manage}
          icon={<PuzzlePiece className="h-4 w-4" weight="bold" />}
          iconVisible
          iconSide="left"
        />
      </div>

      <CapacityMeter
        used={used}
        total={total}
        state={state}
        reduceMotion={Boolean(reduceMotion)}
        label={t.label}
      />

      <StateHint
        state={state}
        healthyLabel={t.remaining}
        fullLabel={t.full}
        fullHint={t.fullHint}
        noPlanLabel={t.noPlan}
        noPlanHint={t.noPlanHint}
      />
    </section>
  );
}

function CapacityMeter({
  used,
  total,
  state,
  reduceMotion,
  label,
}: {
  used: number;
  total: number;
  state: CapacityState;
  reduceMotion: boolean;
  label: string;
}) {
  const fillClass = state === "atLimit" ? "bg-warning" : "bg-healthy";

  // No allowance: a single muted track communicates "nothing to fill yet".
  if (state === "noPlan") {
    return (
      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={Math.max(used, 1)}
      />
    );
  }

  // Small allowances read best as discrete slots: one pip per number.
  if (total <= MAX_PIPS) {
    const filled = Math.min(used, total);
    return (
      <div
        className="mt-4 flex gap-1.5"
        role="meter"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        {Array.from({ length: total }).map((_, i) => {
          const isFilled = i < filled;
          return (
            <motion.span
              key={i}
              className={cn(
                "h-2 flex-1 rounded-full",
                isFilled ? fillClass : "bg-muted ring-1 ring-inset ring-border",
              )}
              initial={
                reduceMotion ? false : { scaleX: isFilled ? 0 : 1, opacity: isFilled ? 0 : 1 }
              }
              animate={{ scaleX: 1, opacity: 1 }}
              style={{ originX: 0 }}
              transition={{
                duration: 0.35,
                ease: [0.22, 1, 0.36, 1],
                delay: reduceMotion ? 0 : i * 0.03,
              }}
            />
          );
        })}
      </div>
    );
  }

  // Large allowances: a continuous meter is cleaner than 40 hairline pips.
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div
      className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
      role="meter"
      aria-label={label}
      aria-valuenow={used}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <motion.div
        className={cn("h-full rounded-full", fillClass)}
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function StateHint({
  state,
  healthyLabel,
  fullLabel,
  fullHint,
  noPlanLabel,
  noPlanHint,
}: {
  state: CapacityState;
  healthyLabel: string;
  fullLabel: string;
  fullHint: string;
  noPlanLabel: string;
  noPlanHint: string;
}) {
  if (state === "atLimit") {
    return (
      <p className="mt-3 flex items-start gap-1.5 text-xs text-warning-ink">
        <WarningCircle
          className="mt-px h-4 w-4 shrink-0 text-warning-ink"
          weight="fill"
          aria-hidden
        />
        <span>
          <span className="font-semibold">{fullLabel}.</span>{" "}
          <span className="text-muted-foreground">{fullHint}</span>
        </span>
      </p>
    );
  }

  if (state === "noPlan") {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{noPlanLabel}.</span>{" "}
        {noPlanHint}
      </p>
    );
  }

  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
      <CheckCircle
        className="h-4 w-4 shrink-0 text-healthy-ink"
        weight="fill"
        aria-hidden
      />
      <span>{healthyLabel}</span>
    </p>
  );
}

/**
 * The official channel's capacity meter.
 *
 * A thin wrapper: it resolves this channel's strings and hands the generic card
 * a snapshot. The meter, the pips, the at-limit gate and the call to action all
 * live in CapacityCard, so the unofficial channel cannot drift from it.
 */
export default function WhatsAppCapacityCard({
  capacity,
  className,
  variant = "card",
}: {
  capacity: WhatsAppCapacity;
  className?: string;
  variant?: "card" | "bare";
}) {
  const t = useTranslations("whatsappBusinessPhones");
  return (
    <CapacityCard
      capacity={capacity}
      channel="whatsapp"
      className={className}
      variant={variant}
      labels={{
        label: t("capacity.label"),
        breakdown: t("capacity.breakdown", {
          planBase: capacity.planBase,
          addonUnits: capacity.addonUnits,
        }),
        remaining: t("capacity.remaining", { count: capacity.remaining }),
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
