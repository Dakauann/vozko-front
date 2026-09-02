"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  cancelCommentBackfillAction,
  estimateCommentBackfillAction,
  getCommentAnalysisSpendAction,
  getCommentBackfillAction,
  startCommentBackfillAction,
  updateCommentAnalysisSettingsAction,
} from "@/app/actions/comment-analysis";
import { getAgentOptionsAction } from "@/app/actions/agents";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { getExchangeRateAction } from "@/app/actions/pricing";
import type {
  BackfillEstimate,
  CommentAnalysisSettings,
  CommentAnalysisSpend,
  CommentBackfill,
  CommentTopic,
  Vertical,
} from "@/lib/comment-analysis/types";
import { MAX_INSTRUCTIONS_LENGTH, VERTICALS } from "@/lib/comment-analysis/types";
import { exchangeRateFromMicros, formatMicrosAsBrl } from "@/lib/pricing/currency";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Panel, Skeleton } from "@/components/instagram/comment-analysis-shared";
import { cleanTopics, editableTopics, TopicsEditor } from "@/components/instagram/comment-analysis-topics-editor";
import { Warning, X } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * Settings (plan §13): on/off, model, vertical, the operator's instructions
 * (free text the classifier reads as context), the topic set editor, the
 * severity threshold, the daily cap, what the feature cost this month, and
 * the backfill launcher. A post can override most of this from its own
 * detail dialog; what is set here is the account-wide default. The backfill
 * is estimated and confirmed before it runs (plan §10): the confirmed number
 * travels back to the API, which refuses a stale one.
 */

const LOCALE_TAG: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", de: "de-DE" };

export function CommentAnalysisSettingsPanel({
  settings,
  onUpdated,
  focusTopics,
}: {
  settings: CommentAnalysisSettings;
  onUpdated: (next: CommentAnalysisSettings) => void;
  /** When true the topic editor scrolls into view (the topics panel's prompt). */
  focusTopics?: boolean;
}) {
  const t = useTranslations("commentAnalysis.settings");
  const tVert = useTranslations("commentAnalysis.enums.vertical");
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_TAG[locale] ?? "pt-BR"), [locale]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [modelPricing, setModelPricing] = useState<ModelPricingInfo[] | undefined>();

  // Draft fields: committed on blur/save so typing a threshold does not
  // fire a request per keystroke.
  const [threshold, setThreshold] = useState(String(settings.severityThreshold));
  const [dailyCap, setDailyCap] = useState(String(settings.dailyCap));
  const [instructions, setInstructions] = useState(settings.instructions ?? "");
  const [topics, setTopics] = useState<CommentTopic[]>(editableTopics(settings.topics));
  const [topicsDirty, setTopicsDirty] = useState(false);
  const topicsRef = useRef<HTMLDivElement>(null);

  // Drafts follow a freshly saved settings object. Adjusted during render
  // (the React "adjust state when a prop changes" pattern) rather than in
  // an effect, so there is no extra commit with stale drafts.
  const [seen, setSeen] = useState(settings);
  if (seen !== settings) {
    setSeen(settings);
    setThreshold(String(settings.severityThreshold));
    setDailyCap(String(settings.dailyCap));
    setInstructions(settings.instructions ?? "");
    setTopics(editableTopics(settings.topics));
    setTopicsDirty(false);
  }

  useEffect(() => {
    let cancelled = false;
    void getAgentOptionsAction().then((res) => {
      if (cancelled || !res.options) return;
      setModels(res.options.messaging ?? []);
      setModelPricing(res.options.modelPricing);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (focusTopics) topicsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusTopics]);

  const patch = useCallback(
    async (changes: Parameters<typeof updateCommentAnalysisSettingsAction>[2]) => {
      setSaving(true);
      const result = await updateCommentAnalysisSettingsAction(settings.source, settings.accountId, changes);
      setSaving(false);
      if (result.error || !result.settings) {
        setError(result.error ?? t("saveFailed"));
        return false;
      }
      setError(null);
      onUpdated(result.settings);
      return true;
    },
    [settings.source, settings.accountId, onUpdated, t],
  );

  const commitNumber = (raw: string, current: number, key: "severityThreshold" | "dailyCap", min: number, max: number) => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n === current) return;
    const clamped = Math.max(min, Math.min(max, n));
    void patch({ [key]: clamped });
  };

  const commitInstructions = () => {
    const next = instructions.trim();
    if (next === (settings.instructions ?? "")) return;
    void patch({ instructions: next });
  };

  const saveTopics = async () => {
    if (await patch({ topics: cleanTopics(topics) })) setTopicsDirty(false);
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p className="flex items-center gap-2 text-xs text-destructive-ink">
          <Warning className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}

      <Panel
        title={t("switch.title")}
        description={t("switch.description")}
        action={
          <ElevatedSwitch
            id="comment-analysis-enabled"
            checked={settings.enabled}
            disabled={saving}
            onCheckedChange={(checked: boolean) => void patch({ enabled: checked })}
            aria-label={t("switch.title")}
          />
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AIModelSelector
            label={t("model.label")}
            value={settings.model ?? ""}
            models={models}
            modelPricing={modelPricing}
            disabled={saving}
            onValueChange={(model) => void patch({ model })}
          />
          <ElevatedSelect label={t("vertical.label")} value={settings.vertical} disabled={saving} onValueChange={(v) => void patch({ vertical: v as Vertical })}>
            {VERTICALS.map((v) => (
              <ElevatedSelectItem key={v} value={v}>
                {tVert(v)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          <ElevatedInput
            label={t("threshold.label")}
            type="number"
            min={1}
            max={100}
            value={threshold}
            disabled={saving}
            onChange={(e) => setThreshold(e.target.value)}
            onBlur={() => commitNumber(threshold, settings.severityThreshold, "severityThreshold", 1, 100)}
          />
          <ElevatedInput
            label={t("dailyCap.label")}
            type="number"
            min={1}
            value={dailyCap}
            disabled={saving}
            onChange={(e) => setDailyCap(e.target.value)}
            onBlur={() => commitNumber(dailyCap, settings.dailyCap, "dailyCap", 1, 1_000_000)}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("threshold.hint")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("dailyCap.hint")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("vertical.hint")}</p>
      </Panel>

      <Panel title={t("instructions.title")} description={t("instructions.description")}>
        <ElevatedTextarea
          label={t("instructions.label")}
          value={instructions}
          maxLength={MAX_INSTRUCTIONS_LENGTH}
          rows={4}
          disabled={saving}
          placeholder={t("instructions.placeholder")}
          onChange={(e) => setInstructions(e.target.value)}
          onBlur={commitInstructions}
        />
        <p className="mt-2 text-2xs text-muted-foreground">{t("instructions.hint", { max: MAX_INSTRUCTIONS_LENGTH })}</p>
      </Panel>

      <div ref={topicsRef}>
        <Panel
          title={t("topics.title")}
          description={t("topics.description")}
          action={<Button size="sm" variant="primary" title={saving ? t("saving") : t("topics.save")} disabled={!topicsDirty || saving} onClick={() => void saveTopics()} />}
        >
          <TopicsEditor
            topics={topics}
            disabled={saving}
            onChange={(next) => {
              setTopics(next);
              setTopicsDirty(true);
            }}
          />
        </Panel>
      </div>

      <SpendPanel accountId={settings.accountId} nf={nf} />

      <BackfillPanel settings={settings} nf={nf} />
    </div>
  );
}

function SpendPanel({ accountId, nf }: { accountId: string; nf: Intl.NumberFormat }) {
  const t = useTranslations("commentAnalysis.settings.spend");
  const locale = useLocale();
  const [spend, setSpend] = useState<CommentAnalysisSpend | null>(null);
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getCommentAnalysisSpendAction(accountId), getExchangeRateAction()]).then(([s, r]) => {
      if (cancelled) return;
      if (s.spend) setSpend(s.spend);
      setRate(exchangeRateFromMicros(r.item?.priceMicros));
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const price = spend ? formatMicrosAsBrl(spend.priceMicros, rate, LOCALE_TAG[locale] ?? "pt-BR") : null;

  return (
    <Panel title={t("title")} description={t("description")}>
      {!spend ? (
        <Skeleton className="h-10" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label={t("comments")} value={nf.format(spend.items)} />
          <Figure label={t("batches")} value={nf.format(spend.batches)} />
          <Figure label={t("tokens")} value={nf.format(spend.promptTokens + spend.completionTokens)} />
          <Figure label={t("surcharge")} value={price ?? t("noSurcharge")} muted={!price} />
        </div>
      )}
      <p className="mt-3 text-2xs text-muted-foreground">{t("hint")}</p>
    </Panel>
  );
}

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("readout font-display text-lg font-semibold tabular-nums", muted ? "text-muted-foreground" : "text-foreground")}>{value}</p>
    </div>
  );
}

function BackfillPanel({ settings, nf }: { settings: CommentAnalysisSettings; nf: Intl.NumberFormat }) {
  const t = useTranslations("commentAnalysis.settings.backfill");
  const tStatus = useTranslations("commentAnalysis.enums.backfillStatus");
  const locale = useLocale();
  const [estimate, setEstimate] = useState<BackfillEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [backfill, setBackfill] = useState<CommentBackfill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    void getExchangeRateAction().then((r) => setRate(exchangeRateFromMicros(r.item?.priceMicros)));
  }, []);

  // Poll a running backfill: it drains a page per minute under the
  // provider's hourly budget, so the progress bar moves slowly and honestly.
  useEffect(() => {
    if (!backfill || backfill.status === "done" || backfill.status === "canceled" || backfill.status === "failed") return;
    const timer = window.setInterval(() => {
      void getCommentBackfillAction(backfill.id).then((r) => {
        if (r.backfill) setBackfill(r.backfill);
      });
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [backfill]);

  const runEstimate = async () => {
    setEstimating(true);
    setError(null);
    const result = await estimateCommentBackfillAction(settings.source, settings.accountId);
    setEstimating(false);
    if (result.error || !result.estimate) {
      setError(result.error ?? t("estimateFailed"));
      return;
    }
    setEstimate(result.estimate);
    setConfirming(true);
  };

  const start = async () => {
    if (!estimate) return;
    const result = await startCommentBackfillAction(settings.source, settings.accountId, estimate.estimatedComments);
    if (result.error || !result.backfill) {
      setError(result.code === "estimate_stale" ? t("estimateStale") : result.code === "backfill_active" ? t("alreadyActive") : (result.error ?? t("startFailed")));
      throw new Error(result.error ?? "start failed");
    }
    setBackfill(result.backfill);
    setEstimate(null);
  };

  const cancel = async () => {
    if (!backfill) return;
    const result = await cancelCommentBackfillAction(backfill.id);
    if (result.error) setError(result.error);
    else if (result.backfill) setBackfill(result.backfill);
  };

  const estimatePrice = estimate ? formatMicrosAsBrl(estimate.estimatedMicros, rate, LOCALE_TAG[locale] ?? "pt-BR") : null;
  const active = backfill && (backfill.status === "pending" || backfill.status === "running");

  return (
    <Panel
      title={t("title")}
      description={t("description")}
      action={
        <Button
          size="sm"
          variant="secondary"
          title={estimating ? t("estimating") : t("estimate")}
          disabled={!settings.enabled || estimating || !!active}
          onClick={() => void runEstimate()}
        />
      }
    >
      {!settings.enabled ? <p className="text-xs text-muted-foreground">{t("disabledHint")}</p> : null}
      {error ? (
        <p className="mb-2 flex items-center gap-2 text-xs text-destructive-ink">
          <Warning className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}
      {backfill ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">{tStatus(backfill.status)}</span>
            <span className="tabular-nums text-muted-foreground">
              {t("progress", { fetched: nf.format(backfill.fetched), estimated: nf.format(backfill.estimatedComments) })}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.round(backfill.progress * 100)}%` }} />
          </div>
          {backfill.error ? <p className="text-xs text-destructive-ink">{backfill.error}</p> : null}
          {backfill.status === "done" && backfill.fetched < backfill.estimatedComments ? (
            <p className="text-xs text-muted-foreground">
              {t("shortfall", { missing: nf.format(backfill.estimatedComments - backfill.fetched) })}
            </p>
          ) : null}
          {active ? <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} title={t("cancel")} onClick={() => void cancel()} /> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="default"
        title={t("confirmTitle")}
        description={
          estimate
            ? t("confirmDescription", {
                comments: nf.format(estimate.estimatedComments),
                containers: nf.format(estimate.containers),
                price: estimatePrice ?? t("tokenBillingOnly"),
              })
            : ""
        }
        confirmLabel={t("confirm")}
        cancelLabel={t("cancelDialog")}
        confirmDisabled={!estimate || estimate.estimatedComments === 0}
        onConfirm={start}
      />
    </Panel>
  );
}
