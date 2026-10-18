"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/audience/shared";
import Button from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";

import { Readout } from "./chart-parts";
import { QuietEmpty } from "./empty";
import { GroupsPanel } from "./panel";

export type ChartPanelState = "loading" | "error" | "empty" | "ready";

export interface ChartPanelEmpty {
  icon: ReactNode;
  message: string;
  action?: ReactNode;
}

export interface ChartPanelError {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}

export function PanelFault({ error, className }: { error: ChartPanelError; className?: string }) {
  const t = useTranslations("unofficialGroups.kit.states");
  return (
    <Notice tone="fault" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{error.message ?? t("error")}</p>
        <Button variant="secondary" size="sm" title={t("retry")} onClick={error.onRetry} disabled={error.retrying} />
      </div>
    </Notice>
  );
}

export function ChartPanel({
  title,
  subtitle,
  meta,
  actions,
  height,
  state,
  empty,
  error,
  readouts,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  height: number;
  state: ChartPanelState;
  empty?: ChartPanelEmpty;
  error?: ChartPanelError;
  readouts?: { label: string; value: string }[];
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("unofficialGroups.kit.states");
  const showReadouts = state === "ready" && readouts && readouts.length > 0;
  return (
    <GroupsPanel title={title} subtitle={subtitle} meta={meta} actions={actions} className={className}>
      {showReadouts ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {readouts.map((readout) => (
            <Readout key={readout.label} label={readout.label} value={readout.value} />
          ))}
        </div>
      ) : null}
      <div className={cn("relative min-w-0", state !== "ready" && "flex flex-col justify-center")} style={{ height }} aria-busy={state === "loading" || undefined}>
        {state === "loading" ? (
          <>
            <span className="sr-only">{t("loading")}</span>
            <Skeleton className="h-full w-full" />
          </>
        ) : state === "error" ? (
          error ? (
            <PanelFault error={error} />
          ) : (
            <Notice tone="fault">{t("error")}</Notice>
          )
        ) : state === "empty" ? (
          <QuietEmpty icon={empty?.icon} message={empty?.message ?? t("empty")} action={empty?.action} className="h-full py-0" />
        ) : (
          children
        )}
      </div>
    </GroupsPanel>
  );
}
