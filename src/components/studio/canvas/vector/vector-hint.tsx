"use client";

import { useTranslations } from "next-intl";

export type VectorHintMode = "pen" | "draw" | "edit";

export function VectorHint({ mode }: { mode: VectorHintMode }) {
  const t = useTranslations("studio.vectors.hints");
  return (
    <div role="status" className="pointer-events-none absolute left-1/2 top-3 z-10 w-max max-w-[min(92%,44rem)] -translate-x-1/2 rounded-md bg-popover/95 px-3 py-1.5 text-center text-xs leading-snug text-popover-foreground shadow-sm ring-1 ring-border">
      {t(mode)}
    </div>
  );
}
