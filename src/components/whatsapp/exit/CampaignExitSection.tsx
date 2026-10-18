"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { PencilSimple } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { ROUTE_KINDS, offeredKinds } from "@/lib/whatsapp-templates/exit";

import { CampaignRouteOverrides } from "./CampaignRouteOverrides";
import { DefineExitOnTemplateDialog } from "./DefineExitOnTemplateDialog";
import { ExitRiskAcknowledgement } from "./ExitRiskAcknowledgement";
import { ExitVerdictNotice } from "./ExitVerdictNotice";
import type { CampaignExit } from "./use-campaign-exit";
import { useAudienceExits, type AudienceExitsRead } from "./use-template-exit";

const NO_NUMBERS: readonly string[] = [];

function AudienceExitsRow({ audience }: { audience: AudienceExitsRead }) {
  const t = useTranslations("templateExit");
  if (audience.error) return <p className="text-xs text-muted-foreground">{codedErrorMessage(t, audience.error, t("campaign.leftFailed"))}</p>;
  if (!audience.exits) return null;
  if (audience.exits.notReceiving === 0) return <p className="text-xs text-muted-foreground">{t("campaign.leftNone")}</p>;
  return (
    <div className="space-y-0.5 rounded-[--radius] border border-border p-3">
      <p className="text-sm font-medium text-foreground">{t("campaign.leftTitle")}</p>
      <p className="text-xs text-muted-foreground">{t("campaign.left", { count: audience.exits.notReceiving })}</p>
    </div>
  );
}

function TemplateFixes({ templateId, templateName, onUseAnotherTemplate }: { templateId: string; templateName: string; onUseAnotherTemplate: () => void }) {
  const t = useTranslations("templateExit.campaign");
  const { can } = useWorkspace();
  const canUpdateTemplate = can("whatsapp_templates", "update");
  const [defining, setDefining] = useState(false);
  return (
    <div className="space-y-2 pt-1">
      <div className="flex flex-wrap gap-2">
        {canUpdateTemplate ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            title={t("defineOnTemplate")}
            icon={<PencilSimple className="h-3.5 w-3.5" weight="bold" />}
            iconVisible
            iconSide="left"
            onClick={() => setDefining(true)}
          />
        ) : null}
        <Button type="button" variant="secondary" size="sm" title={t("editTemplate")} link={`/dashboard/whatsapp-templates/${templateId}`} />
        <Button type="button" variant="secondary" size="sm" title={t("otherTemplate")} onClick={onUseAnotherTemplate} />
      </div>
      <p className="text-muted-foreground">{t("editNote")}</p>
      {canUpdateTemplate ? <DefineExitOnTemplateDialog open={defining} onOpenChange={setDefining} templateId={templateId} templateName={templateName} /> : null}
    </div>
  );
}

export function CampaignExitSection({
  exit,
  templateName,
  onUseAnotherTemplate,
  numbers = NO_NUMBERS,
}: {
  exit: CampaignExit;
  templateName: string;
  onUseAnotherTemplate: () => void;
  numbers?: readonly string[];
}) {
  const t = useTranslations("templateExit");
  const audience = useAudienceExits(numbers);
  if (!exit.templateId) return null;
  const { verdict } = exit;
  return (
    <ElevatedContainer className="space-y-4 rounded-lg border border-border bg-card p-6" data-tour="wc-lead-exit">
      <h2 className="font-display text-xl font-semibold tracking-[0.01em] text-foreground">{t("campaign.title")}</h2>
      {exit.loading ? <p className="text-sm text-muted-foreground">{t("verdict.loading")}</p> : null}
      {exit.error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-destructive-ink">{codedErrorMessage(t, exit.error, t("verdict.failed"))}</span>
          <Button type="button" variant="secondary" size="sm" title={t("verdict.retry")} onClick={exit.reload} />
        </div>
      ) : null}
      {verdict ? (
        <ExitVerdictNotice verdict={verdict}>
          {verdict.state === "none" ? <TemplateFixes templateId={exit.templateId} templateName={templateName} onUseAnotherTemplate={onUseAnotherTemplate} /> : null}
        </ExitVerdictNotice>
      ) : null}
      <AudienceExitsRow audience={audience} />
      {exit.needed ? <ExitRiskAcknowledgement checked={exit.acknowledged} onCheckedChange={exit.setAcknowledged} /> : null}
      {exit.blocks ? <p className="text-xs text-muted-foreground">{t("campaign.ackNeeded")}</p> : null}
      {verdict ? <CampaignRouteOverrides buttons={verdict.buttons} overrides={exit.overrides} kinds={offeredKinds(ROUTE_KINDS, exit.allowedKinds)} onChange={exit.setOverride} /> : null}
    </ElevatedContainer>
  );
}
