"use client";

import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { Notice, type NoticeTone } from "@/components/ui/notice";
import { pathForScreen } from "@/lib/navigation/routes";
import {
  findingsByLevel,
  LAUNCH_LEVELS,
  launchAllowed,
  type LaunchCode,
  type LaunchFinding,
  type LaunchLevel,
  type LaunchReport,
} from "@/lib/whatsapp-campaigns/launch-check";

import type { LaunchCheck } from "./use-launch-check";

const LEVEL_TONE: Record<LaunchLevel, NoticeTone> = { block: "fault", confirm: "warning", advice: "info" };

const RATE_CODES = new Set<LaunchCode>(["last_run_failures", "last_run_engagement"]);

type FixKind = "template" | "phone" | "balance";

const FIX_OF: Partial<Record<LaunchCode, FixKind>> = {
  template_not_ready: "template",
  form_not_sendable: "template",
  template_red: "template",
  template_yellow: "template",
  template_flagged: "template",
  template_reclassified: "template",
  no_exit: "template",
  phone_unavailable: "phone",
  balance_short: "balance",
};

export interface LaunchLinks {
  templateId?: string;
}

function fixHref(kind: FixKind, links: LaunchLinks): string | null {
  if (kind === "template") return links.templateId ? pathForScreen("whatsapp_template_detail", { templateId: links.templateId }) : null;
  if (kind === "phone") return pathForScreen("business_phones");
  return pathForScreen("balance");
}

function FindingItem({ finding, links }: { finding: LaunchFinding; links: LaunchLinks }) {
  const t = useTranslations("launchCheck");
  const format = useFormatter();
  const value = (n: number | undefined) =>
    RATE_CODES.has(finding.code) ? format.number(n ?? 0, { style: "percent", maximumFractionDigits: 1 }) : format.number(n ?? 0);
  const fix = FIX_OF[finding.code];
  const href = fix ? fixHref(fix, links) : null;
  return (
    <li className="space-y-0.5">
      <p className="text-sm font-medium text-foreground">{t(`codes.${finding.code}.title`)}</p>
      <p className="text-muted-foreground">{t(`codes.${finding.code}.description`, { observed: value(finding.observed), limit: value(finding.limit) })}</p>
      {fix && href ? (
        <a href={href} className="inline-block text-xs font-medium text-foreground underline underline-offset-4">
          {t(`fix.${fix}`)}
        </a>
      ) : null}
    </li>
  );
}

export function LaunchFindings({
  report,
  links,
  confirmed,
  onConfirmedChange,
  disabled = false,
}: {
  report: LaunchReport;
  links: LaunchLinks;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("launchCheck");
  const grouped = findingsByLevel(report);
  return (
    <>
      {LAUNCH_LEVELS.map((level) =>
        grouped[level].length > 0 ? (
          <Notice key={level} tone={LEVEL_TONE[level]} title={t(`levels.${level}`)}>
            <ul className="space-y-3">
              {grouped[level].map((finding) => (
                <FindingItem key={finding.code} finding={finding} links={links} />
              ))}
            </ul>
          </Notice>
        ) : null,
      )}
      {report.needsConfirmation && !report.blocks ? (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <Checkbox checked={confirmed} onCheckedChange={(value) => onConfirmedChange(value === true)} disabled={disabled} className="mt-0.5" />
          <span>{t("confirm")}</span>
        </label>
      ) : null}
    </>
  );
}

export function LaunchCheckDialog({ check, links }: { check: LaunchCheck; links: LaunchLinks }) {
  const t = useTranslations("launchCheck");
  const { report, phase, confirmed, setConfirmed, changed, confirmStart, close } = check;
  const open = report !== null && (phase === "review" || phase === "starting");
  if (!report) return null;
  const starting = phase === "starting";
  return (
    <ElevatedDialog open={open} onOpenChange={(next) => !next && close()}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <div className="space-y-3">
          {changed ? <p className="text-xs text-muted-foreground">{t("changed")}</p> : null}
          <LaunchFindings report={report} links={links} confirmed={confirmed} onConfirmedChange={setConfirmed} disabled={starting} />
        </div>
        <ElevatedDialogFooter>
          <Button type="button" variant="secondary" size="sm" title={t("cancel")} onClick={close} disabled={starting} />
          <Button
            type="button"
            variant="primary"
            size="sm"
            title={starting ? t("starting") : t("start")}
            onClick={confirmStart}
            disabled={starting || !launchAllowed(report, confirmed)}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
