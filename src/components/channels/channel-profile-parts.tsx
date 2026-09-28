"use client";

import { accentColorMap } from "@/components/elevated-design/listing-card";
import { cn } from "@/lib/utils";

export function ProfileStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className="font-display text-base font-semibold tabular-nums text-foreground">{value.toLocaleString()}</dd>
      <dt className="text-sm text-muted-foreground">{label}</dt>
    </div>
  );
}

export function CapabilityChip({ enabled, label, title }: { enabled: boolean; label: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[--radius] border px-2 py-0.5 text-2xs",
        enabled
          ? "border-border bg-muted text-muted-foreground"
          : "border-dashed border-border bg-transparent text-muted-foreground",
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", enabled ? "bg-healthy" : "bg-muted-foreground/40")} />
      {label}
    </span>
  );
}

export function ProfileNotice({
  color,
  icon,
  children,
}: {
  color: "amber" | "rose" | "slate";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const accent = accentColorMap[color];
  return (
    <div className={cn("flex gap-2 rounded-lg border p-3 text-xs leading-relaxed", accent.light, accent.border, accent.text)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
