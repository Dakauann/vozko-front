"use client";

import {
  CheckCircle,
  Clock,
  Eye,
  PaperPlaneTilt,
  ShieldWarning,
  UserMinus,
  Warning,
} from "@/components/icons";
import type { ReactNode } from "react";

import type { CampaignMetrics } from "@/lib/campaigns/metrics";
import { channelPlate } from "@/components/channels/channel-tile";
import { cn } from "@/lib/utils";

/**
 * The metric tiles on a campaign detail header.
 *
 * Lifted from the Cloud API campaign's detail page so both products present the
 * same wall of numbers: an icon plate, a small caption, a display-face value,
 * and a soft accent blob behind the plate. A channel supplies its own plate
 * colour, so the unofficial channel reads as graphite where the official reads
 * as WhatsApp green — the two send under different rules and an operator who
 * cannot tell them apart cannot know what they are allowed to send.
 *
 * The one tile that is not shared is `skippedNotOnWhatsApp`: it renders only
 * when the metrics carry it, because a channel that cannot check a number
 * before sending has no honest value to put there and a zero would read as
 * "we checked and none were dead".
 */
export interface CampaignMetricsLabels {
  total: string;
  pending: string;
  sent: string;
  delivered: string;
  read: string;
  failed: string;
  avoidingSpam: string;
  notOnWhatsapp: string;
}

interface Tile {
  key: string;
  label: string;
  value: number;
  icon: ReactNode;
  /** Plate class for the icon box. */
  plate: string;
  /** Colour of the blurred accent behind the plate. */
  accent: string;
  /** Optional second line, e.g. a completion percentage. */
  hint?: string;
}

export function CampaignMetricsTiles({
  metrics,
  labels,
  channel = "whatsapp",
  glyph,
}: {
  metrics?: CampaignMetrics | null;
  labels: CampaignMetricsLabels;
  /** Drives the "total" tile's plate, so each channel keeps its identity. */
  channel?: string;
  /** The channel's own mark for the total tile. */
  glyph: ReactNode;
}) {
  const m = metrics;

  const tiles: Tile[] = [
    {
      key: "total",
      label: labels.total,
      value: m?.totalNumbers ?? 0,
      icon: glyph,
      plate: channelPlate(channel),
      accent: "bg-healthy",
    },
    {
      key: "pending",
      label: labels.pending,
      value: m?.pending ?? 0,
      icon: <Clock weight="fill" className="h-5 w-5" />,
      plate: "tile-neutral",
      accent: "bg-muted",
    },
    {
      key: "sent",
      label: labels.sent,
      value: m?.sent ?? 0,
      icon: <PaperPlaneTilt weight="fill" className="h-5 w-5" />,
      plate: channelPlate(channel),
      accent: "bg-muted",
      hint: m?.completionRate != null ? `${m.completionRate.toFixed(1)}%` : undefined,
    },
    {
      key: "delivered",
      label: labels.delivered,
      value: m?.delivered ?? 0,
      icon: <CheckCircle weight="fill" className="h-5 w-5" />,
      plate: "tile-healthy",
      accent: "bg-healthy",
    },
    {
      key: "read",
      label: labels.read,
      value: m?.read ?? 0,
      icon: <Eye weight="fill" className="h-5 w-5" />,
      plate: "tile-healthy",
      accent: "bg-healthy",
    },
    {
      key: "failed",
      label: labels.failed,
      value: m?.failed ?? 0,
      icon: <Warning weight="fill" className="h-5 w-5" />,
      plate: "tile-fault",
      accent: "bg-destructive",
    },
    {
      key: "avoidingSpam",
      label: labels.avoidingSpam,
      value: m?.notEligiblePossibleSpam ?? 0,
      icon: <ShieldWarning weight="fill" className="h-5 w-5" />,
      plate: "tile-warning",
      accent: "bg-warning",
    },
  ];

  if (m?.skippedNotOnWhatsApp !== undefined) {
    tiles.push({
      key: "notOnWhatsapp",
      label: labels.notOnWhatsapp,
      value: m.skippedNotOnWhatsApp,
      icon: <UserMinus weight="fill" className="h-5 w-5" />,
      plate: "tile-warning",
      accent: "bg-warning",
    });
  }

  return (
    // Six across, wrapping — the official campaign's density. Fitting every
    // tile onto one row instead squeezes each until the caption wraps and the
    // numbers stop being scannable, which is the whole job of this strip.
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className="group relative flex items-center gap-3 overflow-hidden rounded-[--radius] border border-border bg-card p-4"
        >
          <div
            className={cn(
              "absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-[0.06] blur-2xl",
              tile.accent,
            )}
          />
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              tile.plate,
            )}
          >
            {tile.icon}
          </div>
          <div className="min-w-0">
            <p className="text-2xs font-medium text-muted-foreground">{tile.label}</p>
            <p className="font-display text-xl font-semibold text-foreground">
              {tile.value.toLocaleString()}
            </p>
            {tile.hint ? (
              <p className="text-2xs font-medium text-muted-foreground">{tile.hint}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
