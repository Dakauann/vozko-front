"use client";

import { useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { crmBulkAction } from "@/app/actions/crm-board";
import AssignMemberPicker from "@/components/crm/AssignMemberPicker";
import { BulkMenu } from "@/components/crm/BulkMenu";
import { OutcomePickerDialog } from "@/components/crm/OutcomePickerDialog";
import { Check, Checks, Tag } from "@/components/icons";
import { BULK_CONTROL } from "@/components/selection/GuardedAction";
import { SelectionCheckbox, type SelectionCheckState } from "@/components/selection/SelectionCheckbox";
import { outcomeIsRequired, useOutcomeCapture } from "@/hooks/use-outcome-capture";
import type { Label, PendingOutcomeRequest } from "@/lib/conversations/types";
import type { CrmBulkActionType, CrmBulkInput, CrmBulkTarget } from "@/lib/crm/board";
import { reportBulkResult } from "@/lib/crm/bulk-report";
import { bulkRequest } from "@/lib/crm/bulk-selection";
import type { PageHeaderState } from "@/lib/selection/bulk-state";

const BULK_OUTCOME_KEY = "bulk";

const HEADER_CHECK: Record<PageHeaderState, SelectionCheckState> = { all: true, some: "mixed", none: false };

interface InboxBulkBarProps {
  targets: CrmBulkTarget[];
  headerState: PageHeaderState;
  workspaceId?: string;
  labels: Label[];
  canAssign: boolean;
  canLabel: boolean;
  canFinish: boolean;
  onToggleAll: () => void;
  onDone: () => void;
  onCancel: () => void;
  onRead: (targets: CrmBulkTarget[]) => void;
}

type BulkExtra = Pick<CrmBulkInput, "outcomeCode">;

function succeededTargets(targets: CrmBulkTarget[], failedIds: readonly string[]): CrmBulkTarget[] {
  const failed = new Set(failedIds);
  return targets.filter((target) => !failed.has(target.entryId));
}

function escapesFromInside(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === "Escape" && event.currentTarget.contains(event.target as Node);
}

export function InboxBulkBar({
  targets,
  headerState,
  workspaceId,
  labels,
  canAssign,
  canLabel,
  canFinish,
  onToggleAll,
  onDone,
  onCancel,
  onRead,
}: InboxBulkBarProps) {
  const t = useTranslations("crmInbox.bulk");
  const tReport = useTranslations("crmBoard.bulk");
  const [busy, setBusy] = useState(false);
  const [askingOutcome, setAskingOutcome] = useState(false);
  const { capture } = useOutcomeCapture(workspaceId);
  const picksAny = targets.length > 0;

  const run = async (action: CrmBulkActionType, value = "", extra: BulkExtra = {}) => {
    setBusy(true);
    const { result, error } = await crmBulkAction({ ...bulkRequest(action, value, { kind: "ids", targets }), ...extra });
    setBusy(false);
    if (error || !result) {
      toast.error(t("failed"));
      return;
    }
    reportBulkResult(tReport, result);
    if (action === "mark_read") onRead(succeededTargets(targets, result.failed.map((failure) => failure.entryId)));
    onDone();
  };

  const finish = () => {
    if (outcomeIsRequired(capture)) setAskingOutcome(true);
    else void run("close");
  };

  const outcomeRequest: PendingOutcomeRequest | null = askingOutcome
    ? { entryId: BULK_OUTCOME_KEY, entryType: "whatsapp", status: "finished", message: "", outcomes: capture?.outcomes ?? [] }
    : null;

  return (
    <div
      role="toolbar"
      aria-label={t("toolbar")}
      onKeyDown={(event) => {
        if (!escapesFromInside(event)) return;
        event.preventDefault();
        onCancel();
      }}
      className="flex min-h-12 flex-wrap items-center gap-1.5 border-b border-border bg-muted py-2 pl-4 pr-3"
    >
      <SelectionCheckbox checked={HEADER_CHECK[headerState]} label={t("selectAll")} onToggle={onToggleAll} />
      <span aria-live="polite" className="readout ml-1.5 mr-auto text-2xs font-semibold text-foreground">
        {t("selected", { count: targets.length })}
      </span>
      {picksAny && canAssign && workspaceId ? <AssignMemberPicker workspaceId={workspaceId} onAssign={(userId) => void run("assign", userId)} /> : null}
      {picksAny && canLabel && labels.length > 0 ? (
        <BulkMenu
          triggerLabel={t("label")}
          icon={<Tag weight="bold" className="h-3.5 w-3.5" />}
          heading={t("label")}
          searchPlaceholder={t("labelSearch")}
          emptyMessage={t("noLabels")}
          options={labels.map((label) => ({ value: label.id, label: label.name, color: label.color }))}
          onSelect={(labelId) => void run("add_label", labelId)}
          disabled={busy}
        />
      ) : null}
      {picksAny && canFinish ? (
        <button type="button" disabled={busy} onClick={finish} className={BULK_CONTROL}>
          <Check weight="bold" className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {t("finish")}
        </button>
      ) : null}
      {picksAny ? (
        <button type="button" disabled={busy} onClick={() => void run("mark_read")} className={BULK_CONTROL}>
          <Checks weight="bold" className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {t("markRead")}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-8 items-center rounded-[--radius] px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("cancel")}
      </button>
      <OutcomePickerDialog
        request={outcomeRequest}
        onConfirm={(_entryId, _entryType, _status, outcomeCode) => {
          setAskingOutcome(false);
          void run("close", "", { outcomeCode });
        }}
        onCancel={() => setAskingOutcome(false)}
      />
    </div>
  );
}
