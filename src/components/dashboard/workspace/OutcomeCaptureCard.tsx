"use client";

import * as React from "react";
import { CircleNotch, FloppyDisk, Plus, Trash, Warning } from "@/components/icons";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import type {
  OutcomeCaptureSpec,
  OutcomeSpec,
  WorkspaceConfig,
} from "@/lib/workspace/workspace-config/types";

import { updateWorkspaceConfigAction } from "@/app/actions/workspace-config";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSwitch as Switch } from "@/components/elevated-design/elevated-switch";
import { cn } from "@/lib/utils";

const DEFAULT_THRESHOLD = 30;
const MAX_CODE_LENGTH = 64;

export function emptyCapture(): OutcomeCaptureSpec {
  return {
    enabled: false,
    requireOnFinish: true,
    durableThreshold: DEFAULT_THRESHOLD,
    outcomes: [],
  };
}

function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+/, "")
    .slice(0, MAX_CODE_LENGTH);
}

export function validateCapture(
  capture: OutcomeCaptureSpec,
  t: (key: string) => string,
): string[] {
  const issues: string[] = [];
  if (capture.durableThreshold < 0 || capture.durableThreshold > 100) {
    issues.push(t("issues.threshold"));
  }

  const seen = new Set<string>();
  let durable = false;
  for (const outcome of capture.outcomes) {
    if (!outcome.code) issues.push(t("issues.codeRequired"));
    else if (outcome.code.startsWith("_")) issues.push(t("issues.reserved"));
    else if (seen.has(outcome.code)) issues.push(t("issues.duplicate"));
    else seen.add(outcome.code);

    if (!outcome.label.trim()) issues.push(t("issues.labelRequired"));
    if (outcome.isDurable) durable = true;
  }

  if (capture.enabled) {
    if (capture.outcomes.length === 0) issues.push(t("issues.empty"));
    else if (!durable) issues.push(t("issues.noDurable"));
  }
  return Array.from(new Set(issues));
}

function SettingRow({
  title,
  hint,
  control,
}: {
  title: string;
  hint: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[--radius] border border-border bg-muted/20 px-3 py-2.5">
      <div className="min-w-[200px] flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function OutcomeCaptureCard({
  workspaceId,
  config,
  onConfigChange,
}: {
  workspaceId: string;
  config: WorkspaceConfig | null;
  onConfigChange: (config: WorkspaceConfig) => void;
}) {
  const t = useTranslations("workspaceSettings.outcomeCapture");
  const [saving, setSaving] = React.useState(false);
  const saved = config?.outcomeCapture ?? emptyCapture();
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = React.useState<OutcomeCaptureSpec>(saved);
  const [syncedKey, setSyncedKey] = React.useState(savedKey);

  if (savedKey !== syncedKey) {
    setSyncedKey(savedKey);
    setDraft(saved);
  }

  const dirty = JSON.stringify(draft) !== savedKey;
  const issues = validateCapture(draft, t);
  const codeTaken = React.useCallback(
    (code: string, index: number) =>
      code !== "" &&
      draft.outcomes.some((other, i) => i !== index && other.code === code),
    [draft.outcomes],
  );

  const patchOutcome = (index: number, patch: Partial<OutcomeSpec>) => {
    setDraft((prev) => ({
      ...prev,
      outcomes: prev.outcomes.map((outcome, i) =>
        i === index ? { ...outcome, ...patch } : outcome,
      ),
    }));
  };

  const addOutcome = () => {
    setDraft((prev) => ({
      ...prev,
      outcomes: [
        ...prev.outcomes,
        {
          code: "",
          label: "",
          isDurable: prev.outcomes.length === 0,
          position: prev.outcomes.length + 1,
        },
      ],
    }));
  };

  const removeOutcome = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      outcomes: prev.outcomes.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateWorkspaceConfigAction(workspaceId, {
      outcomeCapture: {
        ...draft,
        outcomes: draft.outcomes.map((outcome, index) => ({
          ...outcome,
          label: outcome.label.trim(),
          position: index + 1,
        })),
      },
    });
    if (result.error || !result.config) {
      toast.error(result.error ?? t("saveError"));
    } else {
      onConfigChange(result.config);
      setDraft(result.config.outcomeCapture ?? emptyCapture());
      toast.success(t("saveSuccess"));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("description")}
      </p>

      <div className="space-y-2">
        <SettingRow
          title={t("enabled")}
          hint={t("enabledHint")}
          control={
            <Switch
              checked={draft.enabled}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({ ...prev, enabled: checked }))
              }
              disabled={saving}
              aria-label={t("enabled")}
            />
          }
        />
        <SettingRow
          title={t("requireOnFinish")}
          hint={t("requireOnFinishHint")}
          control={
            <Switch
              checked={draft.requireOnFinish}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({ ...prev, requireOnFinish: checked }))
              }
              disabled={saving || !draft.enabled}
              aria-label={t("requireOnFinish")}
            />
          }
        />
        <SettingRow
          title={t("threshold")}
          hint={t("thresholdHint")}
          control={
            <div className="flex items-center gap-1.5">
              <ElevatedInput
                type="number"
                min={0}
                max={100}
                value={String(draft.durableThreshold)}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    durableThreshold: Number(event.target.value),
                  }))
                }
                disabled={saving}
                className="w-20 text-right"
                aria-label={t("threshold")}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          }
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("catalogue")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("catalogueHint")}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus weight="bold" className="h-3.5 w-3.5" />}
            iconVisible
            title={t("addOutcome")}
            onClick={addOutcome}
            disabled={saving}
          />
        </div>

        {draft.outcomes.length === 0 ? (
          <button
            type="button"
            onClick={addOutcome}
            disabled={saving}
            className="flex w-full flex-col items-center gap-1 rounded-[--radius] border border-dashed border-border px-3 py-6 text-center transition-colors hover:border-primary hover:bg-muted/40"
          >
            <Plus weight="bold" className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {t("emptyCatalogue")}
            </span>
          </button>
        ) : (
          <ul className="space-y-2">
            {draft.outcomes.map((outcome, index) => {
              const duplicate = codeTaken(outcome.code, index);
              return (
                <li
                  key={index}
                  className="rounded-[--radius] border border-border bg-card px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[160px] flex-1">
                      <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("labelColumn")}
                      </span>
                      <ElevatedInput
                        value={outcome.label}
                        placeholder={t("labelPlaceholder")}
                        onChange={(event) =>
                          patchOutcome(index, { label: event.target.value })
                        }
                        disabled={saving}
                        className="w-full"
                      />
                    </label>

                    <label className="min-w-[140px]">
                      <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("codeColumn")}
                      </span>
                      <ElevatedInput
                        value={outcome.code}
                        placeholder={t("codePlaceholder")}
                        onChange={(event) =>
                          patchOutcome(index, {
                            code: normalizeCode(event.target.value),
                          })
                        }
                        onBlur={(event) => {
                          if (event.target.value !== "") return;
                          const fromLabel = normalizeCode(outcome.label);
                          if (fromLabel) patchOutcome(index, { code: fromLabel });
                        }}
                        disabled={saving}
                        className={cn(
                          "w-full font-mono",
                          duplicate && "border-destructive",
                        )}
                      />
                    </label>

                    <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-[--radius] border border-border px-3">
                      <input
                        type="checkbox"
                        checked={outcome.isDurable}
                        onChange={(event) =>
                          patchOutcome(index, { isDurable: event.target.checked })
                        }
                        disabled={saving}
                        className="h-3.5 w-3.5 rounded border-border text-primary-ink focus:ring-ring"
                      />
                      <span className="whitespace-nowrap text-xs font-medium text-foreground">
                        {t("isDurable")}
                      </span>
                    </label>

                    <Button
                      size="icon"
                      variant="ghost"
                      icon={<Trash weight="bold" className="h-4 w-4" />}
                      iconVisible
                      onClick={() => removeOutcome(index)}
                      disabled={saving}
                      aria-label={t("removeOutcome")}
                      className="h-[42px] w-[42px] text-destructive-ink"
                    />
                  </div>
                  <p className="mt-1.5 text-2xs text-muted-foreground">
                    {t("isDurableHint")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {issues.length > 0 ? (
        <ul className="space-y-1 rounded-[--radius] border border-destructive/40 bg-destructive/5 px-3 py-2">
          {issues.map((issue) => (
            <li
              key={issue}
              className="flex items-start gap-1.5 text-xs text-destructive-ink"
            >
              <Warning weight="fill" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {issue}
            </li>
          ))}
        </ul>
      ) : null}

      {draft.enabled && !saved.enabled ? (
        <p className="flex items-start gap-1.5 rounded-[--radius] border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning-ink">
          <Warning weight="fill" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("switchOnWarning")}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="primary"
          icon={
            saving ? (
              <CircleNotch weight="bold" className="h-4 w-4 animate-spin" />
            ) : (
              <FloppyDisk weight="fill" className="h-4 w-4" />
            )
          }
          iconVisible
          title={t("save")}
          onClick={handleSave}
          disabled={!dirty || saving || !config || issues.length > 0}
        />
      </div>
    </div>
  );
}
