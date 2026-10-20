"use client";

import * as React from "react";
import {
  ChatCircleDots,
  CheckCircle,
  CircleNotch,
  FloppyDisk,
  Clock,
  Warning,
  UsersThree,
} from "@/components/icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ElevatedSwitch as Switch } from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import type {
  RouletteMode,
  RouletteStrategy,
  WorkspaceConfig,
} from "@/lib/workspace/workspace-config/types";
import {
  ROULETTE_DEFAULTS,
  choosesFromRecipients,
  maxOpenOf,
  recipientsOf,
  rouletteStrategyOf,
} from "@/lib/workspace/workspace-config/roulette";
import {
  RouletteCapacityRow,
  RouletteLastSeenSettings,
  RouletteModePicker,
  RouletteRecipientsEditor,
  RouletteStrategyPicker,
  SettingRow,
  SettingsSection,
} from "@/components/dashboard/workspace/RouletteStrategySettings";
import { updateWorkspaceConfigAction } from "@/app/actions/workspace-config";
import { WorkingHoursEditor } from "@/components/dashboard/working-hours/WorkingHoursEditor";
import { useWorkingHoursSummary } from "@/components/dashboard/working-hours/use-working-hours-summary";
import { OutcomeCaptureCard } from "@/components/dashboard/workspace/OutcomeCaptureCard";
import { ConfigCardShell } from "@/components/dashboard/workspace/ConfigCardShell";
import {
  validateWorkingHours,
  type WorkingHoursSpec,
} from "@/lib/working-hours/types";
import { cn } from "@/lib/utils";

type WorkspaceConfigTabProps = {
  workspaceId: string;
  config: WorkspaceConfig | null;
  onConfigChange: (config: WorkspaceConfig) => void;
};

export function WorkspaceConfigTab({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const t = useTranslations("workspaceSettings");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {t("tabs.config")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground max-w-2xl">
          {t("configTab.description")}
        </p>
      </div>

      <section className="space-y-3">
        <p className="text-2xs font-semibold text-muted-foreground">
          {t("configTab.sections.attendance")}
        </p>
        <DistributionConfigCard
          workspaceId={workspaceId}
          config={config}
          onConfigChange={onConfigChange}
        />
        <OutcomeCaptureConfigCard
          workspaceId={workspaceId}
          config={config}
          onConfigChange={onConfigChange}
        />
        <WorkingHoursConfigCard
          workspaceId={workspaceId}
          config={config}
          onConfigChange={onConfigChange}
        />
        <AutoCloseConfigCard
          workspaceId={workspaceId}
          config={config}
          onConfigChange={onConfigChange}
        />
      </section>
    </div>
  );
}


function DistributionConfigCard({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const t = useTranslations("workspaceSettings");
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [pendingStrategy, setPendingStrategy] = React.useState<RouletteStrategy | null>(null);

  const adminsReceive = !(config?.skipAdminAssignment ?? false);
  const mode = config?.rouletteMode ?? ROULETTE_DEFAULTS.mode;
  const savedStrategy = rouletteStrategyOf(config);
  const strategy = pendingStrategy ?? savedStrategy;

  const handleToggle = async (checked: boolean) => {
    if (!config) return;
    const skipValue = !checked;
    setSaving(true);
    onConfigChange({ ...config, skipAdminAssignment: skipValue });
    const result = await updateWorkspaceConfigAction(workspaceId, {
      skipAdminAssignment: skipValue,
    });
    if (result.error) {
      onConfigChange({ ...config, skipAdminAssignment: !skipValue });
      toast.error(result.error);
    } else if (result.config) {
      onConfigChange(result.config);
    }
    setSaving(false);
  };

  const handleModeChange = async (next: RouletteMode) => {
    if (!config || next === mode) return;
    setSaving(true);
    onConfigChange({ ...config, rouletteMode: next });
    const result = await updateWorkspaceConfigAction(workspaceId, {
      rouletteMode: next,
    });
    if (result.error) {
      onConfigChange({ ...config, rouletteMode: mode });
      toast.error(result.error);
    } else if (result.config) {
      onConfigChange(result.config);
      toast.success(t("roulette.saveSuccess"));
    }
    setSaving(false);
  };

  const handleStrategyChange = async (next: RouletteStrategy) => {
    if (!config || next === strategy) return;
    if (choosesFromRecipients(next) && recipientsOf(config).length === 0) {
      setPendingStrategy(next);
      return;
    }
    setPendingStrategy(null);
    if (next === savedStrategy) return;
    setSaving(true);
    onConfigChange({ ...config, rouletteStrategy: next });
    const result = await updateWorkspaceConfigAction(workspaceId, {
      rouletteStrategy: next,
    });
    if (result.error || !result.config) {
      onConfigChange({ ...config, rouletteStrategy: savedStrategy });
      toast.error(t("roulette.saveError"));
    } else {
      onConfigChange(result.config);
      toast.success(t("roulette.saveSuccess"));
    }
    setSaving(false);
  };

  return (
    <ConfigCardShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<UsersThree weight="fill" className="h-4.5 w-4.5" />}
      title={t("distribution.label")}
      description={t("distribution.description")}
      statusLabel={t("roulette.status", {
        mode: mode === "last_seen" ? t("roulette.statusLastSeen") : t("roulette.statusOnline"),
        strategy: t(`roulette.strategies.${savedStrategy}.short`),
      })}
      statusTone={mode === "last_seen" || savedStrategy !== "round_robin" ? "active" : "inactive"}
    >
      <SettingsSection title={t("roulette.modeLabel")} hint={t("roulette.modeHint")}>
        <RouletteModePicker mode={mode} disabled={saving || !config} onPick={handleModeChange} />
        {mode === "last_seen" ? (
          <RouletteLastSeenSettings
            key={rouletteSettingsKey(config)}
            workspaceId={workspaceId}
            config={config}
            onConfigChange={onConfigChange}
          />
        ) : null}
      </SettingsSection>

      <SettingsSection title={t("roulette.strategyLabel")} hint={t("roulette.strategyHint")}>
        <RouletteStrategyPicker strategy={strategy} disabled={saving || !config} onPick={handleStrategyChange} />
        {strategy === "priority" || strategy === "weighted" ? (
          <RouletteRecipientsEditor
            key={`${strategy}|${recipientsKey(config)}`}
            workspaceId={workspaceId}
            config={config}
            strategy={strategy}
            pending={pendingStrategy !== null}
            onConfigChange={onConfigChange}
            onSaved={() => setPendingStrategy(null)}
          />
        ) : null}
      </SettingsSection>

      <SettingsSection title={t("roulette.generalLabel")} hint={t("roulette.generalHint")}>
        <div className="divide-y divide-border">
          <RouletteCapacityRow
            key={`capacity|${maxOpenOf(config)}`}
            workspaceId={workspaceId}
            config={config}
            onConfigChange={onConfigChange}
          />
          <SettingRow
            label={t("skipAdminAssignment.enableLabel")}
            hint={t("skipAdminAssignment.enableHint")}
            explainer="settings.adminsInRoulette"
            control={
              <Switch
                checked={adminsReceive}
                onCheckedChange={handleToggle}
                disabled={saving || !config}
                aria-label={t("skipAdminAssignment.enableLabel")}
              />
            }
          />
        </div>
      </SettingsSection>
    </ConfigCardShell>
  );
}

function recipientsKey(config: WorkspaceConfig | null) {
  return recipientsOf(config)
    .map((r) => `${r.userId}:${r.tier}:${r.weight}`)
    .join(",");
}

function rouletteSettingsKey(config: WorkspaceConfig | null) {
  if (!config) return "empty";
  return [
    config.rouletteLastSeenWindowHours ?? ROULETTE_DEFAULTS.windowHours,
    config.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled,
    config.rouletteRescueAfterMinutes ?? ROULETTE_DEFAULTS.rescueMinutes,
  ].join("|");
}


function OutcomeCaptureConfigCard({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const t = useTranslations("workspaceSettings.outcomeCapture");
  const [open, setOpen] = React.useState(false);

  const capture = config?.outcomeCapture ?? null;
  const active = Boolean(capture?.enabled);
  const statusLabel = active
    ? t("statusOn", { count: String(capture?.outcomes?.length ?? 0) })
    : t("statusOff");

  return (
    <ConfigCardShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<CheckCircle weight="fill" className="h-4.5 w-4.5" />}
      title={t("label")}
      description={t("cardDescription")}
      statusLabel={statusLabel}
      statusTone={active ? "active" : "inactive"}
    >
      <OutcomeCaptureCard
        workspaceId={workspaceId}
        config={config}
        onConfigChange={onConfigChange}
      />
    </ConfigCardShell>
  );
}

function WorkingHoursConfigCard({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const tw = useTranslations("workingHours");
  const [open, setOpen] = React.useState(false);

  const saved = config?.workingHours ?? null;
  const rescueActive =
    (config?.rouletteMode ?? ROULETTE_DEFAULTS.mode) === "last_seen" &&
    (config?.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled);

  const statusLabel = useWorkingHoursSummary(saved);

  return (
    <ConfigCardShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<Clock weight="fill" className="h-4.5 w-4.5" />}
      title={tw("title")}
      description={tw("workspaceDescription")}
      statusLabel={statusLabel}
      statusTone={saved ? "active" : "inactive"}
    >
      {!rescueActive ? (
        <Alert variant="warning">
          <Warning weight="fill" className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {tw("inactiveNotice")}
          </AlertDescription>
        </Alert>
      ) : null}

      <WorkspaceWorkingHoursForm
        key={workingHoursKey(config)}
        workspaceId={workspaceId}
        config={config}
        onConfigChange={onConfigChange}
      />
    </ConfigCardShell>
  );
}

function workingHoursKey(config: WorkspaceConfig | null) {
  return JSON.stringify(config?.workingHours ?? null);
}

function WorkspaceWorkingHoursForm({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const tw = useTranslations("workingHours");
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<WorkingHoursSpec | null>(
    config?.workingHours ?? null,
  );

  const saved = config?.workingHours ?? null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const issues = draft ? validateWorkingHours(draft) : [];

  const handleSave = async () => {
    setSaving(true);
    const result = await updateWorkspaceConfigAction(workspaceId, {
      workingHours: draft,
    });
    if (result.error || !result.config) {
      toast.error(result.error ?? tw("saveError"));
    } else {
      onConfigChange(result.config);
      setDraft(result.config.workingHours ?? null);
      toast.success(tw("saveSuccess"));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <WorkingHoursEditor
        value={draft}
        onChange={setDraft}
        disabled={saving || !config}
        offHint={tw("workspaceOffHint")}
      />

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saving || !config || issues.length > 0}
        >
          {saving ? (
            <CircleNotch weight="bold" className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FloppyDisk weight="fill" className="mr-1.5 h-4 w-4" />
          )}
          {tw("save")}
        </Button>
      </div>
    </div>
  );
}


function AutoCloseConfigCard({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const t = useTranslations("workspaceSettings");
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [enabled, setEnabled] = React.useState(config?.autoCloseEnabled ?? true);
  const [hours, setHours] = React.useState(config?.autoCloseIdleAfterHours ?? 24);
  const [maxAgeOn, setMaxAgeOn] = React.useState(
    config?.autoCloseMaxAgeEnabled ?? true,
  );
  const [maxAgeHours, setMaxAgeHours] = React.useState(
    config?.autoCloseMaxAgeAfterHours ?? 168,
  );

  React.useEffect(() => {
    if (!config) return;
    setEnabled(config.autoCloseEnabled ?? true);
    setHours(config.autoCloseIdleAfterHours ?? 24);
    setMaxAgeOn(config.autoCloseMaxAgeEnabled ?? true);
    setMaxAgeHours(config.autoCloseMaxAgeAfterHours ?? 168);
  }, [config]);

  const dirty =
    !!config &&
    ((config.autoCloseEnabled ?? true) !== enabled ||
      (config.autoCloseIdleAfterHours ?? 24) !== hours ||
      (config.autoCloseMaxAgeEnabled ?? true) !== maxAgeOn ||
      (config.autoCloseMaxAgeAfterHours ?? 168) !== maxAgeHours);

  const handleSave = async () => {
    const clamped = Math.min(168, Math.max(1, Math.round(hours) || 24));
    const maxClamped = Math.min(2160, Math.max(24, Math.round(maxAgeHours) || 168));
    setHours(clamped);
    setMaxAgeHours(maxClamped);
    setSaving(true);
    const result = await updateWorkspaceConfigAction(workspaceId, {
      autoCloseEnabled: enabled,
      autoCloseIdleAfterHours: clamped,
      autoCloseMaxAgeEnabled: maxAgeOn,
      autoCloseMaxAgeAfterHours: maxClamped,
    });
    if (result.error || !result.config) {
      toast.error(result.error ?? t("autoClose.saveError"));
    } else {
      onConfigChange(result.config);
      toast.success(t("autoClose.saveSuccess"));
    }
    setSaving(false);
  };

  const clampHours = (raw: string, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  const anyOn = (config?.autoCloseEnabled ?? true) || (config?.autoCloseMaxAgeEnabled ?? true);

  return (
    <ConfigCardShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<ChatCircleDots weight="fill" className="h-4.5 w-4.5" />}
      title={t("autoClose.title")}
      description={t("autoClose.description")}
      statusLabel={anyOn ? t("configCard.active") : t("configCard.inactive")}
      statusTone={anyOn ? "active" : "inactive"}
    >
      {}
      <div className="flex items-center justify-between gap-4 rounded-[--radius] border border-border px-4 py-3">
        <div className="pr-4 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-foreground">
              {t("autoClose.enableLabel")}
            </p>
            <ExplainerHint id="settings.autoCloseIdle" />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("autoClose.enableHint")}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label={t("autoClose.enableLabel")}
        />
      </div>

      <div className={cn("space-y-2", !enabled && "opacity-50")}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            {t("autoClose.hoursLabel")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={168}
              value={hours}
              disabled={!enabled}
              onChange={(e) =>
                setHours(clampHours(e.target.value, 1, 168, 24))
              }
              className="w-28 rounded-[--radius] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed"
            />
            <span className="text-xs text-muted-foreground">
              {t("autoClose.hoursUnit")}
            </span>
          </div>
          <span className="mt-1 block text-2xs text-muted-foreground">
            {t("autoClose.hint")}
          </span>
        </label>
      </div>

      {}
      <div className="flex items-center justify-between gap-4 rounded-[--radius] border border-border px-4 py-3">
        <div className="pr-4 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-foreground">
              {t("autoClose.maxAgeEnableLabel")}
            </p>
            <ExplainerHint id="settings.autoCloseMaxAge" />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("autoClose.maxAgeEnableHint")}
          </p>
        </div>
        <Switch
          checked={maxAgeOn}
          onCheckedChange={setMaxAgeOn}
          aria-label={t("autoClose.maxAgeEnableLabel")}
        />
      </div>

      <div className={cn("space-y-2", !maxAgeOn && "opacity-50")}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            {t("autoClose.maxAgeHoursLabel")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={24}
              max={2160}
              value={maxAgeHours}
              disabled={!maxAgeOn}
              onChange={(e) =>
                setMaxAgeHours(clampHours(e.target.value, 24, 2160, 168))
              }
              className="w-28 rounded-[--radius] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed"
            />
            <span className="text-xs text-muted-foreground">
              {t("autoClose.hoursUnit")}
            </span>
          </div>
          <span className="mt-1 block text-2xs text-muted-foreground">
            {t("autoClose.maxAgeHint")}
          </span>
        </label>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={saving || !dirty}
          onClick={handleSave}
          className="rounded-lg"
        >
          {saving ? (
            <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />
          ) : (
            <FloppyDisk className="h-3.5 w-3.5" weight="bold" />
          )}
          {t("autoClose.save")}
        </Button>
      </div>
    </ConfigCardShell>
  );
}
