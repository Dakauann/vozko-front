"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Chapter, Surface } from "@/components/dashboard/attendance/primitives";
import type { MembershipWindow } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { useGroupsFormat } from "./use-groups-format";

export function PanelHead({
  title,
  subtitle,
  meta,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 border-b border-border pb-2.5", className)}>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-base font-semibold leading-tight tracking-[0.01em] text-foreground" title={title}>
          {title}
        </h3>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {meta || actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {meta ? <div className="text-2xs text-muted-foreground">{meta}</div> : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function GroupsPanel({
  title,
  subtitle,
  meta,
  actions,
  className,
  children,
  boxed = true,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
  boxed?: boolean;
}) {
  const body = (
    <>
      <PanelHead title={title} subtitle={subtitle} meta={meta} actions={actions} />
      <div className="min-w-0 pt-3">{children}</div>
    </>
  );
  if (!boxed) return <section className={cn("min-w-0", className)}>{body}</section>;
  return <Surface className={cn("flex flex-col", className)}>{body}</Surface>;
}

export function GroupsChapter({
  id,
  icon,
  title,
  subtitle,
  meta,
  children,
  className,
}: {
  id: string;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Chapter id={id} icon={icon} iconBg="text-muted-foreground" title={title} subtitle={subtitle} meta={meta} className={className}>
      {children}
    </Chapter>
  );
}

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold tracking-[0.01em] text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function WindowLabel({
  days,
  window,
  allTime,
  timezone,
  className,
}: {
  days?: number;
  window?: MembershipWindow;
  allTime?: boolean;
  timezone: string;
  className?: string;
}) {
  const t = useTranslations("unofficialGroups.kit.window");
  const fmt = useGroupsFormat(timezone);
  let text: string | null = null;
  if (allTime) text = t("allTime");
  else if (window) text = t("label", { range: fmt.windowRange(window), timezone: window.timezone || timezone });
  else if (days !== undefined) text = days <= 0 ? t("allTime") : t("label", { range: t("days", { count: days }), timezone });
  if (!text) return null;
  return <span className={cn("readout whitespace-nowrap text-2xs text-muted-foreground", className)}>{text}</span>;
}
