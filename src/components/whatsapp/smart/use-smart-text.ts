"use client";

import { useFormatter, useTranslations } from "next-intl";

import { type SmartFinding, type SmartProgress } from "@/lib/whatsapp-campaigns/smart";

const RATE_RULES = new Set(["failure_rate_stop", "failure_rate_slow", "engagement_limit"]);

export function useSmartText() {
  const t = useTranslations("whatsappCampaignsPage.smart");
  const format = useFormatter();

  const percent = (value: number) => format.number(value, { style: "percent", maximumFractionDigits: 1 });

  const count = (value: number) => format.number(value);

  const time = (iso: string) => format.dateTime(new Date(iso), { weekday: "short", hour: "2-digit", minute: "2-digit" });

  const ruleText = (finding: SmartFinding) => {
    const key = `rules.${finding.rule}`;
    if (!t.has(key)) return finding.rule;
    const rates = RATE_RULES.has(finding.rule);
    return t(key, {
      observed: rates ? percent(finding.observed ?? 0) : String(Math.round(finding.observed ?? 0)),
      limit: rates ? percent(finding.limit ?? 0) : String(finding.limit ?? 0),
    });
  };

  const phaseText = (progress: SmartProgress) => {
    const wave = progress.wave ?? 1;
    switch (progress.phase) {
      case "sending":
        return progress.until ? t("phase.sendingAt", { wave, time: time(progress.until) }) : t("phase.sending", { wave });
      case "observing":
        return progress.until ? t("phase.observing", { wave, time: time(progress.until) }) : t("phase.sending", { wave });
      case "waiting":
        return progress.until ? t("phase.waiting", { time: time(progress.until) }) : t("phase.not_started");
      case "held":
        return t("phase.held", { time: progress.since ? time(progress.since) : "" });
      default:
        return t(`phase.${progress.phase}`);
    }
  };

  return { t, percent, count, time, ruleText, phaseText };
}
