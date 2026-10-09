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
    <div role={tone === "fault" ? "alert" : "status"} className={cn("notice flex items-start gap-2 px-3 py-2.5 text-xs", TONE_CLASS[tone], className)}>
      <span aria-hidden className="notice-ink mt-0.5 inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4">
        {icon ?? <Glyph weight="fill" />}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        {title ? <p className="notice-ink font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
