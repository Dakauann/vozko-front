"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CircleNotch, FloppyDisk, Sliders } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { RadioGroup } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { ChoiceRow } from "@/components/elevated-design/choice-row";
import { ElevatedSwitch as Switch } from "@/components/elevated-design/elevated-switch";
import { RetryNotice } from "@/components/elevated-design/retry-notice";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import type { ExplainerId } from "@/components/explainers/catalog";
import { updateWorkspaceConfigAction } from "@/app/actions/workspace-config";
import { memberDisplayName, useAssignableMembers } from "@/hooks/use-assignable-members";
import {
  ROULETTE_DEFAULTS,
  ROULETTE_LIMITS,
  ROULETTE_STRATEGIES,
  maxOpenOf,
  recipientsOf,
  sameRecipients,
  withRecipient,
} from "@/lib/workspace/workspace-config/roulette";
import type {
  RouletteMode,
  RouletteRecipient,
  RouletteStrategy,
  WorkspaceConfig,
} from "@/lib/workspace/workspace-config/types";
import { cn } from "@/lib/utils";

export const STRATEGY_EXPLAINERS: Record<RouletteStrategy, ExplainerId> = {
  round_robin: "settings.rouletteRoundRobin",
  priority: "settings.roulettePriority",
  weighted: "settings.rouletteWeighted",
  least_busy: "settings.rouletteLeastBusy",
  longest_idle: "settings.rouletteLongestIdle",
  random: "settings.rouletteRandom",
  claim: "settings.rouletteClaim",
};

const MODE_EXPLAINERS: Record<RouletteMode, ExplainerId> = {
  online: "settings.rouletteOnline",
  last_seen: "settings.rouletteLastSeen",
};

const MODE_TEXT: Record<RouletteMode, { label: string; hint: string }> = {
  online: { label: "roulette.onlineLabel", hint: "roulette.onlineHint" },
  last_seen: { label: "roulette.lastSeenLabel", hint: "roulette.lastSeenHint" },
};

const numberInputClass =
  "w-24 rounded-[--radius] border border-control-edge bg-card px-3 py-1.5 text-sm tabular-nums text-foreground outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60";

type ConfigProps = {
  workspaceId: string;
  config: WorkspaceConfig | null;
  onConfigChange: (config: WorkspaceConfig) => void;
};

export function SettingsSection({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  const titleId = React.useId();
  return (
    <section aria-labelledby={titleId} className="space-y-3 border-t border-border pt-5 first:border-t-0 first:pt-1">
      <header>
        <h3 id={titleId} className="font-display text-base font-semibold leading-tight tracking-[-0.01em] text-foreground">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </header>
      {children}
    </section>
  );
}

export function SettingRow({
  label,
  hint,
  explainer,
  control,
  muted,
}: {
  label: string;
  hint?: string;
  explainer?: ExplainerId;
  control: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3", muted && "opacity-60")}>
      <div className="min-w-0 max-w-[60ch] flex-[1_1_16rem]">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {explainer ? <ExplainerHint id={explainer} /> : null}
        </div>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{control}</div>
    </div>
  );
}

function OptionSettingsPanel({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[--radius] border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2">
        <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold text-foreground">{title}</p>
      </div>
      <div className="px-4">{children}</div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-4 py-2.5">{footer}</div>
      ) : null}
    </div>
  );
}

function SaveButton({ saving, disabled, onClick }: { saving: boolean; disabled: boolean; onClick: () => void }) {
  const t = useTranslations("workspaceSettings");
  return (
    <Button size="sm" onClick={onClick} disabled={disabled || saving}>
      {saving ? (
        <CircleNotch weight="bold" className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <FloppyDisk weight="fill" className="mr-1.5 h-4 w-4" />
      )}
      {t("roulette.save")}
    </Button>
  );
}

function ChoiceGrid<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
  text,
  explainers,
}: {
  label: string;
  value: T;
  options: readonly T[];
  disabled: boolean;
  onChange: (next: T) => void;
  text: (option: T) => { label: string; hint: string };
  explainers: Record<T, ExplainerId>;
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => onChange(next as T)}
      disabled={disabled}
      className="gap-2 sm:grid-cols-2"
    >
      {options.map((option) => {
        const copy = text(option);
        return (
          <ChoiceRow
            key={option}
            value={option}
            title={copy.label}
            hint={copy.hint}
            disabled={disabled}
            aside={<ExplainerHint id={explainers[option]} className="-my-1 h-5 w-5" />}
          />
        );
      })}
    </RadioGroup>
  );
}

export function RouletteModePicker({
  mode,
  disabled,
  onPick,
}: {
  mode: RouletteMode;
  disabled: boolean;
  onPick: (next: RouletteMode) => void;
}) {
  const t = useTranslations("workspaceSettings");
  return (
    <ChoiceGrid
      label={t("roulette.modeLabel")}
      value={mode}
      options={["online", "last_seen"] as const}
      disabled={disabled}
      onChange={onPick}
      text={(option) => ({ label: t(MODE_TEXT[option].label), hint: t(MODE_TEXT[option].hint) })}
      explainers={MODE_EXPLAINERS}
    />
  );
}

export function RouletteStrategyPicker({
  strategy,
  disabled,
  onPick,
}: {
  strategy: RouletteStrategy;
  disabled: boolean;
  onPick: (next: RouletteStrategy) => void;
}) {
  const t = useTranslations("workspaceSettings");
  return (
    <ChoiceGrid
      label={t("roulette.strategyLabel")}
      value={strategy}
      options={ROULETTE_STRATEGIES}
      disabled={disabled}
      onChange={onPick}
      text={(option) => ({
        label: t(`roulette.strategies.${option}.label`),
        hint: t(`roulette.strategies.${option}.hint`),
      })}
      explainers={STRATEGY_EXPLAINERS}
    />
  );
}

function boundNumber(raw: string, limits: { min: number; max: number }, fallback: number): number {
  const n = Math.round(Number(raw));
  if (raw.trim() === "" || !Number.isFinite(n)) return fallback;
  return Math.min(limits.max, Math.max(limits.min, n));
}

export function RouletteLastSeenSettings({ workspaceId, config, onConfigChange }: ConfigProps) {
  const t = useTranslations("workspaceSettings");
  const saved = {
    window: config?.rouletteLastSeenWindowHours ?? ROULETTE_DEFAULTS.windowHours,
    rescueOn: config?.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled,
    rescueMinutes: config?.rouletteRescueAfterMinutes ?? ROULETTE_DEFAULTS.rescueMinutes,
  };
  const [windowHours, setWindowHours] = React.useState(String(saved.window));
  const [rescueOn, setRescueOn] = React.useState(saved.rescueOn);
  const [rescueMinutes, setRescueMinutes] = React.useState(String(saved.rescueMinutes));
  const [saving, setSaving] = React.useState(false);

  const next = {
    window: boundNumber(windowHours, ROULETTE_LIMITS.window, ROULETTE_DEFAULTS.windowHours),
    rescueMinutes: boundNumber(rescueMinutes, ROULETTE_LIMITS.rescue, ROULETTE_DEFAULTS.rescueMinutes),
  };
  const dirty = next.window !== saved.window || rescueOn !== saved.rescueOn || next.rescueMinutes !== saved.rescueMinutes;

  const handleSave = async () => {
    setWindowHours(String(next.window));
    setRescueMinutes(String(next.rescueMinutes));
    setSaving(true);
    const result = await updateWorkspaceConfigAction(workspaceId, {
      rouletteLastSeenWindowHours: next.window,
      rouletteRescueEnabled: rescueOn,
      rouletteRescueAfterMinutes: next.rescueMinutes,
    });
    setSaving(false);
    if (result.error || !result.config) {
      toast.error(result.error ?? t("roulette.saveError"));
      return;
    }
    onConfigChange(result.config);
    toast.success(t("roulette.saveSuccess"));
  };

  return (
    <OptionSettingsPanel
      title={t("roulette.optionSettings", { name: t("roulette.lastSeenLabel") })}
      footer={<SaveButton saving={saving} disabled={!dirty || !config} onClick={handleSave} />}
    >
      <div className="divide-y divide-border">
        <SettingRow
          label={t("roulette.windowLabel")}
          hint={t("roulette.windowHint")}
          control={
            <>
              <input
                type="number"
                min={ROULETTE_LIMITS.window.min}
                max={ROULETTE_LIMITS.window.max}
                value={windowHours}
                onChange={(e) => setWindowHours(e.target.value)}
                aria-label={t("roulette.windowLabel")}
                className={numberInputClass}
              />
              <span className="text-xs text-muted-foreground">{t("roulette.hoursUnit")}</span>
            </>
          }
        />
        <SettingRow
          label={t("roulette.rescueLabel")}
          hint={t("roulette.rescueHint")}
          explainer="settings.rouletteRescue"
          control={<Switch checked={rescueOn} onCheckedChange={setRescueOn} aria-label={t("roulette.rescueLabel")} />}
        />
        <SettingRow
          label={t("roulette.rescueMinutesLabel")}
          hint={t("roulette.rescueMinutesHint")}
          muted={!rescueOn}
          control={
            <>
              <input
                type="number"
                min={ROULETTE_LIMITS.rescue.min}
                max={ROULETTE_LIMITS.rescue.max}
                value={rescueMinutes}
                disabled={!rescueOn}
                onChange={(e) => setRescueMinutes(e.target.value)}
                aria-label={t("roulette.rescueMinutesLabel")}
                className={numberInputClass}
              />
              <span className="text-xs text-muted-foreground">{t("roulette.minutesUnit")}</span>
            </>
          }
        />
      </div>
    </OptionSettingsPanel>
  );
}

export function RouletteRecipientsEditor({
  workspaceId,
  config,
  strategy,
  pending,
  onConfigChange,
  onSaved,
}: ConfigProps & {
  strategy: "priority" | "weighted";
  pending: boolean;
  onSaved: () => void;
}) {
  const t = useTranslations("workspaceSettings");
  const { members, pending: loading, failed, reload } = useAssignableMembers(true);
  const [draft, setDraft] = React.useState<RouletteRecipient[]>(() => recipientsOf(config));
  const [query, setQuery] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const field = strategy === "priority" ? "tier" : "weight";
  const limits = ROULETTE_LIMITS[field];
  const fieldLabel = t(field === "tier" ? "roulette.recipients.tierLabel" : "roulette.recipients.weightLabel");
  const chosen = new Map(draft.map((r) => [r.userId, r]));
  const known = new Set(members.map((m) => m.userId));
  const term = query.trim().toLowerCase();
  const shown = members.filter(
    (m) => !term || memberDisplayName(m).toLowerCase().includes(term) || (m.email ?? "").toLowerCase().includes(term),
  );
  const departed = loading || failed ? [] : draft.filter((r) => !known.has(r.userId));
  const dirty = pending || !sameRecipients(draft, recipientsOf(config));

  const setField = (userId: string, raw: string) =>
    setDraft((list) => withRecipient(list, userId, field === "tier" ? { tier: Number(raw) } : { weight: Number(raw) }));

  const handleSave = async () => {
    setSaving(true);
    const result = await updateWorkspaceConfigAction(workspaceId, {
      rouletteRecipients: draft,
      ...(pending ? { rouletteStrategy: strategy } : {}),
    });
    setSaving(false);
    if (result.error || !result.config) {
      toast.error(t("roulette.recipients.saveError"));
      return;
    }
    onConfigChange(result.config);
    onSaved();
    toast.success(t("roulette.saveSuccess"));
  };

  return (
    <OptionSettingsPanel
      title={t("roulette.optionSettings", { name: t(`roulette.strategies.${strategy}.label`) })}
      footer={
        <>
          {draft.length === 0 ? <span className="text-2xs text-muted-foreground">{t("roulette.recipients.needOne")}</span> : null}
          <SaveButton saving={saving} disabled={!dirty || !config || draft.length === 0} onClick={handleSave} />
        </>
      }
    >
      <div className="space-y-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
          <div className="min-w-0 max-w-[60ch] flex-[1_1_16rem]">
            <p className="text-sm font-medium text-foreground">{t("roulette.recipients.title")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t(strategy === "priority" ? "roulette.recipients.hintPriority" : "roulette.recipients.hintWeighted")}
            </p>
          </div>
          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
            {t("roulette.recipients.selected", { count: draft.length })}
          </span>
        </div>

        {pending ? (
          <Notice tone="info">
            {t("roulette.recipients.pending", { name: t(`roulette.strategies.${strategy}.label`) })}
          </Notice>
        ) : null}

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("roulette.recipients.search")}
          aria-label={t("roulette.recipients.search")}
          className="w-full rounded-[--radius] border border-control-edge bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />

        {failed ? (
          <RetryNotice message={t("roulette.recipients.loadError")} retryLabel={t("roulette.recipients.retry")} onRetry={reload} />
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-[--radius] border border-border">
            {loading ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">{t("roulette.recipients.loading")}</li>
            ) : shown.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">{t("roulette.recipients.empty")}</li>
            ) : (
              shown.map((member) => {
                const name = memberDisplayName(member);
                const recipient = chosen.get(member.userId);
                const departments = (member.departments ?? []).map((d) => d.name).join(", ");
                return (
                  <li key={member.userId} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      checked={Boolean(recipient)}
                      onCheckedChange={(on) => setDraft((list) => withRecipient(list, member.userId, on === true ? {} : null))}
                      aria-label={t("roulette.recipients.include", { name })}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{name}</p>
                      {departments ? <p className="truncate text-2xs text-muted-foreground">{departments}</p> : null}
                    </div>
                    {recipient ? (
                      <label className="flex shrink-0 items-center gap-1.5 text-2xs text-muted-foreground">
                        {fieldLabel}
                        <input
                          type="number"
                          min={limits.min}
                          max={limits.max}
                          value={recipient[field]}
                          onChange={(e) => setField(member.userId, e.target.value)}
                          aria-label={t("roulette.recipients.fieldFor", { field: fieldLabel, name })}
                          className={cn(numberInputClass, "w-16 px-2 py-1")}
                        />
                      </label>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        )}

        {departed.length > 0 ? (
          <Notice tone="warning">
            <span className="flex flex-wrap items-center gap-2">
              {t("roulette.recipients.departed", { count: departed.length })}
              <Button size="sm" variant="outline" onClick={() => setDraft((list) => list.filter((r) => known.has(r.userId)))}>
                {t("roulette.recipients.removeDeparted")}
              </Button>
            </span>
          </Notice>
        ) : null}
      </div>
    </OptionSettingsPanel>
  );
}

export function RouletteCapacityRow({ workspaceId, config, onConfigChange }: ConfigProps) {
  const t = useTranslations("workspaceSettings");
  const saved = maxOpenOf(config);
  const [value, setValue] = React.useState(saved === 0 ? "" : String(saved));
  const [saving, setSaving] = React.useState(false);
  const next = boundNumber(value, ROULETTE_LIMITS.maxOpen, 0);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateWorkspaceConfigAction(workspaceId, { rouletteMaxOpenPerMember: next });
    setSaving(false);
    if (result.error || !result.config) {
      toast.error(t("roulette.saveError"));
      return;
    }
    onConfigChange(result.config);
    toast.success(t("roulette.saveSuccess"));
  };

  return (
    <SettingRow
      label={t("roulette.capacity.label")}
      hint={t("roulette.capacity.hint")}
      explainer="settings.rouletteCapacity"
      control={
        <>
          <input
            type="number"
            min={ROULETTE_LIMITS.maxOpen.min}
            max={ROULETTE_LIMITS.maxOpen.max}
            value={value}
            placeholder={t("roulette.capacity.none")}
            onChange={(e) => setValue(e.target.value)}
            aria-label={t("roulette.capacity.label")}
            className={cn(numberInputClass, "w-28")}
          />
          <span className="text-xs text-muted-foreground">{t("roulette.capacity.unit")}</span>
          {next !== saved ? <SaveButton saving={saving} disabled={!config} onClick={handleSave} /> : null}
        </>
      }
    />
  );
}
