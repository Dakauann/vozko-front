"use client";

import * as React from "react";
import {
  CaretDown,
  ChatCircleDots,
  CircleNotch,
  FloppyDisk,
  UsersThree,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { HoldMusicCard } from "@/components/dashboard/workspace/HoldMusicCard";
import { CallQueueCard } from "@/components/dashboard/workspace/CallQueueCard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { WorkspaceConfig } from "@/lib/workspace/workspace-config/types";
import { updateWorkspaceConfigAction } from "@/app/actions/workspace-config";
import { cn } from "@/lib/utils";

type WorkspaceConfigTabProps = {
  workspaceId: string;
  config: WorkspaceConfig | null;
  onConfigChange: (config: WorkspaceConfig) => void;
};

/**
 * Owner-facing workspace policies. Every policy card ships collapsed
 * (same pattern as HoldMusicCard / CallQueueCard): solid icon tile, status
 * chip, caret, body only when expanded.
 */
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("configTab.sections.attendance")}
        </p>
        <AssignmentConfigCard
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

      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("configTab.sections.voice")}
        </p>
        <HoldMusicCard
          workspaceId={workspaceId}
          config={config}
          onConfigChange={onConfigChange}
        />
        <CallQueueCard
          workspaceId={workspaceId}
          config={config}
          onConfigChange={onConfigChange}
        />
      </section>
    </div>
  );
}

// ── Shared card chrome (matches CallQueueCard / HoldMusicCard) ──────────────

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
    <div className="rounded-2xl border border-border bg-card shadow-sm p-5 space-y-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
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
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              statusActive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
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

// ── Assignment ──────────────────────────────────────────────────────────────

function AssignmentConfigCard({
  workspaceId,
  config,
  onConfigChange,
}: WorkspaceConfigTabProps) {
  const t = useTranslations("workspaceSettings");
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // UI: checked = admins receive assignments (= !skipAdminAssignment)
  const adminsReceive = !(config?.skipAdminAssignment ?? false);

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

  return (
    <ConfigCardShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      icon={<UsersThree weight="fill" className="h-4.5 w-4.5" />}
      title={t("skipAdminAssignment.label")}
      description={t("skipAdminAssignment.description")}
      statusLabel={adminsReceive ? t("configCard.active") : t("configCard.inactive")}
      statusActive={adminsReceive}
    >
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
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
    </ConfigCardShell>
  );
}

// ── Auto close ──────────────────────────────────────────────────────────────

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
      {/* Policy A: waiting on customer */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
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
              className="w-28 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed"
            />
            <span className="text-xs text-muted-foreground">
              {t("autoClose.hoursUnit")}
            </span>
          </div>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {t("autoClose.hint")}
          </span>
        </label>
      </div>

      {/* Policy C: absolute max age */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
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
              className="w-28 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed"
            />
            <span className="text-xs text-muted-foreground">
              {t("autoClose.hoursUnit")}
            </span>
          </div>
          <span className="mt-1 block text-[11px] text-muted-foreground">
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
