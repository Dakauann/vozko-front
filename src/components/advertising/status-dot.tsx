"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { deliveryHintKey, deliveryKey, deliveryTone, jobStatusKey, jobTone, type DeliveryTone } from "@/lib/advertising/delivery";
import { cn } from "@/lib/utils";

const DOT: Record<DeliveryTone, string> = {
  healthy: "bg-healthy",
  warning: "bg-warning",
  fault: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground/60",
};

const INK: Record<DeliveryTone, string> = {
  healthy: "text-foreground",
  warning: "text-warning-ink",
  fault: "text-destructive-ink",
  info: "text-foreground",
  neutral: "text-muted-foreground",
};

export function StatusDot({ tone, children, className, hint }: { tone: DeliveryTone; children: ReactNode; className?: string; hint?: string }) {
  return (
    <span title={hint} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm", INK[tone], hint && "cursor-help", className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[tone])} aria-hidden />
      {children}
    </span>
  );
}

export function DeliveryStatus({ delivery }: { delivery: string }) {
  const t = useTranslations("adsManager");
  const hint = deliveryHintKey(delivery);
  return (
    <StatusDot tone={deliveryTone(delivery)} hint={hint ? t(`deliveryHint.${hint}`) : undefined}>
      {t(`delivery.${deliveryKey(delivery)}`)}
    </StatusDot>
  );
}

export function JobStatus({ status }: { status: string }) {
  const t = useTranslations("adsManager.jobs.status");
  return <StatusDot tone={jobTone(status)}>{t(jobStatusKey(status))}</StatusDot>;
}
