"use client";

import { motion } from "framer-motion";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { addSuppressionAction, listSuppressionsAction, removeSuppressionAction } from "@/app/actions/carrier-messaging";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { CircleNotch, Plus, Prohibit, XCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CodedRefusal } from "@/lib/api/coded-error";
import type { Suppression } from "@/lib/carrier-messaging/settings";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";

import { useLoaded } from "@/lib/carrier-messaging/use-loaded";

export const SUPPRESSIONS_PAGE_SIZE = 50;

function SourceLabel({ source }: { source: string }) {
  const t = useTranslations("carrierMessaging.pages.suppressions.sources");
  return <span className="text-sm text-foreground">{t.has(source) ? t(source) : source}</span>;
}

function AddPhone({ onAdded }: { onAdded: () => void }) {
  const t = useTranslations("carrierMessaging.pages.suppressions.add");
  const refusalText = useCarrierRefusalText();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<CodedRefusal | null>(null);

  const submit = async () => {
    if (!phone.trim()) return;
    setBusy(true);
    const answer = await addSuppressionAction(phone.trim());
    setBusy(false);
    if (answer.error) {
      setRefusal(answer.error);
      return;
    }
    setRefusal(null);
    setPhone("");
    toast.success(t("done"));
    onAdded();
  };

  return (
    <form
      className="flex w-full flex-wrap items-start gap-2 sm:w-auto"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <ElevatedInput
        label={t("phone")}
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={refusal ? refusalText(refusal) : undefined}
        controlSize="sm"
        className="w-full sm:w-56"
        disabled={busy}
      />
      <Button type="submit" title={t("submit")} icon={busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} iconVisible disabled={busy || !phone.trim()} />
    </form>
  );
}

export function CarrierSuppressionsPage({ headerActions }: { headerActions?: ReactNode } = {}) {
  const t = useTranslations("carrierMessaging.pages.suppressions");
  const format = useFormatter();
  const refusalText = useCarrierRefusalText();
  const [page, setPage] = useState(1);
  const offset = (page - 1) * SUPPRESSIONS_PAGE_SIZE;
  const load = useCallback((signal: AbortSignal) => listSuppressionsAction(SUPPRESSIONS_PAGE_SIZE, offset, signal), [offset]);
  const suppressions = useLoaded(load, String(offset));
  const items = useMemo(() => suppressions.data?.items ?? [], [suppressions.data]);
  const total = suppressions.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / SUPPRESSIONS_PAGE_SIZE));

  const remove = useCallback(
    async (item: Suppression) => {
      const answer = await removeSuppressionAction(item.phone);
      if (answer.error) {
        toast.error(refusalText(answer.error));
        return false;
      }
      toast.success(t("removed", { phone: item.phone }));
      suppressions.reload();
    },
    [refusalText, suppressions, t],
  );

  const columns = useMemo<DashboardTableColumn<Suppression>[]>(
    () => [
      { header: t("table.phone"), key: "phone", render: (item) => <span className="readout text-sm font-medium tabular-nums text-foreground">{item.phone}</span> },
      { header: t("table.source"), key: "source", render: (item) => <SourceLabel source={item.source} /> },
      {
        header: t("table.since"),
        key: "since",
        render: (item) => <span className="text-sm tabular-nums text-muted-foreground">{format.dateTime(new Date(item.created_at), { dateStyle: "medium", timeStyle: "short" })}</span>,
      },
      {
        header: t("table.actions"),
        key: "actions",
        className: "text-right",
        render: (item) => (
          <ConfirmDialog
            trigger={<Button variant="ghost" size="sm" title={t("remove")} />}
            title={t("removeTitle", { phone: item.phone })}
            description={t("removeDescription")}
            confirmLabel={t("remove")}
            tone="default"
            onConfirm={() => remove(item)}
          />
        ),
      },
    ],
    [t, format, remove],
  );

  return (
    <motion.main className="w-full space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardPageHeader icon={<Prohibit className="h-6 w-6" />} badge={t("header.badge")} description={t("header.description")} actions={headerActions} />
      <DashboardTable<Suppression>
        stats={[{ label: t("stats.total"), value: suppressions.status === "loading" ? "..." : format.number(total), icon: <Prohibit className="h-4 w-4 text-muted-foreground" /> }]}
        headerRight={
          <AddPhone
            onAdded={() => {
              setPage(1);
              suppressions.reload();
            }}
          />
        }
        data={items}
        columns={columns}
        rowKey={(row) => row.phone}
        loading={suppressions.status === "loading"}
        pagination={
          totalPages > 1
            ? { currentPage: page, totalPages, pageSize: SUPPRESSIONS_PAGE_SIZE, totalItems: total, onPageChange: setPage }
            : undefined
        }
        emptyState={
          suppressions.status === "failed"
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("failedTitle"),
                description: refusalText(suppressions.error),
                action: <Button variant="secondary" title={t("retry")} onClick={suppressions.reload} />,
              }
            : { icon: <Prohibit className="h-7 w-7 text-muted-foreground" />, title: t("empty.title"), description: t("empty.description") }
        }
      />
    </motion.main>
  );
}
