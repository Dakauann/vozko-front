"use client";

import * as React from "react";
import {
  CaretDown,
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
import type {
  RouletteMode,
  WorkspaceConfig,
} from "@/lib/workspace/workspace-config/types";
import { ROULETTE_DEFAULTS, ROULETTE_LIMITS } from "@/lib/workspace/workspace-config/roulette";
import { updateWorkspaceConfigAction } from "@/app/actions/workspace-config";
import { WorkingHoursEditor } from "@/components/dashboard/working-hours/WorkingHoursEditor";
import { OutcomeCaptureCard } from "@/components/dashboard/workspace/OutcomeCaptureCard";
import {
  summarizeWorkingHours,
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


function ConfigCardShell({
  open,
  onToggle,
  icon,
  title,
  description,
  statusLabel,
  statusActive,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  statusLabel: string;
  statusActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[--radius] border border-border bg-card shadow-sm p-5 space-y-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              {description}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {
}
          <span
            className={cn(
              "rounded-[--radius] px-2.5 py-1 text-2xs font-semibold",
              statusActive
                ? "bg-healthy text-healthy-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {statusLabel}
          </span>
          <CaretDown
            weight="bold"
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      {open ? <div className="space-y-4">{children}</div> : null}
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

  const adminsReceive = !(config?.skipAdminAssignment ?? false);
  const mode = config?.rouletteMode ?? ROULETTE_DEFAULTS.mode;

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

  return (
    <ConfigCardShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<UsersThree weight="fill" className="h-4.5 w-4.5" />}
      title={t("distribution.label")}
      description={t("distribution.description")}
      statusLabel={
        mode === "last_seen"
          ? t("roulette.statusLastSeen")
          : t("roulette.statusOnline")
      }
      statusActive={mode === "last_seen"}
    >
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t("roulette.modeLabel")}
        </p>
        <div
          role="radiogroup"
          aria-label={t("roulette.modeLabel")}
          className="grid gap-2 sm:grid-cols-2"
        >
          <RouletteModeOption
            selected={mode === "online"}
            disabled={saving || !config}
            title={t("roulette.onlineLabel")}
            description={t("roulette.onlineHint")}
            onSelect={() => handleModeChange("online")}
          />
          <RouletteModeOption
            selected={mode === "last_seen"}
            disabled={saving || !config}
            title={t("roulette.lastSeenLabel")}
            description={t("roulette.lastSeenHint")}
            onSelect={() => handleModeChange("last_seen")}
          />
        </div>
      </div>

      {
}
      <div className="flex items-center justify-between gap-4 rounded-[--radius] border border-border px-4 py-3">
        <div className="pr-4 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("skipAdminAssignment.enableLabel")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("skipAdminAssignment.enableHint")}
          </p>
        </div>
        <Switch
          checked={adminsReceive}
          onCheckedChange={handleToggle}
          disabled={saving || !config}
          aria-label={t("skipAdminAssignment.enableLabel")}
        />
      </div>

      {mode === "last_seen" ? (
        <RouletteLastSeenSettings
          key={rouletteSettingsKey(config)}
          workspaceId={workspaceId}
          config={config}
          onConfigChange={onConfigChange}
        />
      ) : null}
    </ConfigCardShell>
  );
}

function RouletteModeOption({
  selected,
  disabled,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  disabled: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "rounded-[--radius] border px-4 py-3 text-left transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-button-primary"
          : "border-border bg-card hover:border-primary/50",
      )}
    >
      <p
        className={cn(
          "text-sm font-medium",
          selected ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {title}
      </p>
      {
}
      <p
        className={cn(
          "mt-0.5 text-xs",
          selected ? "text-primary-foreground/85" : "text-muted-foreground",
        )}
      >
        {description}
      </p>
    </button>
  );
}

function rouletteSettingsKey(config: WorkspaceConfig | null) {
  if (!config) return "empty";
  return [
    config.rouletteLastSeenWindowHours ?? ROULETTE_DEFAULTS.windowHours,
    config.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled,
    config.rouletteRescueAfterMinutes ?? ROULETTE_DEFAULTS.rescueMinutes,
  ].join("|");
}

function RouletteLastSeenSettings({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const t = useTranslations("workspaceSettings");
  const [saving, setSaving] = React.useState(false);
  const [windowHours, setWindowHours] = React.useState(
    config?.rouletteLastSeenWindowHours ?? ROULETTE_DEFAULTS.windowHours,
  );
  const [rescueOn, setRescueOn] = React.useState(
    config?.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled,
  );
  const [rescueMinutes, setRescueMinutes] = React.useState(
    config?.rouletteRescueAfterMinutes ?? ROULETTE_DEFAULTS.rescueMinutes,
  );

  const dirty =
    !!config &&
    ((config.rouletteLastSeenWindowHours ?? ROULETTE_DEFAULTS.windowHours) !==
      windowHours ||
      (config.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled) !==
        rescueOn ||
      (config.rouletteRescueAfterMinutes ?? ROULETTE_DEFAULTS.rescueMinutes) !==
        rescueMinutes);

  const clamp = (raw: string, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  const handleSave = async () => {
    const w = clamp(
      String(windowHours),
      ROULETTE_LIMITS.window.min,
      ROULETTE_LIMITS.window.max,
      ROULETTE_DEFAULTS.windowHours,
    );
    const m = clamp(
      String(rescueMinutes),
      ROULETTE_LIMITS.rescue.min,
      ROULETTE_LIMITS.rescue.max,
      ROULETTE_DEFAULTS.rescueMinutes,
    );
    setWindowHours(w);
    setRescueMinutes(m);
    setSaving(true);
    const result = await updateWorkspaceConfigAction(workspaceId, {
      rouletteLastSeenWindowHours: w,
      rouletteRescueEnabled: rescueOn,
      rouletteRescueAfterMinutes: m,
    });
    if (result.error || !result.config) {
      toast.error(result.error ?? t("roulette.saveError"));
    } else {
      onConfigChange(result.config);
      toast.success(t("roulette.saveSuccess"));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 rounded-[--radius] border border-border p-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">
          {t("roulette.windowLabel")}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={ROULETTE_LIMITS.window.min}
            max={ROULETTE_LIMITS.window.max}
            value={windowHours}
            onChange={(e) =>
              setWindowHours(
                clamp(
                  e.target.value,
                  ROULETTE_LIMITS.window.min,
                  ROULETTE_LIMITS.window.max,
                  ROULETTE_DEFAULTS.windowHours,
                ),
              )
            }
            className="w-28 rounded-[--radius] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <span className="text-xs text-muted-foreground">
            {t("roulette.hoursUnit")}
          </span>
        </div>
        <span className="mt-1 block text-2xs text-muted-foreground">
          {t("roulette.windowHint")}
        </span>
      </label>

      <div className="flex items-center justify-between gap-4 rounded-[--radius] border border-border px-4 py-3">
        <div className="pr-4 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("roulette.rescueLabel")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("roulette.rescueHint")}
          </p>
        </div>
        <Switch
          checked={rescueOn}
          onCheckedChange={setRescueOn}
          aria-label={t("roulette.rescueLabel")}
        />
      </div>

      <div className={cn("space-y-2", !rescueOn && "opacity-50")}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            {t("roulette.rescueMinutesLabel")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={ROULETTE_LIMITS.rescue.min}
              max={ROULETTE_LIMITS.rescue.max}
              value={rescueMinutes}
              disabled={!rescueOn}
              onChange={(e) =>
                setRescueMinutes(
                  clamp(
                    e.target.value,
                    ROULETTE_LIMITS.rescue.min,
                    ROULETTE_LIMITS.rescue.max,
                    ROULETTE_DEFAULTS.rescueMinutes,
                  ),
                )
              }
              className="w-28 rounded-[--radius] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed"
            />
            <span className="text-xs text-muted-foreground">
              {t("roulette.minutesUnit")}
            </span>
          </div>
          <span className="mt-1 block text-2xs text-muted-foreground">
            {t("roulette.rescueMinutesHint")}
          </span>
        </label>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saving || !config}
        >
          {saving ? (
            <CircleNotch weight="bold" className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FloppyDisk weight="fill" className="mr-1.5 h-4 w-4" />
          )}
          {t("roulette.save")}
        </Button>
      </div>
    </div>
  );
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
      statusActive={active}
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
  const summary = summarizeWorkingHours(saved);
  const rescueActive =
    (config?.rouletteMode ?? ROULETTE_DEFAULTS.mode) === "last_seen" &&
    (config?.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled);

  let statusLabel: string;
  switch (summary.kind) {
    case "alwaysOpen":
      statusLabel = tw("summaryAlwaysOpen");
      break;
    case "everyDay":
      statusLabel = tw("summaryEveryDay", {
        start: summary.start,
        end: summary.end,
      });
      break;
    case "weekdays":
      statusLabel = tw("summaryWeekdays", {
        start: summary.start,
        end: summary.end,
      });
      break;
    default:
      statusLabel = tw("summaryCustom", { count: summary.openDays });
  }

  return (
    <ConfigCardShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<Clock weight="fill" className="h-4.5 w-4.5" />}
      title={tw("title")}
      description={tw("workspaceDescription")}
      statusLabel={statusLabel}
      statusActive={!!saved}
    >
      {
}
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
      statusActive={anyOn}
    >
      {}
      <div className="flex items-center justify-between gap-4 rounded-[--radius] border border-border px-4 py-3">
        <div className="pr-4 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("autoClose.enableLabel")}
          </p>
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
          <p className="text-sm font-medium text-foreground">
            {t("autoClose.maxAgeEnableLabel")}
          </p>
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
