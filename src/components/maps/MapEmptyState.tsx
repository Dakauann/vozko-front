"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { Upload, UserPlus, WhatsappLogo, type Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { presentOffMapKeys } from "@/lib/maps/summary";
import type { GeoSummary } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

import { MapNotice } from "./MapNotice";

export type MapEmptyAction = "importAddresses" | "requestAddress" | "createLead";

export type MapEmptyActionProps =
  | { onSelect: () => void; disabledReason?: string | null }
  | { onSelect?: undefined; disabledReason: string };

function explained(props: MapEmptyActionProps | undefined): props is MapEmptyActionProps {
  return props !== undefined && (typeof props.onSelect === "function" || Boolean(props.disabledReason));
}

export interface MapEmptyStateProps {
  summary: GeoSummary | null;
  importAddresses?: MapEmptyActionProps;
  requestAddress?: MapEmptyActionProps;
  createLead?: MapEmptyActionProps;
  className?: string;
}

const ACTIONS: Array<{ key: MapEmptyAction; icon: Icon; primary: boolean }> = [
  { key: "importAddresses", icon: Upload, primary: true },
  { key: "requestAddress", icon: WhatsappLogo, primary: false },
  { key: "createLead", icon: UserPlus, primary: false },
];

const COUNTS: Array<keyof GeoSummary> = ["total", "withoutAddress", "approximate", "pending", "notFound"];

function shownCounts(summary: GeoSummary): Array<keyof GeoSummary> {
  return [...COUNTS, ...presentOffMapKeys(summary)];
}

function EmptyAction({ action, icon: ActionIcon, primary, props }: { action: MapEmptyAction; icon: Icon; primary: boolean; props: MapEmptyActionProps }) {
  const t = useTranslations("leadMap.empty");
  const reasonId = useId();
  const reason = props.disabledReason || null;
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        variant={primary ? "primary" : "outline"}
        disabled={reason !== null}
        aria-describedby={reason ? reasonId : undefined}
        onClick={props.onSelect}
      >
        <ActionIcon aria-hidden="true" />
        {t(`actions.${action}`)}
      </Button>
      {reason ? (
        <p id={reasonId} className="max-w-56 text-center text-2xs text-muted-foreground">
          {reason}
        </p>
      ) : null}
    </div>
  );
}

export function MapEmptyState({ summary, importAddresses, requestAddress, createLead, className }: MapEmptyStateProps) {
  const t = useTranslations("leadMap.empty");
  const provided: Record<MapEmptyAction, MapEmptyActionProps | undefined> = { importAddresses, requestAddress, createLead };
  const actions = ACTIONS.filter(({ key }) => explained(provided[key]));
  const counts = summary ? shownCounts(summary) : [];

  return (
    <MapNotice title={t("title")} description={t("description")} className={className}>
      {summary ? (
        <dl
          className={cn(
            "grid w-full grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-flow-col sm:grid-cols-none sm:auto-cols-fr",
            counts.length > COUNTS.length ? "max-w-2xl" : "max-w-lg",
          )}
        >
          {counts.map((field) => (
            <div key={field} className="flex flex-col gap-0.5 bg-card px-3 py-2 text-left">
              <dt className="text-2xs text-muted-foreground">{t(`counts.${field}`)}</dt>
              <dd className="readout text-sm font-semibold tabular-nums text-foreground">{t("count", { count: summary[field] })}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions.length > 0 ? (
        <div className="flex flex-wrap items-start justify-center gap-3">
          {actions.map(({ key, icon, primary }) => (
            <EmptyAction key={key} action={key} icon={icon} primary={primary} props={provided[key] as MapEmptyActionProps} />
          ))}
        </div>
      ) : null}
    </MapNotice>
  );
}
