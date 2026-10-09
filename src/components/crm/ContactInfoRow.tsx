import type { ReactNode } from "react";

export function ContactInfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 bg-card px-4 py-2.5">
      <dt className="text-xs font-medium capitalize text-muted-foreground">{label}</dt>
      <dd className="text-right text-xs font-medium">{children}</dd>
    </div>
  );
}
