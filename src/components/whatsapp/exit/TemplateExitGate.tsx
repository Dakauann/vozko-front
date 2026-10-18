"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { codedErrorMessage } from "@/lib/api/coded-error";

import { ExitRiskAcknowledgement } from "./ExitRiskAcknowledgement";
import { ExitVerdictNotice } from "./ExitVerdictNotice";
import type { ExitAcknowledgementGate } from "./use-exit-acknowledgement";

export function TemplateExitGate({ gate }: { gate: ExitAcknowledgementGate }) {
  const t = useTranslations("templateExit");
  if (!gate.templateId) return null;
  if (gate.loading) {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        {t("verdict.loading")}
      </p>
    );
  }
  if (gate.error) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-destructive-ink">{codedErrorMessage(t, gate.error, t("verdict.failed"))}</span>
        <Button type="button" variant="secondary" size="sm" title={t("verdict.retry")} onClick={gate.reload} />
      </div>
    );
  }
  if (!gate.verdict) return null;
  return (
    <div className="space-y-2">
      <ExitVerdictNotice verdict={gate.verdict} />
      {gate.needed ? <ExitRiskAcknowledgement checked={gate.acknowledged} onCheckedChange={gate.setAcknowledged} /> : null}
    </div>
  );
}
