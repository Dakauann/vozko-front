"use client";

import * as React from "react";
import { CaretDown, CircleNotch, FloppyDisk, Queue } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import type {
  QueueOverflowAction,
  WorkspaceConfig,
} from "@/lib/workspace/workspace-config/types";
import { updateWorkspaceConfigAction } from "@/app/actions/workspace-config";
import { cn } from "@/lib/utils";

// Server-side hard caps (mirror dialer.QueueMaxWaitCap / QueueMaxLengthCap) so the
// UI never lets an operator ask for an unbounded wait or line.
const MAX_WAIT_MINUTES = 30;
const MAX_LENGTH = 200;
const DEFAULT_WAIT_MINUTES = 5;
const DEFAULT_MAX_LENGTH = 25;

interface CallQueueCardProps {
  workspaceId: string;
  config: WorkspaceConfig | null;
  onConfigChange: (config: WorkspaceConfig) => void;
}

/**
 * Fila de espera (ACD) do workspace. Este toggle controla o HOLD: quando ativo, um
 * cliente cuja fila (departamento/workspace) está ocupada aguarda em espera até um
 * atendente ficar livre; quando inativo, a distribuição por departamento ainda toca
 * para os disponíveis uma vez (ringall, sem espera) e um camp-on para um atendente
 * específico ocupado retorna ocupado. Os limites (tempo/tamanho/overflow) só se
 * aplicam ao hold e garantem que ninguém espera para sempre.
 */
export function CallQueueCard({ workspaceId, config, onConfigChange }: CallQueueCardProps) {
  const t = useTranslations("workspaceSettings.queueCard");
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [enabled, setEnabled] = React.useState(false);
  const [waitMinutes, setWaitMinutes] = React.useState(DEFAULT_WAIT_MINUTES);
  const [maxLength, setMaxLength] = React.useState(DEFAULT_MAX_LENGTH);
  const [overflow, setOverflow] = React.useState<QueueOverflowAction>("hangup");

  // Seed the form from the loaded config (and re-seed if it changes upstream).
  React.useEffect(() => {
    if (!config) return;
    setEnabled(config.queueEnabled);
    setWaitMinutes(
      config.queueMaxWaitSeconds > 0
        ? Math.max(1, Math.round(config.queueMaxWaitSeconds / 60))
        : DEFAULT_WAIT_MINUTES,
    );
    setMaxLength(config.queueMaxLength > 0 ? config.queueMaxLength : DEFAULT_MAX_LENGTH);
    setOverflow(config.queueOverflow || "hangup");
  }, [config]);

  const dirty =
    !!config &&
    (config.queueEnabled !== enabled ||
      Math.max(1, Math.round((config.queueMaxWaitSeconds || DEFAULT_WAIT_MINUTES * 60) / 60)) !==
        waitMinutes ||
      (config.queueMaxLength || DEFAULT_MAX_LENGTH) !== maxLength ||
      (config.queueOverflow || "hangup") !== overflow);

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    const result = await updateWorkspaceConfigAction(workspaceId, {
      queueEnabled: enabled,
      queueMaxWaitSeconds: waitMinutes * 60,
      queueMaxLength: maxLength,
      queueOverflow: overflow,
    });
    if (result.error || !result.config) {
      toast.error(result.error ?? t("saveError"));
    } else {
      onConfigChange(result.config);
      toast.success(t("saveSuccess"));
    }
    setSaving(false);
  }, [enabled, maxLength, onConfigChange, overflow, waitMinutes, workspaceId]);

  const clampInt = (raw: string, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-5 space-y-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
            <Queue weight="fill" className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("title")}</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              {t("description")}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              config?.queueEnabled
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {config?.queueEnabled ? t("active") : t("inactive")}
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

      {open ? (
        <div className="space-y-4">
          {/* Enable */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div className="pr-4">
              <p className="text-sm font-medium text-foreground">{t("enableLabel")}</p>
              <p className="text-xs text-muted-foreground">
                {t("enableHint")}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={t("enableLabel")} />
          </div>

          {/* Bounds */}
          <div className={cn("grid gap-4 md:grid-cols-2", !enabled && "opacity-50")}>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                {t("maxWaitLabel")}
              </span>
              <input
                type="number"
                min={1}
                max={MAX_WAIT_MINUTES}
                value={waitMinutes}
                disabled={!enabled}
                onChange={(e) => setWaitMinutes(clampInt(e.target.value, 1, MAX_WAIT_MINUTES, DEFAULT_WAIT_MINUTES))}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {t("maxWaitHint", { max: MAX_WAIT_MINUTES })}
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                {t("maxLengthLabel")}
              </span>
              <input
                type="number"
                min={1}
                max={MAX_LENGTH}
                value={maxLength}
                disabled={!enabled}
                onChange={(e) => setMaxLength(clampInt(e.target.value, 1, MAX_LENGTH, DEFAULT_MAX_LENGTH))}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:cursor-not-allowed"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {t("maxLengthHint", { max: MAX_LENGTH })}
              </span>
            </label>
          </div>

          {/* Overflow action */}
          <div className={cn(!enabled && "opacity-50")}>
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              {t("overflowLabel")}
            </span>
            <ElevatedSelect
              value={overflow}
              onValueChange={(v) => setOverflow(v as QueueOverflowAction)}
              disabled={!enabled}
              className="max-w-sm"
            >
              <ElevatedSelectItem value="hangup">
                {t("overflowHangup")}
              </ElevatedSelectItem>
              <ElevatedSelectItem value="recall">
                {t("overflowRecall")}
              </ElevatedSelectItem>
            </ElevatedSelect>
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
              {t("save")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
