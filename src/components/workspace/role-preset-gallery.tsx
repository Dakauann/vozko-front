"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { DotMatrix } from "@/components/brand/circuit";
import { Check, Plus, Warning } from "@/components/icons";
import { RoleTile, useRolePresetCopy } from "@/components/workspace/role-identity";
import { presetPermissions, presetRisks } from "@/lib/workspace/role-presets";
import type { AvailablePermission, RolePreset } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const RISK_LIMIT = 3;
const SKELETON_CARDS = 6;

export const BLANK_START = "blank";

interface RolePresetGalleryProps {
  presets: RolePreset[];
  availablePermissions: AvailablePermission[];
  loading: boolean;
  selectedKey: string | null;
  compact?: boolean;
  onSelect: (preset: RolePreset | null) => void;
}

function gridClass(compact: boolean) {
  return cn("grid gap-3", compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3");
}

const CARD_CLASS =
  "relative flex h-full min-w-0 flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function SelectedMark({ label }: { label: string }) {
  return (
    <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Check className="h-3 w-3" weight="bold" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function CardOrnament() {
  return (
    <DotMatrix
      tone="quiet"
      className="pointer-events-none absolute right-0 top-0 h-9 w-14 -scale-x-100 opacity-70"
    />
  );
}

export function RolePresetGallery({
  presets,
  availablePermissions,
  loading,
  selectedKey,
  compact = false,
  onSelect,
}: RolePresetGalleryProps) {
  const t = useTranslations("roleBuilder");
  const tSettings = useTranslations("workspaceSettings");
  const copy = useRolePresetCopy();

  if (loading) {
    return (
      <div className={gridClass(compact)} aria-busy="true">
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="h-10 w-10 rounded-[--radius] bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-2/3 rounded-[--radius] bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-full rounded-[--radius] bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-5/6 rounded-[--radius] bg-muted motion-safe:animate-pulse" />
            <div className="mt-1 h-3 w-1/3 rounded-[--radius] bg-muted motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const blankSelected = selectedKey === BLANK_START;

  return (
    <div className={gridClass(compact)}>
      {presets.map((preset) => {
        const permissions = presetPermissions(preset, availablePermissions);
        const risks = presetRisks(permissions, availablePermissions);
        const selected = selectedKey === preset.key;
        const highlights = copy.highlights(preset.key, preset.highlights);
        return (
          <button
            key={preset.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(preset)}
            className={cn(CARD_CLASS, selected ? "border-primary" : "border-border hover:border-control-edge")}
          >
            <CardOrnament />
            <RoleTile presetKey={preset.key} size="lg" />
            <span className="flex min-w-0 items-start justify-between gap-2">
              <span className="min-w-0 text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                {copy.name(preset.key, preset.name)}
              </span>
              {selected && <SelectedMark label={t("selected")} />}
            </span>
            <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {copy.description(preset.key, preset.description)}
            </span>
            {highlights.length > 0 && (
              <span className="flex flex-wrap gap-1.5">
                {highlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="max-w-full rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-medium text-foreground [overflow-wrap:anywhere]"
                  >
                    {highlight}
                  </span>
                ))}
              </span>
            )}
            <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-2xs text-muted-foreground">
              <span className="readout font-medium text-foreground">
                {t("permissionCount", { count: permissions.length })}
              </span>
              {risks.length > 0 && (
                <span className="sr-only">{t("risksLabel")}</span>
              )}
              {risks.slice(0, RISK_LIMIT).map((risk) => (
                <span key={risk.kind} className="inline-flex items-center gap-1">
                  <Warning
                    weight="fill"
                    aria-hidden
                    className={cn(
                      "h-3 w-3 flex-shrink-0",
                      risk.level === "high" ? "text-destructive-ink" : "text-warning-ink",
                    )}
                  />
                  {tSettings(`risks.kinds.${risk.kind}`)}
                </span>
              ))}
              {risks.length > RISK_LIMIT && (
                <span className="readout">+{risks.length - RISK_LIMIT}</span>
              )}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        aria-pressed={blankSelected}
        onClick={() => onSelect(null)}
        className={cn(CARD_CLASS, blankSelected ? "border-primary" : "border-border hover:border-control-edge")}
      >
        <CardOrnament />
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-[--radius] border border-border bg-muted text-muted-foreground"
        >
          <Plus className="h-5 w-5" weight="bold" />
        </span>
        <span className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
            {t("blankTitle")}
          </span>
          {blankSelected && <SelectedMark label={t("selected")} />}
        </span>
        <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {t("blankDescription")}
        </span>
        <span className="mt-auto border-t border-border pt-3 text-2xs text-muted-foreground">
          {t("permissionCount", { count: 0 })}
        </span>
      </button>
    </div>
  );
}
