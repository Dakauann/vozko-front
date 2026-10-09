"use client";

import { useId, type ReactNode } from "react";

import { MapTrifold } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface MapNoticeProps {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}

export function MapNotice({ title, description, children, className }: MapNoticeProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn("flex h-full w-full flex-col items-center justify-center gap-5 bg-muted px-4 py-10 text-center", className)}
    >
      <span className="flex size-14 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm">
        <MapTrifold size={28} aria-hidden="true" />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 id={titleId} className="font-display text-base font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
