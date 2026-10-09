"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { deleteRuleAction, listRulesAction, setRuleEnabledAction } from "@/app/actions/advertising-rules";
import { isAdsError } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, ClockCounterClockwise, Lightning, Plus, Trash } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { toast } from "sonner";
import { actionChoiceOf, type AutomatedRule } from "@/lib/advertising/rules";
import type { AdAccount } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

import { useLoadErrorState } from "../load-error-state";
import { IconAction } from "../icon-action";
import { RuleBuilderDialog } from "./rule-builder-dialog";
import { RuleHistorySheet } from "./rule-history-sheet";
import type { RulePermissions } from "./rules-page";
import { useRuleSentence } from "./use-rule-sentence";

export function RulesPanel({ account, permissions }: { account: AdAccount; permissions: RulePermissions }) {
  const t = useTranslations("adsRules");
  const loadError = useLoadErrorState();
  const sentence = useRuleSentence(account.currency);
  const load = useCallback(() => listRulesAction(account.id), [account.id]);
  const list = useKeyedLoad(account.id, load);
  const [building, setBuilding] = useState(false);
  const [deleting, setDeleting] = useState<AutomatedRule | null>(null);
  const [history, setHistory] = useState<AutomatedRule | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const response = list.latest;
  const rules = response && !isAdsError(response) ? response.data : [];
  const error = response && isAdsError(response) ? response.error : null;

  const patchRule = (metaId: string, change: Partial<AutomatedRule>) =>
    list.update((current) =>
      isAdsError(current) ? current : { data: current.data.map((rule) => (rule.metaId === metaId ? { ...rule, ...change } : rule)) },
    );

  const markPending = (metaId: string, busy: boolean) =>
    setPending((current) => {
      const next = new Set(current);
      if (busy) next.add(metaId);
      else next.delete(metaId);
      return next;
    });

  const toggle = async (rule: AutomatedRule, enabled: boolean) => {
    if (!rule.metaId) return;
    const metaId = rule.metaId;
    const previous = rule.status;
    markPending(metaId, true);
    patchRule(metaId, { status: enabled ? "ENABLED" : "DISABLED" });
    const outcome = await setRuleEnabledAction(metaId, account.id, enabled);
    markPending(metaId, false);
    if (isAdsError(outcome)) {
      patchRule(metaId, { status: previous });
      toast.error(t("toggle.failed", { name: rule.name }), { description: outcome.error });
    }
  };

  const confirmDelete = async () => {
    const target = deleting;
    if (!target?.metaId) return;
    const outcome = await deleteRuleAction(target.metaId, account.id);
    setDeleting(null);
    if (isAdsError(outcome)) {
      toast.error(t("delete.failed"), { description: outcome.error });
      return;
    }
    toast(t("delete.done", { name: target.name }));
    list.update((current) => (isAdsError(current) ? current : { data: current.data.filter((rule) => rule.metaId !== target.metaId) }));
  };

  const created = (name: string) => {
    setBuilding(false);
    toast(t("builder.created", { name }));
    list.reload();
  };

  const appliesTo = (rule: AutomatedRule) => {
    const count = rule.objectIds?.length ?? 0;
    return count > 0 ? t(`appliesChosen.${rule.entity}`, { count }) : t(`appliesAll.${rule.entity}`);
  };

  const columns: DashboardTableColumn<AutomatedRule>[] = [
    {
      key: "status",
      header: t("columns.status"),
      render: (rule) => (
        <ElevatedSwitch
          checked={rule.status === "ENABLED"}
          disabled={!permissions.canUpdate || !rule.metaId || pending.has(rule.metaId)}
          onCheckedChange={(enabled) => void toggle(rule, enabled)}
          aria-label={t("toggle.label", { name: rule.name })}
        />
      ),
    },
    {
      key: "name",
      header: t("columns.name"),
      render: (rule) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate text-sm font-medium text-foreground">{rule.name}</p>
          <p className="text-xs text-muted-foreground">{sentence(rule)}</p>
        </div>
      ),
    },
    { key: "applies", header: t("columns.appliesTo"), render: (rule) => <span className="text-sm text-foreground">{appliesTo(rule)}</span> },
    {
      key: "action",
      header: t("columns.action"),
      render: (rule) => (
        <span className="whitespace-nowrap text-sm text-foreground">
          {t(`actionLabels.${actionChoiceOf(rule.action)}`, { percent: Math.abs(rule.action.budgetPercent ?? 0) })}
        </span>
      ),
    },
    {
      key: "frequency",
      header: t("columns.frequency"),
      render: (rule) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {t.has(`frequencies.${rule.frequency}`) ? t(`frequencies.${rule.frequency}`) : rule.frequency}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DashboardTable
        data={rules}
        columns={columns}
        rowKey={(rule, index) => rule.metaId ?? `rule-${index}`}
        loading={list.loading && !response}
        headerLeft={<p className="text-sm text-muted-foreground">{t("list.description")}</p>}
        headerRight={
          <div className="flex items-center gap-2">
            <IconAction label={t("refresh")} onClick={list.reload} disabled={list.loading}>
              <ArrowClockwise className={cn("h-4 w-4", list.loading && "animate-spin")} />
            </IconAction>
            {permissions.canCreate ? (
              <Button
                variant="primary"
                title={t("list.new")}
                icon={<Plus weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                onClick={() => setBuilding(true)}
              />
            ) : null}
          </div>
        }
        renderRowActions={(rule) => (
          <>
            <IconAction label={t("history.open")} onClick={() => setHistory(rule)} disabled={!rule.metaId}>
              <ClockCounterClockwise className="h-4 w-4" />
            </IconAction>
            {permissions.canDelete ? (
              <IconAction label={t("delete.action")} onClick={() => setDeleting(rule)} disabled={!rule.metaId} danger>
                <Trash className="h-4 w-4" />
              </IconAction>
            ) : null}
          </>
        )}
        emptyState={error ? loadError(error, list.reload) : {
          icon: <Lightning className="h-7 w-7 text-muted-foreground" />,
          title: t("list.emptyTitle"),
          description: permissions.canCreate ? t("list.emptyBody") : t("list.emptyBodyReadOnly"),
        }}
      />
      {building ? <RuleBuilderDialog account={account} onClose={() => setBuilding(false)} onCreated={created} /> : null}
      <RuleHistorySheet account={account} rule={history} onClose={() => setHistory(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("delete.title")}
        description={t("delete.body", { name: deleting?.name ?? "" })}
        confirmLabel={t("delete.action")}
        cancelLabel={t("builder.cancel")}
        tone="danger"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
