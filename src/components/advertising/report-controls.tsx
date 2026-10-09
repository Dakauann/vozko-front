"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Broadcast, CaretDown, Check, DownloadSimple, ListDashes, Target, Warning } from "@/components/icons";
import { BULK_CONTROL } from "@/components/selection/GuardedAction";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { LiveFetch } from "@/lib/advertising/live";
import type { AdAttributionWindow } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

import { useBreakdownLabel } from "./use-breakdown-labels";

export const DEFAULT_WINDOW = "default";

export type WindowChoice = typeof DEFAULT_WINDOW | AdAttributionWindow;

const KNOWN_WINDOWS: AdAttributionWindow[] = ["1d_view", "1d_click", "7d_click", "28d_click"];

export function knownWindows(offered: string[] | null | undefined): AdAttributionWindow[] {
  return KNOWN_WINDOWS.filter((candidate) => (offered ?? []).includes(candidate));
}

export function LiveHint({ status }: { status: LiveFetch }) {
  const t = useTranslations("adsManager.live");
  if (status === "idle") return null;
  const failed = status === "failed";
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-2xs font-medium", failed ? "text-warning-ink" : "text-muted-foreground")}
      role={failed ? "status" : undefined}
    >
      {failed ? <Warning className="h-3 w-3" aria-hidden /> : <Broadcast className={cn("h-3 w-3", status === "loading" && "animate-pulse")} aria-hidden />}
      {t(status)}
    </span>
  );
}

export const TOOLBAR_CONTROL = BULK_CONTROL;

function MenuButton({ icon, label, disabled, children }: { icon: ReactNode; label: string; disabled: boolean; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={disabled} className={TOOLBAR_CONTROL} aria-label={label}>
          {icon}
          <span className="max-md:sr-only">{label}</span>
          <CaretDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-60 overflow-y-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ReportControls({
  windowOptions,
  attribution,
  onAttribution,
  groups,
  onBreakdown,
  exporting,
  onExport,
  optionsReady,
  disabled,
}: {
  windowOptions: AdAttributionWindow[];
  attribution: WindowChoice;
  onAttribution: (choice: WindowChoice) => void;
  groups: string[][];
  onBreakdown: (group: string[]) => void;
  exporting: boolean;
  onExport: () => void;
  optionsReady: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("adsManager.report");
  const groupLabel = useBreakdownLabel();
  const windows: WindowChoice[] = [DEFAULT_WINDOW, ...windowOptions];

  return (
    <>
      <MenuButton
        icon={<ListDashes className="h-4 w-4 text-muted-foreground" aria-hidden />}
        label={t("breakdown")}
        disabled={!optionsReady || disabled || groups.length === 0}
      >
        {groups.map((group) => (
          <DropdownMenuItem key={group.join(",")} onSelect={() => onBreakdown(group)}>
            {groupLabel(group)}
          </DropdownMenuItem>
        ))}
      </MenuButton>
      <MenuButton icon={<Target className="h-4 w-4 text-muted-foreground" aria-hidden />} label={t("attribution")} disabled={!optionsReady || disabled}>
        <DropdownMenuLabel>{t("attribution")}</DropdownMenuLabel>
        {windows.map((option) => (
          <DropdownMenuItem key={option} onSelect={() => onAttribution(option)}>
            <Check className={cn("mr-2 h-4 w-4", attribution === option ? "opacity-100" : "opacity-0")} aria-hidden />
            {t(`windows.${option}`)}
          </DropdownMenuItem>
        ))}
      </MenuButton>
      <button type="button" onClick={onExport} disabled={exporting || disabled} className={TOOLBAR_CONTROL} aria-label={t("export")}>
        <DownloadSimple className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="max-md:sr-only">{exporting ? t("exporting") : t("export")}</span>
      </button>
    </>
  );
}
