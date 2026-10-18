import type { ReactNode } from "react";

import { Info, WarningCircle } from "@/components/icons";
import { cn } from "@/lib/utils";

export type NoticeTone = "info" | "warning" | "fault" | "healthy" | "brand" | "neutral";

const TONE_CLASS: Record<NoticeTone, string | null> = {
  info: "notice-info",
  warning: "notice-warning",
  fault: "notice-fault",
  healthy: "notice-healthy",
  brand: "notice-brand",
  neutral: null,
};

export function Notice({
  tone,
  title,
  icon,
  children,
  className,
}: {
  tone: NoticeTone;
  title?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Glyph = tone === "warning" || tone === "fault" ? WarningCircle : Info;
  return (
    <div role={tone === "fault" ? "alert" : "status"} className={cn("notice flex items-start gap-3 px-4 py-3.5 text-xs leading-relaxed", TONE_CLASS[tone], className)}>
      <span aria-hidden className="notice-mark inline-flex h-5 shrink-0 items-center [&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem]">
        {icon ?? <Glyph weight="fill" />}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {title ? <p className="text-sm font-semibold leading-5 text-foreground">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
