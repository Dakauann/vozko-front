"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { Upload, UserPlus, WhatsappLogo, type Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { GeoSummary } from "@/lib/maps/types";

import { MapNotice } from "./MapNotice";

type MapEmptyAction = "importAddresses" | "requestAddress" | "createLead";

export type MapEmptyActionProps =
  | { onSelect: () => void; disabledReason?: string | null }
  | { onSelect?: undefined; disabledReason: string };

function explained(props: MapEmptyActionProps | undefined): props is MapEmptyActionProps {
  return props !== undefined && (typeof props.onSelect === "function" || Boolean(props.disabledReason));
}

type MapEmptyScope = "workspace" | "filter";

const SCOPE_COPY: Record<MapEmptyScope, { title: string; description: string }> = {
  workspace: { title: "title", description: "description" },
  filter: { title: "unplacedTitle", description: "unplacedDescription" },
};

interface MapEmptyStateProps {
  summary: GeoSummary | null;
  scope?: MapEmptyScope;
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

export function MapEmptyState({ summary, scope = "workspace", importAddresses, requestAddress, createLead, className }: MapEmptyStateProps) {
  const t = useTranslations("leadMap.empty");
  const provided: Record<MapEmptyAction, MapEmptyActionProps | undefined> = { importAddresses, requestAddress, createLead };
  const actions = ACTIONS.filter(({ key }) => explained(provided[key]));

  return (
    <MapNotice title={t(SCOPE_COPY[scope].title)} description={t(SCOPE_COPY[scope].description)} className={className}>
      {summary ? (
        <dl className="grid w-full max-w-lg grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-flow-col sm:grid-cols-none sm:auto-cols-fr">
          {COUNTS.map((field) => (
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
