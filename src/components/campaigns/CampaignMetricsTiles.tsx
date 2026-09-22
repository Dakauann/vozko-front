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
  plate: string;
  accent: string;
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
  channel?: string;
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
