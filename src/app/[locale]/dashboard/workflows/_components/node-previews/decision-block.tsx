"use client";

import type { ReactNode } from "react";

export function DecisionBlock({ children }: { children: ReactNode }) {
  return (
    <div className="break-words rounded-md bg-muted px-2 py-1 font-mono text-2xs leading-snug text-foreground/75">
      {children}
    </div>
  );
}

export function Op({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>;
}
