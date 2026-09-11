"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  createAlertRuleAction,
  deleteAlertRuleAction,
  getAlertOptionsAction,
  listAlertRulesAction,
  testAlertRuleAction,
  updateAlertRuleAction,
} from "@/app/actions/audience";
import type {
  AlertChannel,
  AlertChannelStatus,
  AlertMetric,
  AlertRule,
  AlertRuleDraft,
  AlertVocabulary,
} from "@/lib/audience/types";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { listWhatsAppTemplatesAction } from "@/app/actions/whatsapp-templates";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";
import { useWorkspace } from "@/contexts/workspace-context";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { Chip, EmptyState, Panel, Skeleton } from "@/components/audience/shared";
import { Bell, PaperPlaneTilt, Plus, Trash, Warning } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * Configuring the alerts.
 *
 * The screen's job is to make the two things that can go wrong hard to do. It
 * shows the cooldown and the daily cap as first-class settings rather than
 * hiding them behind "avançado", because they are what stops one bad afternoon
 * becoming a hundred WhatsApp messages, and it says out loud that the official
 * channel spends money on a template.
 *
 * The server owns the vocabulary: which metrics exist, whether each needs a
 * window, which way it alarms, and the floors. This file asks for that rather
 * than restating it, so a picker can never describe a metric differently from
 * the evaluator that acts on it.
 */

const LOCALE_TAG: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", de: "de-DE" };

function emptyDraft(accountId: string, limits: AlertVocabulary["limits"] | undefined): AlertRuleDraft {
  return {
    name: "",
    enabled: true,
    accountId,
    metric: "comment_severity",
    threshold: 80,
    windowMinutes: limits?.defaultWindowMinutes ?? 60,
    channel: "unofficial",
    recipient: "",
    brief: false,
    cooldownMinutes: limits?.defaultCooldownMinutes ?? 60,
    maxPerDay: limits?.defaultPerDay ?? 6,
  };
}

function draftOf(rule: AlertRule): AlertRuleDraft {
  return {
    name: rule.name,
    enabled: rule.enabled,
    accountId: rule.accountId,
    metric: rule.metric,
    threshold: rule.threshold,
    windowMinutes: rule.windowMinutes,
    channel: rule.channel,
    recipient: rule.recipient,
    businessPhoneId: rule.businessPhoneId,
    templateId: rule.templateId,
    instanceId: rule.instanceId,
    brief: rule.brief,
    cooldownMinutes: rule.cooldownMinutes,
    maxPerDay: rule.maxPerDay,
  };
}

export function CommentAnalysisAlerts({ accountId }: { accountId: string }) {
  const t = useTranslations("commentAnalysis.alerts");
  const { can } = useWorkspace();
  const canManage = can("audience", "send");
  const locale = useLocale();
  const df = useMemo(
    () => new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? "pt-BR", { dateStyle: "short", timeStyle: "short" }),
    [locale],
  );

  const [rules, setRules] = useState<AlertRule[] | null>(null);
  const [options, setOptions] = useState<AlertVocabulary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string; draft: AlertRuleDraft } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    void listAlertRulesAction(accountId).then((result) => {
      if (result.error) setError(result.error);
      else {
        setError(null);
        setRules(result.rules);
      }
    });
  }, [accountId]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listAlertRulesAction(accountId), getAlertOptionsAction()]).then(([list, opts]) => {
      if (cancelled) return;
      if (list.error) setError(list.error);
      else setRules(list.rules);
      if (opts.options) setOptions(opts.options);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const toggle = async (rule: AlertRule, enabled: boolean) => {
    setRules((prev) => (prev ?? []).map((r) => (r.id === rule.id ? { ...r, enabled } : r)));
    const result = await updateAlertRuleAction(rule.id, { ...draftOf(rule), enabled });
    if (result.error) {
      setError(result.error);
      setRules((prev) => (prev ?? []).map((r) => (r.id === rule.id ? { ...r, enabled: !enabled } : r)));
    }
  };

  const remove = async (rule: AlertRule) => {
    setBusy(rule.id);
    const result = await deleteAlertRuleAction(rule.id);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRules((prev) => (prev ?? []).filter((r) => r.id !== rule.id));
  };

  const test = async (rule: AlertRule) => {
    setBusy(rule.id);
    const result = await testAlertRuleAction(rule.id);
    setBusy(null);
    setError(result.error ?? null);
  };

  // Channels this workspace cannot currently send on. Empty when the backend
  // sent no status list, so a deployment that cannot answer flags nothing
  // rather than flagging everything.
  const blockedChannels = useMemo(
    () =>
      new Set(
        (options?.channelStatus ?? [])
          .filter((s) => !s.available)
          .map((s) => s.channel),
      ),
    [options?.channelStatus],
  );

  return (
    <Panel
      title={t("title")}
      description={t("description")}
      action={
        canManage ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="h-3.5 w-3.5" />}
            title={t("new")}
            onClick={() => setEditing({ draft: emptyDraft(accountId, options?.limits) })}
          />
        ) : undefined
      }
    >
      {error ? (
        <p className="mb-3 flex items-center gap-2 text-xs text-destructive-ink">
          <Warning className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}

      {rules === null ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : rules.length === 0 ? (
        <EmptyState icon={<Bell weight="duotone" />} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li key={rule.id} className="rounded-[--radius] border border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{rule.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t(`metrics.${rule.metric}`, { threshold: rule.threshold, minutes: rule.windowMinutes })}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Chip>{t(`channels.${rule.channel}`)}</Chip>
                    {/* A rule armed on a channel the workspace can no longer
                        send on. Said on the row, because the alternative is
                        finding out from LastError after it failed to fire. */}
                    {rule.enabled && blockedChannels.has(rule.channel) ? (
                      <span className="inline-flex items-center gap-1 rounded-[--radius] bg-muted px-1.5 py-0.5 text-2xs font-semibold text-warning-ink">
                        <Warning className="h-3 w-3" weight="fill" />
                        {t("channelGoneChip")}
                      </span>
                    ) : null}
                    <Chip>{rule.recipient}</Chip>
                    <Chip>{t("cooldownChip", { minutes: rule.cooldownMinutes })}</Chip>
                    <Chip>{t("capChip", { count: rule.maxPerDay })}</Chip>
                    {rule.brief ? <Chip>{t("briefChip")}</Chip> : null}
                  </div>
                  {rule.lastFiredAt ? (
                    <p className="mt-2 text-2xs text-muted-foreground">
                      {t("lastFired", { when: df.format(new Date(rule.lastFiredAt)), count: rule.firedToday })}
                    </p>
                  ) : null}
                  {rule.lastError ? (
                    <p className="mt-1 flex items-center gap-1.5 text-2xs text-destructive-ink">
                      <Warning className="h-3 w-3" /> {t("lastErrorLabel")}: {rule.lastError}
                    </p>
                  ) : null}
                </div>

                {canManage ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <ElevatedSwitch
                      checked={rule.enabled}
                      aria-label={t("enabledLabel")}
                      onCheckedChange={(checked: boolean) => void toggle(rule, checked)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<PaperPlaneTilt className="h-3.5 w-3.5" />}
                      title={t("test")}
                      disabled={busy === rule.id}
                      onClick={() => void test(rule)}
                    />
                    <Button size="sm" variant="ghost" title={t("edit")} onClick={() => setEditing({ id: rule.id, draft: draftOf(rule) })} />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash className="h-3.5 w-3.5" />}
                      title={t("delete")}
                      disabled={busy === rule.id}
                      onClick={() => void remove(rule)}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <AlertRuleDialog
          accountId={accountId}
          options={options}
          ruleId={editing.id}
          initial={editing.draft}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </Panel>
  );
}

function AlertRuleDialog({
  accountId,
  options,
  ruleId,
  initial,
  onClose,
  onSaved,
}: {
  accountId: string;
  options: AlertVocabulary | null;
  ruleId?: string;
  initial: AlertRuleDraft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("commentAnalysis.alerts");
  const [draft, setDraft] = useState<AlertRuleDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metric = options?.metrics.find((m) => m.metric === draft.metric);
  const limits = options?.limits;

  const [phones, setPhones] = useState<WhatsAppBusinessPhone[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const official = draft.channel === "official";

  /*
   * What this workspace can actually send on.
   *
   * The picker used to offer both channels from a hardcoded list while only the
   * OFFICIAL one was validated at save, so a workspace with no connected number
   * could arm an unofficial rule that showed "Regra ativa" and died silently at
   * the first firing. Both halves now read the same source the backend
   * validates against, so the form and the save cannot disagree.
   */
  const channelStatus = options?.channelStatus;
  const statusFor = (c: AlertChannel): AlertChannelStatus | undefined =>
    channelStatus?.find((s) => s.channel === c);
  const currentStatus = statusFor(draft.channel);
  // No status list at all means the deployment could not answer, and the form
  // behaves exactly as it did before rather than blocking every channel.
  const channelBlocked = Boolean(channelStatus?.length) && currentStatus?.available === false;
  const senders = currentStatus?.senders ?? [];
  const unofficialSenders = draft.channel === "unofficial" ? senders : [];

  useEffect(() => {
    if (!official) return;
    let cancelled = false;
    void Promise.all([
      listBusinessPhonesAction({ pageSize: 100 }),
      listWhatsAppTemplatesAction({ pageSize: 100 }),
    ]).then(([p, tpl]) => {
      if (cancelled) return;
      setPhones(p.phones ?? []);
      setTemplates(tpl.templates ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [official]);

  const set = <K extends keyof AlertRuleDraft>(key: K, value: AlertRuleDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    const payload: AlertRuleDraft = { ...draft, accountId };
    const result = ruleId ? await updateAlertRuleAction(ruleId, payload) : await createAlertRuleAction(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  };

  return (
    <ElevatedDialog open onOpenChange={(o) => !o && onClose()}>
      <ElevatedDialogContent className="flex max-h-[85vh] w-full max-w-lg flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <ElevatedDialogTitle>{ruleId ? t("editTitle") : t("newTitle")}</ElevatedDialogTitle>
        </ElevatedDialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <ElevatedInput
            label={t("fields.name")}
            autoFocus
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("fields.namePlaceholder")}
          />

          <div className="grid grid-cols-2 gap-3">
            <ElevatedSelect
              label={t("fields.metric")}
              value={draft.metric}
              onValueChange={(v) => set("metric", v as AlertMetric)}
            >
              {(options?.metrics ?? []).map((m) => (
                <ElevatedSelectItem key={m.metric} value={m.metric}>
                  {t(`metricNames.${m.metric}`)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
            <ElevatedInput
              label={metric?.triggersWhenBelow ? t("fields.thresholdBelow") : t("fields.thresholdAbove")}
              type="number"
              min={0}
              value={String(draft.threshold)}
              onChange={(e) => set("threshold", Number(e.target.value))}
            />
          </div>

          {/* The window only exists for a metric counted over a span. Showing it
              otherwise would be a setting that does nothing. */}
          {metric?.windowed ? (
            <ElevatedInput
              label={t("fields.window")}
              type="number"
              min={limits?.minWindowMinutes ?? 5}
              max={limits?.maxWindowMinutes ?? 1440}
              value={String(draft.windowMinutes ?? limits?.defaultWindowMinutes ?? 60)}
              onChange={(e) => set("windowMinutes", Number(e.target.value))}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <ElevatedSelect
              label={t("fields.channel")}
              value={draft.channel}
              onValueChange={(v) => set("channel", v as AlertChannel)}
            >
              {(options?.channels ?? ["unofficial", "official"]).map((c) => {
                const s = statusFor(c);
                // Offered but disabled, with the reason on the row. Removing it
                // silently would read as a missing feature; a greyed control
                // with no explanation sends people to support instead of to
                // the connect screen.
                const blocked = Boolean(channelStatus?.length) && s?.available === false;
                return (
                  <ElevatedSelectItem
                    key={c}
                    value={c}
                    disabled={blocked}
                    description={
                      blocked
                        ? t(`channelUnavailable.${s?.reason ?? "no_sender"}`)
                        : undefined
                    }
                  >
                    {t(`channels.${c}`)}
                  </ElevatedSelectItem>
                );
              })}
            </ElevatedSelect>
            <ElevatedInput
              label={t("fields.recipient")}
              value={draft.recipient}
              onChange={(e) => set("recipient", e.target.value)}
              placeholder="5511999999999"
            />
          </div>

          {/* The channel cannot send. Said here, once, in words, next to the
              control that caused it — not discovered days later in LastError. */}
          {channelBlocked ? (
            <p className="flex items-start gap-2 rounded-[--radius] bg-muted px-3 py-2 text-2xs text-warning-ink">
              <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />
              <span>{t(`channelUnavailable.${currentStatus?.reason ?? "no_sender"}`)}</span>
            </p>
          ) : null}

          {/* The unofficial channel had no sender picker at all, which is half
              the bug: with several numbers connected, "whichever one this
              workspace has" picked for the operator, silently. */}
          {!official && unofficialSenders.length > 0 ? (
            <ElevatedSelect
              label={t("fields.instance")}
              value={draft.instanceId ?? (unofficialSenders.length === 1 ? unofficialSenders[0].id : "")}
              onValueChange={(v) => set("instanceId", v)}
            >
              {unofficialSenders.map((s) => (
                <ElevatedSelectItem key={s.id} value={s.id}>
                  {s.label}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          ) : null}

          {official ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <ElevatedSelect
                  label={t("fields.businessPhone")}
                  value={draft.businessPhoneId ?? ""}
                  onValueChange={(v) => set("businessPhoneId", v)}
                >
                  {phones.map((p) => (
                    <ElevatedSelectItem key={p.id} value={p.id}>
                      {p.displayPhoneNumber}
                      {p.verifiedName ? ` · ${p.verifiedName}` : ""}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
                <ElevatedSelect
                  label={t("fields.template")}
                  value={draft.templateId ?? ""}
                  onValueChange={(v) => set("templateId", v)}
                >
                  {templates.map((tpl) => (
                    <ElevatedSelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                      {tpl.language ? ` (${tpl.language})` : ""}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
              </div>
              <p className="text-2xs text-warning-ink">
                {t("officialHint", { count: limits?.templateParamCount ?? 4 })}
              </p>
              {options?.facts?.length ? (
                <p className="text-2xs text-muted-foreground">
                  {t("templateVariables", { facts: options.facts.map((f) => `{{${f}}}`).join(", ") })}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Not hidden behind "advanced": these two are what keep one bad
              afternoon from becoming a hundred messages. */}
          <div className="grid grid-cols-2 gap-3">
            <ElevatedInput
              label={t("fields.cooldown")}
              type="number"
              min={limits?.minCooldownMinutes ?? 5}
              max={limits?.maxCooldownMinutes}
              value={String(draft.cooldownMinutes ?? limits?.defaultCooldownMinutes ?? 60)}
              onChange={(e) => set("cooldownMinutes", Number(e.target.value))}
            />
            <ElevatedInput
              label={t("fields.maxPerDay")}
              type="number"
              min={1}
              max={limits?.maxPerDay}
              value={String(draft.maxPerDay ?? limits?.defaultPerDay ?? 6)}
              onChange={(e) => set("maxPerDay", Number(e.target.value))}
            />
          </div>
          <p className="text-2xs text-muted-foreground">
            {t("limitsHint", {
              cooldown: limits?.minCooldownMinutes ?? 5,
              perDay: limits?.maxPerDay ?? 24,
            })}
          </p>

          <label className={cn("flex items-center justify-between gap-3 rounded-[--radius] border border-border px-3 py-2")}>
            <span className="text-sm text-foreground">{t("fields.brief")}</span>
            <ElevatedSwitch checked={draft.brief ?? false} onCheckedChange={(checked: boolean) => set("brief", checked)} />
          </label>
          <p className="text-2xs text-muted-foreground">{t("briefHint")}</p>

          {/* Arming is blocked, turning it OFF never is. Mirrors the backend
              rule exactly: refusing the off switch would trap an operator with
              an alert they cannot disable, which is worse than the bug. */}
          <label className={cn("flex items-center justify-between gap-3 rounded-[--radius] border border-border px-3 py-2")}>
            <span className="text-sm text-foreground">{t("fields.enabled")}</span>
            <ElevatedSwitch
              checked={draft.enabled}
              disabled={channelBlocked && !draft.enabled}
              onCheckedChange={(checked: boolean) => set("enabled", checked)}
            />
          </label>
          {channelBlocked && !draft.enabled ? (
            <p className="text-2xs text-muted-foreground">{t("cannotArmHint")}</p>
          ) : null}

          {error ? (
            <p className="flex items-center gap-2 text-xs text-destructive-ink">
              <Warning className="h-3.5 w-3.5" /> {error}
            </p>
          ) : null}
        </div>

        <ElevatedDialogFooter className="shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button title={t("cancel")} variant="ghost" onClick={onClose} />
          <Button
            title={saving ? t("saving") : t("save")}
            variant="primary"
            disabled={saving || draft.name.trim() === "" || draft.recipient.trim() === ""}
            onClick={() => void save()}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
