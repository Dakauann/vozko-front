"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CaretDown } from "@/components/icons";
import { cn } from "@/lib/utils";

export function CollapsibleNotice({
  icon,
  title,
  summary,
  actions,
  defaultOpen = false,
  tone = "warning",
  role = "status",
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  tone?: "warning" | "neutral";
  role?: "status" | "alert";
  children: ReactNode;
}) {
  const t = useTranslations("adsRequirements.notice");
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={cn(
        "rounded-[--radius] border px-4 py-2.5",
        tone === "warning" ? "border-warning-ink/30 bg-muted" : "border-border bg-card shadow-sm",
      )}
      role={role}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {icon}
        <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          {title}
          {summary ? <span className="ml-2 font-normal text-muted-foreground">{summary}</span> : null}
        </p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-ink hover:underline"
        >
          {open ? t("hide") : t("show")}
          <CaretDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {actions}
      </div>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </section>
  );
}
