"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Meter } from "@/components/charts/vozko";
import { WarningCircle } from "@/components/icons";
import { Panel } from "@/components/audience/shared";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  updateAudienceWorkspaceSettingsAction,
  type AudienceUsage,
  type AudienceWorkspaceSettings,
} from "@/app/actions/audience";
import { useWorkspace } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";

export function AnalysisBudgetPanel({
  usage,
  settings,
  onChanged,
}: {
  usage: AudienceUsage | null;
  settings: AudienceWorkspaceSettings | null;
  onChanged?: (settings: AudienceWorkspaceSettings) => void;
}) {
  const t = useTranslations("audience.budget");
  const locale = useLocale();
  const { can } = useWorkspace();
  const canEdit = can("audience", "update");

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const limit = usage?.limit ?? 0;
  const used = usage?.used ?? 0;
  const waiting = usage?.waiting ?? 0;
  const oldestAt = usage?.oldestAt;

  const freesAt = useMemo(() => {
    if (!oldestAt) return "";
    const at = new Date(oldestAt);
    if (Number.isNaN(at.getTime())) return "";
    return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
      new Date(at.getTime() + 24 * 60 * 60 * 1000),
    );
  }, [oldestAt, locale]);

  if (!usage || limit <= 0) return null;

  const remaining = Math.max(0, limit - used);
  const spent = used >= limit;
  const share = Math.min(100, (used / limit) * 100);

  const constrained = waiting > remaining;
  const clearsInHours = constrained ? Math.max(1, Math.round(((waiting - remaining) / limit) * 24)) : 0;

  return (
    <Panel title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className={cn("text-sm font-semibold", spent ? "text-destructive-ink" : "text-foreground")}>
            {t("used", { used: nf.format(used), limit: nf.format(limit) })}
          </span>
          <span className="text-xs text-muted-foreground">
            {spent ? t("spent") : t("remaining", { count: nf.format(remaining) })}
          </span>
        </div>

        <Meter
          value={share}
          label={t("title")}
          color={constrained ? "hsl(var(--destructive))" : "hsl(var(--chart-1))"}
        />

        {
}
        <p className="text-xs text-muted-foreground">
          {spent && freesAt ? t("freesAt", { when: freesAt }) : t("window")}
        </p>

        {
}
        {waiting > 0 && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
              constrained
                ? "bg-destructive/10 text-destructive-ink"
                : "bg-muted/40 text-muted-foreground",
            )}
          >
            {constrained ? <WarningCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : null}
            <span>
              {constrained
                ? t("constrained", { count: nf.format(waiting), hours: clearsInHours })
                : t("waiting", { count: nf.format(waiting) })}
            </span>
          </div>
        )}

        {canEdit && settings ? (
          <SettingsEditor settings={settings} onChanged={onChanged} />
        ) : null}
      </div>
    </Panel>
  );
}

function SettingsEditor({
  settings,
  onChanged,
}: {
  settings: AudienceWorkspaceSettings;
  onChanged?: (settings: AudienceWorkspaceSettings) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
      <SettingField
        key={`cap-${settings.dailyCap}`}
        kind="dailyCap"
        settings={settings}
        onChanged={onChanged}
      />
      <SettingField
        key={`debounce-${settings.debounceMinutes}`}
        kind="debounceMinutes"
        settings={settings}
        onChanged={onChanged}
      />
    </div>
  );
}

function SettingField({
  kind,
  settings,
  onChanged,
}: {
  kind: "dailyCap" | "debounceMinutes";
  settings: AudienceWorkspaceSettings;
  onChanged?: (settings: AudienceWorkspaceSettings) => void;
}) {
  const t = useTranslations("audience.budget");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stored = kind === "dailyCap" ? settings.dailyCap : settings.debounceMinutes;
  const effective = kind === "dailyCap" ? settings.effectiveDailyCap : settings.effectiveDebounceMinutes;
  const shown = stored > 0 ? stored : effective;
  const [draft, setDraft] = useState(String(shown));

  const min = kind === "dailyCap" ? 1 : settings.minDebounceMinutes;
  const max = kind === "dailyCap" ? undefined : settings.maxDebounceMinutes;

  const commit = () => {
    const next = Number.parseInt(draft, 10);
    if (!Number.isFinite(next) || next === shown) {
      setDraft(String(shown));
      return;
    }
    setSaving(true);
    setError("");
    void updateAudienceWorkspaceSettingsAction({ [kind]: next }).then((res) => {
      setSaving(false);
      if (res.error || !res.settings) {
        setError(res.error ?? "");
        setDraft(String(shown));
        return;
      }
      onChanged?.(res.settings);
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <ElevatedInput
        label={kind === "dailyCap" ? t("limitLabel") : t("debounceLabel")}
        type="number"
        min={min}
        max={max}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="w-40"
      />
      <p className="pb-2 text-xs text-muted-foreground">
        {kind === "dailyCap"
          ? t("limitHint")
          : t("debounceHint", { min: settings.minDebounceMinutes, max: settings.maxDebounceMinutes })}
      </p>
      {error ? <p className="basis-full text-xs text-destructive-ink">{error}</p> : null}
    </div>
  );
}
