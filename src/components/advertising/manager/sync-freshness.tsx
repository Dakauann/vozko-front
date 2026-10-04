"use client";

import { useTranslations } from "next-intl";

import { ArrowClockwise } from "@/components/icons";
import { cn } from "@/lib/utils";

export function SyncFreshness({ synced, syncing, onSync }: { synced: string | null; syncing: boolean; onSync: () => void }) {
  const t = useTranslations("adsManager.sync");
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{synced ? t("updated", { when: synced }) : t("never")}</span>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        aria-label={t("action")}
        title={t("action")}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <ArrowClockwise className={cn("h-4 w-4", syncing && "animate-spin")} aria-hidden />
      </button>
    </div>
  );
}
