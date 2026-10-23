"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { ArrowsClockwise } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { retrySheetProblems } from "@/lib/google-sheets/client";
import type { SheetHealth, SheetProblemRow } from "@/lib/google-sheets/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[--radius] border border-border bg-mist px-3 py-2">
      <p className="truncate text-2xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function SheetHealthCard({ health, canEdit, onChanged }: { health: SheetHealth; canEdit: boolean; onChanged: () => void }) {
  const t = useTranslations("googleSheets");
  const format = useFormatter();
  const [retrying, setRetrying] = useState(false);
  const stuck = health.held + health.failed;

  const retry = async () => {
    setRetrying(true);
    const res = await retrySheetProblems(health.sheet.id);
    setRetrying(false);
    if (res.error || !res.data) {
      toast.error(t("health.retryFailed"), { description: codedErrorMessage(t, res.error ?? {}, "") });
      return;
    }
    toast(t("health.retried", { count: res.data.requeued }));
    onChanged();
  };

  const columns: DashboardTableColumn<SheetProblemRow>[] = [
    {
      key: "status",
      header: t("health.problemStatus"),
      render: (row) => <StatusChip tone={row.status === "failed" ? "fault" : "warning"} label={t(`rowStatus.${row.status}`)} />,
    },
    {
      key: "error",
      header: t("health.problemError"),
      render: (row) => <span className="text-sm text-foreground">{codedErrorMessage(t, { code: row.errorCode }, row.errorDetail ?? row.errorCode)}</span>,
    },
    { key: "origin", header: t("health.problemOrigin"), render: (row) => <span className="text-sm text-muted-foreground">{t(`origins.${row.origin}`)}</span> },
    { key: "attempts", header: t("health.problemAttempts"), render: (row) => <span className="text-sm tabular-nums text-muted-foreground">{row.attempts}</span> },
    {
      key: "createdAt",
      header: t("health.problemCreatedAt"),
      render: (row) => <span className="text-sm text-muted-foreground">{format.dateTime(new Date(row.createdAt), { dateStyle: "short", timeStyle: "short" })}</span>,
    },
  ];

  return (
    <ElevatedContainer>
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t("health.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {health.oldestPendingAt
                ? t("health.oldestPending", { at: format.dateTime(new Date(health.oldestPendingAt), { dateStyle: "short", timeStyle: "short" }) })
                : t("health.queueEmpty")}
            </p>
          </div>
          {canEdit && stuck > 0 ? (
            <ElevatedButton
              variant="secondary"
              size="sm"
              title={t("health.retry")}
              icon={<ArrowsClockwise size={14} />}
              iconVisible
              onClick={() => void retry()}
              disabled={retrying}
            />
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label={t("health.pending")} value={format.number(health.pending)} />
          <Stat label={t("health.inFlight")} value={format.number(health.inFlight)} />
          <Stat label={t("health.held")} value={format.number(health.held)} />
          <Stat label={t("health.failed")} value={format.number(health.failed)} />
          <Stat
            label={t("health.written")}
            value={health.writtenCapped ? t("health.writtenCapped", { count: format.number(health.written) }) : format.number(health.written)}
          />
        </div>
        {health.problems.length > 0 ? (
          <DashboardTable<SheetProblemRow> data={health.problems} columns={columns} rowKey={(row) => row.id} caption={t("health.problems")} />
        ) : null}
      </div>
    </ElevatedContainer>
  );
}
