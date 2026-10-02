"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { Broadcast, DownloadSimple, Warning } from "@/components/icons";
import type { LiveFetch } from "@/lib/advertising/live";
import type { AdAttributionWindow } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

import { useBreakdownLabel } from "./breakdown-sheet";

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

export function ReportControls({
  windowOptions,
  attribution,
  onAttribution,
  groups,
  onBreakdown,
  comparing,
  onCompare,
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
  comparing: boolean;
  onCompare: (on: boolean) => void;
  exporting: boolean;
  onExport: () => void;
  optionsReady: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("adsManager.report");
  const groupLabel = useBreakdownLabel();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-48">
        <ElevatedSelect
          label={t("attribution")}
          value={attribution}
          disabled={!optionsReady || disabled}
          onValueChange={(value) => onAttribution(value as WindowChoice)}
        >
          <ElevatedSelectItem value={DEFAULT_WINDOW}>{t("windows.default")}</ElevatedSelectItem>
          {windowOptions.map((option) => (
            <ElevatedSelectItem key={option} value={option}>
              {t(`windows.${option}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </div>
      <div className="w-48">
        <ElevatedSelect
          label={t("breakdown")}
          value=""
          disabled={!optionsReady || disabled || groups.length === 0}
          onValueChange={(value) => onBreakdown(value.split(","))}
        >
          {groups.map((group) => (
            <ElevatedSelectItem key={group.join(",")} value={group.join(",")}>
              {groupLabel(group)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </div>
      <ElevatedSwitch checked={comparing} disabled={disabled} onCheckedChange={onCompare} label={t("compare")} />
      <Button
        variant="ghost"
        size="sm"
        title={exporting ? t("exporting") : t("export")}
        icon={<DownloadSimple className="h-4 w-4" />}
        iconVisible
        iconSide="left"
        onClick={onExport}
        disabled={exporting || disabled}
      />
    </div>
  );
}
