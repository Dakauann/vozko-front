"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import Button from "@/components/elevated-design/button";
import { CircuitRoutes } from "@/components/elevated-design/circuit-routes";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { Notice } from "@/components/ui/notice";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { PromptStats } from "@/lib/choice-stats/stats";
import {
  BUTTON_ACTION_KINDS,
  actionInputs,
  choicesOf,
  isExitKind,
  offeredKinds,
  seenTexts,
  type ButtonChoices,
  type ExitVerdict,
  type TemplateActionsChange,
  type TemplateButtonActions,
} from "@/lib/whatsapp-templates/exit";

import { ButtonActionFields } from "./ButtonActionFields";
import { FIELD_ANCHOR, QuickReplyChip, RouteCard } from "./ButtonRoutePieces";
import { ButtonDestinations, QuickReplyCtr } from "./ButtonDestinations";
import { ExitConfirmationField } from "./ExitConfirmationField";
import { ExitReadFailure } from "./ExitReadFailure";
import { ExitVerdictNotice } from "./ExitVerdictNotice";
import { useButtonActionLabel } from "./use-button-action-label";
import { useTemplateButtonActions, useTemplateExitVerdict, type TemplateActionsSave } from "./use-template-exit";

type PanelNotice = { tone: "warning" | "fault"; text: string } | null;
type VerdictRead = ReturnType<typeof useTemplateExitVerdict>;

function ReadOnlyExit({ stored, clicks }: { stored: TemplateButtonActions; clicks: PromptStats | null }) {
  const t = useTranslations("templateExit");
  return (
    <div className="space-y-3">
      <ButtonDestinations buttons={stored.buttons} clicks={clicks} />
      <p className="text-xs text-muted-foreground">{t("panel.readOnly")}</p>
    </div>
  );
}

function StaleAction({ savedText, currentText, confirmed, onConfirm }: { savedText: string; currentText: string; confirmed: boolean; onConfirm: () => void }) {
  const t = useTranslations("templateExit");
  if (confirmed) return <p className="text-xs text-muted-foreground">{t("action.reconfirmed", { text: currentText })}</p>;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-warning-ink">{t("action.stale")}</p>
      {savedText ? <p className="text-xs text-muted-foreground">{t("action.savedFor", { text: savedText })}</p> : null}
      <Button type="button" variant="secondary" size="sm" title={t("action.reconfirm")} onClick={onConfirm} />
    </div>
  );
}

function choosesAnExit(choices: ButtonChoices): boolean {
  return Object.values(choices).some((choice) => choice !== null && isExitKind(choice.kind));
}

function TemplateExitEditor({
  stored,
  verdict,
  onSave,
  onNotice,
  clicks,
}: {
  clicks: PromptStats | null;
  stored: TemplateButtonActions;
  verdict: ExitVerdict | null;
  onSave: (change: TemplateActionsChange) => Promise<TemplateActionsSave>;
  onNotice: (notice: PanelNotice) => void;
}) {
  const t = useTranslations("templateExit");
  const labelOf = useButtonActionLabel();
  const [choices, setChoices] = useState<ButtonChoices>(() => choicesOf(stored.actions));
  const [confirmed, setConfirmed] = useState<ReadonlySet<number>>(() => new Set());
  const confirm = (index: number) => setConfirmed((current) => new Set(current).add(index));
  const [confirmation, setConfirmation] = useState(stored.exitConfirmation);
  const [saving, setSaving] = useState(false);
  const exitShown = verdict?.state === "ok" || choosesAnExit(choices);

  const save = async () => {
    setSaving(true);
    onNotice(null);
    try {
      const shown = seenTexts(stored.buttons, stored.actions, confirmed);
      const result = await onSave({ actions: actionInputs(choices, shown), exitConfirmation: confirmation });
      if (result.status === "saved") toast.success(t("panel.saved"));
      if (result.status === "conflict") onNotice({ tone: "warning", text: t("panel.conflict") });
      if (result.status === "failed") onNotice({ tone: "fault", text: codedErrorMessage(t, { code: result.error.code }, t("panel.failed")) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {stored.buttons.length === 0 ? <p className="text-xs text-muted-foreground">{t("panel.noQuickReplies")}</p> : null}
      {stored.buttons.length > 0 ? (
        <CircuitRoutes
          label={t("campaign.destinations")}
          headings={{ source: t("campaign.columnButton"), target: t("campaign.columnAction") }}
          routes={stored.buttons.map((button) => {
            const choice = choices[button.index] ?? null;
            const stale = button.stale && !confirmed.has(button.index);
            return {
              key: button.index,
              name: t("campaign.destination", { text: button.text, action: labelOf(choice) }),
              state: stale ? "stale" : choice ? "linked" : "open",
              targetAnchor: button.stale ? undefined : FIELD_ANCHOR,
              source: <QuickReplyChip text={button.text} stale={stale} stat={clicks ? <QuickReplyCtr clicks={clicks} index={button.index} /> : undefined} />,
              target: (
                <RouteCard>
                  {button.stale ? (
                    <StaleAction
                      savedText={stored.actions.find((action) => action.buttonIndex === button.index)?.buttonText ?? ""}
                      currentText={button.text}
                      confirmed={confirmed.has(button.index)}
                      onConfirm={() => confirm(button.index)}
                    />
                  ) : null}
                  <ButtonActionFields
                    value={choice}
                    kinds={offeredKinds(BUTTON_ACTION_KINDS, stored.allowedKinds)}
                    onChange={(next) => {
                      confirm(button.index);
                      setChoices((current) => ({ ...current, [button.index]: next }));
                    }}
                  />
                </RouteCard>
              ),
            };
          })}
        />
      ) : null}
      {exitShown ? <ExitConfirmationField value={confirmation} onChange={setConfirmation} /> : null}
      <div className="flex justify-end">
        <Button type="button" variant="primary" title={saving ? t("panel.saving") : t("panel.save")} disabled={saving} onClick={() => void save()} />
      </div>
    </div>
  );
}

function PanelVerdict({ read }: { read: VerdictRead }) {
  const t = useTranslations("templateExit");
  const { verdict, loading, error, reload } = read;
  if (loading) return <p className="text-xs text-muted-foreground">{t("verdict.loading")}</p>;
  if (error) return <ExitReadFailure error={error} fallback={t("verdict.failed")} onRetry={reload} />;
  if (!verdict) return null;
  const none = verdict.state === "none";
  const creationGated = none && verdict.templateExitRequired !== false;
  const sendsGated = none && verdict.campaignAcknowledgementRequired !== false;
  return (
    <ExitVerdictNotice verdict={verdict} quiet={!creationGated} title={creationGated ? t("verdict.marketingNone") : undefined}>
      {sendsGated ? <p className="text-muted-foreground">{t("verdict.sendsNeedAck")}</p> : null}
    </ExitVerdictNotice>
  );
}

export function TemplateExitPanel({ templateId, canEdit, clicks = null }: { templateId: string; canEdit: boolean; clicks?: PromptStats | null }) {
  const t = useTranslations("templateExit");
  const exit = useTemplateButtonActions(templateId);
  const verdictRead = useTemplateExitVerdict(templateId);
  const [notice, setNotice] = useState<PanelNotice>(null);
  const stored = exit.actions;

  return (
    <ElevatedContainer className="space-y-4 p-6">
      <div>
        <h2 className="font-display text-base font-semibold tracking-[0.01em] text-foreground">{t("panel.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("panel.description")}</p>
      </div>
      <PanelVerdict read={verdictRead} />
      {notice ? (
        <Notice tone={notice.tone}>
          <p>{notice.text}</p>
        </Notice>
      ) : null}
      {exit.loading ? <p className="text-xs text-muted-foreground">{t("verdict.loading")}</p> : null}
      {exit.error ? <ExitReadFailure error={exit.error} fallback={t("panel.loadFailed")} onRetry={exit.reload} /> : null}
      {stored && canEdit ? <TemplateExitEditor key={stored.version} stored={stored} verdict={verdictRead.verdict} onSave={exit.save} onNotice={setNotice} clicks={clicks} /> : null}
      {stored && !canEdit ? <ReadOnlyExit stored={stored} clicks={clicks} /> : null}
    </ElevatedContainer>
  );
}
