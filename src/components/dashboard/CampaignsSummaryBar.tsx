"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CalendarBlank, Info } from "@/components/icons";
import { format, subDays } from "date-fns";

import Button from "@/components/elevated-design/button";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { cn } from "@/lib/utils";
import type { WhatsAppCampaignMetrics } from "@/lib/whatsapp-campaigns/types";

type Preset = "all" | "7d" | "30d" | "90d" | "custom";

const PRESETS: { key: Preset; labelKey: string; days?: number }[] = [
  { key: "all", labelKey: "presetAll" },
  { key: "7d", labelKey: "preset7d", days: 7 },
  { key: "30d", labelKey: "preset30d", days: 30 },
  { key: "90d", labelKey: "preset90d", days: 90 },
  { key: "custom", labelKey: "presetCustom" },
];

type SummaryMetrics = Partial<WhatsAppCampaignMetrics>;

interface CampaignsSummaryBarProps {
  variant: "whatsapp" | "voice";
  metrics: SummaryMetrics | null;
  loading?: boolean;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear: () => void;
  /**
   * Rendered in the header row, beside the period presets. A slot rather than a
   * built-in button: this bar is shared with the voice variant, and it has no
   * business knowing what a WhatsApp lead export is.
   */
  action?: ReactNode;
}

type Tone = "default" | "danger" | "warning";

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  danger: "text-destructive-ink",
  warning: "text-warning-ink",
};

const num = (value: number | undefined) =>
  (typeof value === "number" ? value : 0).toLocaleString("pt-BR");

/** Tile caption with an optional info tooltip explaining what the number counts. */
function TileLabel({ label, help }: { label: string; help?: string }) {
  return (
    <span className="flex items-center gap-1 text-2xs font-semibold text-muted-foreground">
      {label}
      {help ? (
        <TooltipWrapper content={help} side="top">
          <Info
            className="h-3.5 w-3.5 cursor-help opacity-60 transition-opacity hover:opacity-100"
            aria-hidden
          />
        </TooltipWrapper>
      ) : null}
    </span>
  );
}

/**
 * Workspace-level rollup shown above the campaigns list. The headline metric
 * reflects the active date filter (campaign creation date); empty filter = all
 * time. WhatsApp headlines as "Envios" (billed sends); voice headlines as
 * "Chamadas conectadas" (billed connected calls). The headline is neutral (data,
 * not the action accent); failed/spam use their meaning colors like the table.
 */
export function CampaignsSummaryBar({
  variant,
  metrics,
  loading,
  from,
  to,
  onFromChange,
  onToChange,
  onClear,
  action,
}: CampaignsSummaryBarProps) {
  const t = useTranslations("campaignsSummary");
  const isVoice = variant === "voice";
  const m = metrics ?? {};

  const [preset, setPreset] = useState<Preset>(from || to ? "custom" : "all");

  const applyPreset = (next: Preset) => {
    setPreset(next);
    if (next === "all") {
      onClear();
      return;
    }
    if (next === "custom") {
      return; // keep current bounds; reveal the date pickers
    }
    const days = PRESETS.find((p) => p.key === next)?.days;
    if (days) {
      onToChange(format(new Date(), "yyyy-MM-dd"));
      onFromChange(format(subDays(new Date(), days), "yyyy-MM-dd"));
    }
  };

  let breakdown: {
    label: string;
    value: number | undefined;
    tone?: Tone;
    help?: string;
  }[];
  if (variant === "whatsapp") {
    // Delivery funnel. Each WhatsApp status is the entry's *latest* state, so the
    // buckets are disjoint and the headline "Envios" (dispatches) = in-transit +
    // delivered + read. We surface delivered/read (the bulk of the headline, and
    // already in the payload) instead of only the transient SENT bucket, shown on
    // its own as "Enviadas" it read as smaller than "Envios" and looked wrong.
    // Tooltips spell out exactly what each bucket counts.
    //
    // Plus volume by template category (Marketing / Utility / Authentication):
    // counts only, no pricing. Same current-status source as Envios.
    const by = m.byCategory;
    breakdown = [
      { label: t("delivered"), value: m.delivered, help: t("deliveredHelp") },
      { label: t("read"), value: m.read, help: t("readHelp") },
      { label: t("inTransit"), value: m.sent, help: t("inTransitHelp") },
      {
        label: t("failed"),
        value: m.failed,
        tone: "danger",
        help: t("failedHelp"),
      },
      {
        label: t("avoidingSpam"),
        value: m.notEligiblePossibleSpam,
        tone: "warning",
        help: t("avoidingSpamHelp"),
      },
      {
        label: t("typeMarketing"),
        value: by?.marketing,
        help: t("typeMarketingHelp"),
      },
      {
        label: t("typeUtility"),
        value: by?.utility,
        help: t("typeUtilityHelp"),
      },
      {
        label: t("typeAuthentication"),
        value: by?.authentication,
        help: t("typeAuthenticationHelp"),
      },
    ];
  } else {
    breakdown = [{ label: t("failed"), value: m.failed, tone: "danger" }];
  }

  // Headline help is variant-specific so the copy stays honest: only WhatsApp has
  // the in-transit/delivered/read funnel referenced by headlineSendsHelp.
  const headlineHelp =
    variant === "whatsapp"
      ? t("headlineSendsHelp")
      : isVoice
        ? t("headlineCallsHelp")
        : undefined;

  const hasFilter = !!from || !!to;

  return (
    <section className="rounded-[--radius] border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {isVoice ? t("titleCalls") : t("titleSends")}
          </h2>
          <span className="text-xs text-muted-foreground">
            {hasFilter ? t("filtered") : t("allTime")}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarBlank
            weight="fill"
            className="h-4 w-4 text-muted-foreground"
          />
          <span className="text-sm font-medium text-foreground">
            {t("period")}:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                variant={preset === p.key ? "primary" : "outline-subtle"}
                size="sm"
                title={t(p.labelKey)}
                onClick={() => applyPreset(p.key)}
              />
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <ElevatedDatePicker
                id="campaigns-summary-from"
                label={t("from")}
                value={from}
                onChange={onFromChange}
                maxDate={to ? new Date(to) : undefined}
                inputClassName="min-w-[150px]"
              />
              <span className="text-muted-foreground">→</span>
              <ElevatedDatePicker
                id="campaigns-summary-to"
                label={t("to")}
                value={to}
                onChange={onToChange}
                minDate={from ? new Date(from) : undefined}
                inputClassName="min-w-[150px]"
              />
            </div>
          )}

          {action ? (
            <div className="flex items-center border-l border-border pl-2">
              {action}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-10 gap-y-4 px-5 py-4">
        <div className="flex flex-col">
          <TileLabel
            label={isVoice ? t("headlineCalls") : t("headlineSends")}
            help={headlineHelp}
          />
          <span
            className={cn(
              "font-display text-3xl font-semibold tabular-nums text-foreground",
              loading && "animate-pulse opacity-40",
            )}
          >
            {num(m.dispatches)}
          </span>
        </div>

        {breakdown.map((tile) => (
          <div key={tile.label} className="flex flex-col">
            <TileLabel label={tile.label} help={tile.help} />
            <span
              className={cn(
                "font-display text-xl font-semibold tabular-nums",
                toneClass[tile.tone ?? "default"],
                loading && "animate-pulse opacity-40",
              )}
            >
              {num(tile.value)}
            </span>
          </div>
        ))}

        <div className="flex flex-col">
          <TileLabel label={t("totalEntries")} help={t("totalEntriesHelp")} />
          <span
            className={cn(
              "font-display text-xl font-semibold tabular-nums text-foreground",
              loading && "animate-pulse opacity-40",
            )}
          >
            {num(m.totalNumbers)}
          </span>
        </div>
      </div>
    </section>
  );
}
