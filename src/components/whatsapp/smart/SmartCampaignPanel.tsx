"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { getSmartCampaignAction, removeSmartCampaignAction, saveSmartCampaignAction } from "@/app/actions/whatsapp-campaign-smart";
import { cn } from "@/lib/utils";
import {
  canSaveSmartPolicy,
  failureShare,
  holdRules,
  readShare,
  type SmartCampaignView,
  type SmartDecision,
  type SmartFinding,
  type SmartPolicy,
  type SmartWave,
} from "@/lib/whatsapp-campaigns/smart";

import { SmartPolicyEditor } from "./SmartPolicyEditor";
import { SmartSendBadge } from "./SmartSendArt";
import { useSmartText } from "./use-smart-text";

function drivers(decision: SmartDecision): SmartFinding[] {
  if (decision.action === "pause" || decision.action === "stop") return holdRules(decision);
  return (decision.findings ?? []).filter((finding) => finding.action === decision.action);
}

function SmartStatus({ view }: { view: SmartCampaignView }) {
  const { t, phaseText, ruleText } = useSmartText();
  if (!view.policy) return <p className="text-sm text-muted-foreground">{t("off")}</p>;
  const { progress } = view;
  const held = progress.phase === "held";
  const reasons = progress.reason ? drivers(progress.reason) : [];
  return (
    <div
      role="status"
      className={cn(
        "space-y-1 rounded-[--radius] border px-3 py-2 text-sm",
        held ? "border-warning bg-warning text-warning-foreground" : "border-border bg-muted text-foreground",
      )}
    >
      <p className="font-medium">{phaseText(progress)}</p>
      {reasons.map((finding) => (
        <p key={finding.rule} className="text-xs">
          {ruleText(finding)}
        </p>
      ))}
    </div>
  );
}

function WaveTimeline({ waves }: { waves: SmartWave[] }) {
  const { t, percent, ruleText } = useSmartText();
  if (waves.length === 0) return <p className="text-sm text-muted-foreground">{t("noWaves")}</p>;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{t("waves")}</h3>
      <ol className="relative space-y-3 border-l border-border pl-5">
        {[...waves].reverse().map((wave) => (
          <li key={wave.number} className="relative">
            <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border border-border bg-card" aria-hidden />
            <p className="text-sm text-foreground">
              <span className="font-medium">{t("wave", { number: wave.number })}</span>
              <span className="text-muted-foreground"> {t("waveSize", { count: wave.size })} </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t(`waveState.${wave.state}`)}</span>
            </p>
            <p className="readout text-xs tabular-nums text-muted-foreground">
              {t("waveStats", { processed: wave.outcome.processed, failed: percent(failureShare(wave.outcome)), read: percent(readShare(wave.outcome)) })}
            </p>
            {wave.state === "decided" ? (
              <p className="text-xs text-foreground">
                {t(`decision.${wave.decision.action}`)}
                {drivers(wave.decision).map((finding) => (
                  <span key={finding.rule} className="text-muted-foreground">
                    {" "}
                    ({ruleText(finding)})
                  </span>
                ))}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SmartCampaignPanel({ campaignId, contacts, refreshToken }: { campaignId: string; contacts: number; refreshToken: unknown }) {
  const { t } = useSmartText();
  const [view, setView] = useState<SmartCampaignView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SmartPolicy | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getSmartCampaignAction(campaignId).then((result) => {
      if (!active) return;
      setLoadError(result.error);
      if (result.view) setView(result.view);
    });
    return () => {
      active = false;
    };
  }, [campaignId, refreshToken]);

  const editing = draft !== undefined;
  const canSave = draft === null || (draft !== undefined && canSaveSmartPolicy(draft));

  const save = async () => {
    if (draft === undefined || !canSave) return;
    setSaving(true);
    const result = draft === null ? await removeSmartCampaignAction(campaignId) : await saveSmartCampaignAction(campaignId, draft);
    setSaving(false);
    if (result.error || !result.view) {
      toast.error(t("toast.error"), { description: result.error ?? undefined });
      return;
    }
    setView(result.view);
    setDraft(undefined);
    toast(draft === null ? t("toast.removed") : t("toast.saved"));
  };

  return (
    <ElevatedContainer className="space-y-4 rounded-lg border border-border bg-card p-6" data-tour="wd-smart">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <SmartSendBadge className="text-primary" />
          <div className="min-w-0 space-y-1">
            <h2 className="font-display text-xl font-semibold tracking-[0.01em] text-foreground">{t("brand")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        {view?.editable && !editing ? (
          <Button type="button" variant="secondary" size="sm" title={t("edit")} onClick={() => setDraft(view.policy)} />
        ) : null}
      </div>

      {loadError && !view ? <p role="alert" className="text-sm text-destructive-ink">{loadError}</p> : null}

      {view && editing ? (
        <div className="space-y-4">
          <SmartPolicyEditor value={draft} defaults={view.defaults} onChange={setDraft} contacts={contacts} disabled={saving} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" title={t("save")} onClick={save} disabled={saving || !canSave} />
            <Button type="button" variant="ghost" size="sm" title={t("cancel")} onClick={() => setDraft(undefined)} disabled={saving} />
          </div>
        </div>
      ) : null}

      {view && !editing ? <SmartStatus view={view} /> : null}
      {view && !view.editable && view.policy ? <p className="text-xs text-muted-foreground">{t("locked")}</p> : null}
      {view?.policy ? <WaveTimeline waves={view.waves} /> : null}
    </ElevatedContainer>
  );
}
