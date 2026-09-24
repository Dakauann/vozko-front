"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Info } from "@/components/icons";
import { useWorkspaceConfig } from "@/hooks/use-workspace-config";
import { handOffRules } from "@/lib/workspace/workspace-config/roulette";

// HandOffRulesSummary tells whoever configures a hand-off (the workflow node,
// the agent's transfer tool) who will receive the conversation: it follows the
// workspace's roulette, the same one the first customer message goes through.
// It shows nothing until the settings are read, rather than guess them.
export function HandOffRulesSummary({ workspaceId }: { workspaceId?: string | null }) {
  const t = useTranslations("handOffRules");
  const locale = useLocale();
  const { config } = useWorkspaceConfig(workspaceId);
  if (!config) return null;

  const rules = handOffRules(config);
  const lines = [
    rules.mode === "last_seen" ? t("lastSeen", { hours: String(rules.windowHours) }) : t("online"),
    t("department"),
    rules.skipAdmins ? t("adminsSkipped") : t("adminsIncluded"),
    rules.rescue
      ? t(rules.rescue.workingHoursOnly ? "rescueWorkingHours" : "rescue", {
          minutes: String(rules.rescue.afterMinutes),
        })
      : t("noRescue"),
    t("queue"),
    t("paused"),
  ];

  return (
    <div className="rounded-lg border border-border bg-mist p-2.5 space-y-1.5" data-testid="hand-off-rules">
      <p className="flex items-center gap-1.5 text-2xs font-medium text-foreground">
        <Info size={12} className="text-primary-ink" />
        {t("title")}
      </p>
      <ul className="space-y-1 pl-4 text-2xs text-muted-foreground list-disc">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Link href={`/${locale}/dashboard/workspace`} className="inline-block text-2xs font-medium text-primary-ink hover:underline">
        {t("settingsLink")}
      </Link>
    </div>
  );
}
