"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";
import { Link } from "@/i18n/routing";
import type { GroupAnalysis, SetupWarning } from "@/lib/unofficial-whatsapp-groups/types";

import { groupsRoutes } from "./routes";
import type { ConflictGroup } from "./series-model";

export { parseSeriesConflict, type ConflictGroup } from "./series-model";

const PAUSE_AFTER_FAILURES = 5;

export function NotFollowedNotice({ onFollow, busy }: { onFollow?: () => void; busy?: boolean }) {
  const t = useTranslations("unofficialGroups.kit.notices");
  return (
    <Notice tone="info">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{t("notFollowed")}</p>
        {onFollow ? <Button variant="secondary" size="sm" title={t("follow")} onClick={onFollow} disabled={busy} /> : null}
      </div>
    </Notice>
  );
}

export function NoAdminSeatNotice({ action }: { action: "manage" | "edit" }) {
  const t = useTranslations("unofficialGroups.kit.notices.noAdmin");
  return (
    <Notice tone="warning">
      <p>{t(action)}</p>
    </Notice>
  );
}

export function ExternalRiskNotice({ className }: { className?: string }) {
  const t = useTranslations("unofficialGroups.kit.notices.external");
  return (
    <Notice tone="warning" title={t("title")} className={className}>
      <p>{t("body")}</p>
    </Notice>
  );
}

export function PausedAnalysisNotice({
  analysis,
  lastFailure,
  onResume,
  busy,
}: {
  analysis: Pick<GroupAnalysis, "status" | "pausedReason" | "failures">;
  lastFailure?: string;
  onResume?: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("unofficialGroups.kit.notices.paused");
  if (analysis.pausedReason === "repeated_failures") {
    return (
      <Notice tone="fault" title={t("title", { count: PAUSE_AFTER_FAILURES })}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p>{t("body")}</p>
            {lastFailure ? <p className="break-words text-muted-foreground">{t("lastFailure", { reason: lastFailure })}</p> : null}
          </div>
          {onResume ? <Button variant="secondary" size="sm" title={t("resume")} onClick={onResume} disabled={busy} /> : null}
        </div>
      </Notice>
    );
  }
  if (analysis.status === "active" && analysis.failures > 0) {
    return (
      <Notice tone="warning" title={t("failures", { count: analysis.failures })}>
        <div className="space-y-1">
          <p>{t("failuresBody", { count: PAUSE_AFTER_FAILURES })}</p>
          {lastFailure ? <p className="break-words text-muted-foreground">{t("lastFailure", { reason: lastFailure })}</p> : null}
        </div>
      </Notice>
    );
  }
  return null;
}

export function SetupWarningsNotice({
  warnings,
  groupId,
  showSettingsLink = true,
}: {
  warnings: SetupWarning[];
  groupId: string;
  showSettingsLink?: boolean;
}) {
  const t = useTranslations("unofficialGroups.kit.notices.setup");
  if (warnings.length === 0) return null;
  return (
    <Notice tone="warning" title={t("title")}>
      <ul className="space-y-1">
        {warnings.map((warning) => (
          <li key={warning.step}>
            <span className="font-semibold text-foreground">{t(`steps.${warning.step}`)}</span>
            {warning.reason ? <span className="text-muted-foreground">{t("reason", { reason: warning.reason })}</span> : null}
          </li>
        ))}
      </ul>
      {showSettingsLink ? (
        <Link
          href={groupsRoutes.group(groupId, { tab: "settings", setup: warnings.map((warning) => warning.step) })}
          className="inline-flex rounded-sm text-xs font-semibold text-foreground underline underline-offset-2 hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("openSettings")}
        </Link>
      ) : null}
    </Notice>
  );
}

export function SeriesConflictNotice({ groups }: { groups: ConflictGroup[] }) {
  const t = useTranslations("unofficialGroups.kit.notices.seriesConflict");
  return (
    <Notice tone="warning" title={t("title")}>
      {groups.length > 0 ? (
        <>
          <p>{t("body")}</p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {groups.map((group, index) => (
              <li key={`${group.groupId ?? group.subject}-${index}`}>
                {group.groupId ? (
                  <Link
                    href={groupsRoutes.group(group.groupId, { tab: "settings" })}
                    className="rounded-sm font-semibold text-foreground underline underline-offset-2 hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {group.subject}
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground">{group.subject}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>{t("generic")}</p>
      )}
    </Notice>
  );
}
