"use client";

import { useId, type ReactNode } from "react";

import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { ArrowSquareOut } from "@/components/icons";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import type { Resource } from "./use-ads-resource";

export function ChoiceRow({
  value,
  title,
  hint,
  icon,
  disabled,
}: {
  value: string;
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-[--radius] border border-border px-3 py-2.5 transition-colors has-[[data-state=checked]]:border-control-edge has-[[data-state=checked]]:bg-muted",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted",
      )}
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} className="mt-0.5" />
      {icon ? <span className="mt-0.5 text-muted-foreground">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function CheckRow({
  checked,
  title,
  hint,
  disabled,
  onChange,
}: {
  checked: boolean;
  title: string;
  hint?: ReactNode;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn("flex items-start gap-2.5 py-1 text-sm", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}
    >
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="block text-foreground">{title}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Hint({ children, tone = "muted", icon }: { children: ReactNode; tone?: "muted" | "warning"; icon?: ReactNode }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-xs", tone === "warning" ? "text-warning-ink" : "text-muted-foreground")}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </p>
  );
}

export function ReadOnlyFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{value}</dd>
    </div>
  );
}

export function ResourceState<T>({ resource, empty }: { resource: Resource<T[]>; empty: string }) {
  if (resource.status === "loading") return <div className="h-11 animate-pulse rounded-[--radius] bg-muted" />;
  if (resource.status === "error") return <p className="text-sm text-destructive-ink">{resource.message}</p>;
  if (resource.status === "ready" && resource.data.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return null;
}

export function ExternalLink({ href, children, onOpen }: { href: string; children: string; onOpen?: (url: string) => boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (onOpen?.(href)) event.preventDefault();
      }}
      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-ink hover:underline"
    >
      {children}
      <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}
