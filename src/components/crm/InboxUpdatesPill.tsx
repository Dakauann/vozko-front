"use client";

import { useTranslations } from "next-intl";

import { ArrowUp } from "@/components/icons";

export function InboxUpdatesPill({ count, onApply }: { count: number; onApply: () => void }) {
  const t = useTranslations("liveChat.inbox");
  if (count <= 0) return null;
  return (
    <div className="pointer-events-none sticky top-2 z-10 flex justify-center">
      <button
        type="button"
        onClick={onApply}
        title={t("updatesHint")}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-2xs font-semibold text-foreground shadow-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowUp weight="bold" className="h-3 w-3" aria-hidden />
        <span aria-live="polite">{t("updates", { count })}</span>
      </button>
    </div>
  );
}
