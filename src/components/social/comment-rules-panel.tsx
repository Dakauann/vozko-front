"use client";

import { ChatCircleDots, Pencil, Plus, Trash, Warning } from "@/components/icons";
import { useEffect, useState } from "react";

import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ElevatedSwitch as Switch } from "@/components/elevated-design/elevated-switch";
import {
  toDraft,
  type CommentRule,
  type CommentRuleAction,
  type CommentRuleApi,
} from "@/lib/social/comment-rules";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

import { CommentRuleDialog } from "./comment-rule-dialog";
import { RULE_ACTION_ICONS } from "./comment-rule-fields";

export function CommentRulesPanel({
  api,
  allowedActions,
  translationNamespace,
  containerId,
  canManage = true,
  disabledReason,
  className,
}: {
  api: CommentRuleApi;
  allowedActions: readonly CommentRuleAction[];
  translationNamespace: string;
  containerId?: string;
  canManage?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const t = useTranslations(translationNamespace);

  const [rules, setRules] = useState<CommentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CommentRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingRule, setDeletingRule] = useState<CommentRule | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.list().then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setRules([]);
      } else {
        setError(null);
        setRules(
          containerId
            ? result.rules.filter((r) => !r.containerId || r.containerId === containerId)
            : result.rules,
        );
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api, containerId]);

  const handleToggle = async (rule: CommentRule, enabled: boolean) => {
    setBusyId(rule.id);
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled } : r)));
    const result = await api.update(rule.id, toDraft({ ...rule, enabled }));
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: rule.enabled } : r)));
    }
  };

  const handleDelete = async () => {
    if (!deletingRule) return;
    const target = deletingRule;
    setDeletingRule(null);
    setBusyId(target.id);
    const result = await api.remove(target.id);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== target.id));
  };

  const handleSaved = (saved: CommentRule) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      const next = exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved];
      return next.sort((a, b) => a.priority - b.priority);
    });
    setEditing(null);
    setCreating(false);
  };

  return (
    <ElevatedContainer className={cn("overflow-hidden !p-0", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {containerId ? t("subtitlePost") : t("subtitleAccount")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={!canManage}
          title={!canManage ? disabledReason : undefined}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" weight="bold" />
          {t("new")}
        </button>
      </div>

      <div className="p-5">
        {!canManage && disabledReason && (
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {disabledReason}
          </p>
        )}

        {error && (
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-destructive-ink">
            <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-[--radius] bg-muted" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-[--radius] border border-dashed border-border py-8 text-center">
            <ChatCircleDots className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("emptyTitle")}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{t("emptyBody")}</p>
            {canManage && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-3 text-xs font-semibold text-primary-ink hover:underline"
              >
                {t("emptyCta")}
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule, index) => (
              <li
                key={rule.id}
                className={cn(
                  "flex items-start gap-3 rounded-[--radius] border border-border p-3 transition-opacity",
                  busyId === rule.id && "opacity-60",
                  !rule.enabled && "bg-muted",
                )}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-2xs font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">{rule.name}</span>
                    {rule.containerId ? (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs font-medium text-chart-4-ink dark:text-chart-4">
                        {t("scopePost")}
                      </span>
                    ) : (
                      <span className="rounded-[--radius] bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                        {t("scopeAccount")}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {rule.match === "any"
                      ? t("matchAnySummary")
                      : t("matchSummary", {
                          match: t(`match.${rule.match}`),
                          keywords: rule.keywords.join(", "),
                        })}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rule.actions.map((action) => (
                      <ActionChip key={action} action={action} label={t(`action.${action}`)} />
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(v) => void handleToggle(rule, v)}
                    disabled={busyId === rule.id || !canManage}
                    aria-label={t("toggle", { name: rule.name })}
                  />
                  <button
                    type="button"
                    onClick={() => setEditing(rule)}
                    disabled={!canManage}
                    aria-label={t("edit", { name: rule.name })}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingRule(rule)}
                    disabled={!canManage}
                    aria-label={t("delete", { name: rule.name })}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:opacity-40"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(creating || editing) && (
        <CommentRuleDialog
          api={api}
          allowedActions={allowedActions}
          translationNamespace={translationNamespace}
          containerId={containerId}
          rule={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!deletingRule}
        onOpenChange={(open) => !open && setDeletingRule(null)}
        title={t("deleteTitle")}
        description={t("deleteBody", { name: deletingRule?.name ?? "" })}
        confirmLabel={t("deleteConfirm")}
        onConfirm={() => void handleDelete()}
      />
    </ElevatedContainer>
  );
}

function ActionChip({ action, label }: { action: CommentRuleAction; label: string }) {
  const Icon = RULE_ACTION_ICONS[action];
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-[--radius] px-2 py-0.5 text-2xs font-medium",
        action === "hide"
          ? "bg-muted text-warning-ink dark:text-warning-ink"
          : action === "delete"
            ? "bg-muted text-destructive-ink"
            : "bg-muted text-primary-ink",
      )}
    >
      <Icon className="h-3 w-3" weight="fill" />
      {label}
    </span>
  );
}
