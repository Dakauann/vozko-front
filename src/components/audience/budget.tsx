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

/*
 * The workspace's analysis settings, and what they are currently costing it:
 * how much may be analysed in a rolling day, how long a conversation must go
 * quiet first, how much of the budget is spent and what is queued behind it.
 *
 * It lives here, on the workspace-wide dashboard, and not inside either the
 * comment or the conversation half, for two reasons. It governs BOTH, so
 * putting it in one of them would imply it belonged to that subject. And the
 * conversation panel hides itself when nothing has been analysed, which is
 * precisely the moment somebody would be looking for the reason why.
 *
 * Before this the ceiling could only be edited on an Instagram account's page,
 * so a workspace running only WhatsApp had a limit governing its conversations
 * that it could neither see nor change, and the quiet period was a constant in
 * the binary, so changing it was a deploy.
 *
 * The queue is the number that makes the rest actionable. Reaching the ceiling
 * never discards work: the rows stay pending and the next pass takes them. What
 * a ceiling set too low actually costs is delay, so delay is what this reports,
 * rather than a loss that does not happen.
 */
export function AnalysisBudgetPanel({
  usage,
  settings,
  onChanged,
}: {
  usage: AudienceUsage | null;
  settings: AudienceWorkspaceSettings | null;
  /** Hands back what was saved so the page does not refetch to see its own edit. */
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

  // The ceiling is the constraint only when more is waiting than the window can
  // still absorb. An exhausted budget with an empty queue is a fact, not a
  // problem, and warning about it would teach the reader to ignore the warning.
  const constrained = waiting > remaining;
  // Roughly how long the overflow waits, at this ceiling, assuming nothing new
  // arrives. Whole hours: the arithmetic does not support finer than that, and
  // pretending otherwise would read as a promise.
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

        {/*
          A rolling window has no reset to name, so when the budget IS spent the
          honest thing to say is when the oldest counted analysis leaves the
          window. "Tomorrow" would be a lie here.
        */}
        <p className="text-xs text-muted-foreground">
          {spent && freesAt ? t("freesAt", { when: freesAt }) : t("window")}
        </p>

        {/*
          The queue, and what it means. Two different sentences on purpose: a
          queue that fits under the ceiling is the system working, and only the
          one that does not fit is a number the operator should act on.
        */}
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

/*
 * The two controls, remounted whenever the server's values change.
 *
 * Keying the drafts off the server value rather than syncing them in an effect
 * is what stops the page's 60s poll from overwriting a half-typed number, and
 * it is also what the compiler's set-state-in-effect rule is pointing at.
 */
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

  /*
   * The box shows the value actually IN FORCE, never an empty field.
   *
   * It used to show only what the WORKSPACE had set, which for a workspace that
   * has set nothing is blank. So the ceiling field sat empty beside a meter
   * reading "2 de 20.000", and the quiet period sat empty while the sweep was
   * plainly waiting five minutes: both controls looked broken next to figures
   * that plainly worked. A grey placeholder was not enough either, because a
   * hint still reads as "nothing set".
   *
   * "Stored" and "in force" differ only until somebody edits one, and editing is
   * exactly when that difference stops mattering.
   */
  const stored = kind === "dailyCap" ? settings.dailyCap : settings.debounceMinutes;
  const effective = kind === "dailyCap" ? settings.effectiveDailyCap : settings.effectiveDebounceMinutes;
  const shown = stored > 0 ? stored : effective;
  const [draft, setDraft] = useState(String(shown));

  const min = kind === "dailyCap" ? 1 : settings.minDebounceMinutes;
  const max = kind === "dailyCap" ? undefined : settings.maxDebounceMinutes;

  const commit = () => {
    const next = Number.parseInt(draft, 10);
    // Compared against what is SHOWN, not what is stored. Otherwise merely
    // focusing and leaving an inherited value would persist it as a deliberate
    // choice nobody made.
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
