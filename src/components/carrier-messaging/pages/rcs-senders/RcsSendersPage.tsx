"use client";

import { motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { listRcsSendersAction } from "@/app/actions/rcs";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { CheckCircle, Hourglass, Plus, SealCheck, WarningCircle, XCircle } from "@/components/icons";
import { AgentAvatar } from "@/components/rcs/preview/AgentAvatar";
import { accentStyle } from "@/components/rcs/preview/palette";
import { SenderStatusChip } from "@/components/rcs/senders/SenderStatusTrack";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import type { RcsSender } from "@/lib/rcs/types";

import { CarrierAreaGate, CarrierChannelGate, ComingSoonPage } from "../../shared/ComingSoon";
import { RcsSenderEditor } from "./RcsSenderEditor";
import { useLoaded } from "@/lib/carrier-messaging/use-loaded";

type Selection = { kind: "list" } | { kind: "new" } | { kind: "sender"; id: string };

const IN_REVIEW: readonly RcsSender["status"][] = ["submitted", "awaiting_confirmation"];
const ATTENTION: readonly RcsSender["status"][] = ["paused", "rejected"];

function BrandCell({ sender, fallback }: { sender: RcsSender; fallback: string }) {
  const name = sender.brand_name.trim() || fallback;
  return (
    <div className="flex min-w-0 items-center gap-3" style={accentStyle(sender.color)}>
      <AgentAvatar name={name} logoUrl={sender.logo_url || undefined} alt="" className="h-9 w-9 text-sm" />
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{name}</p>
        <p className="max-w-[28rem] truncate text-xs text-muted-foreground">{sender.description || <EmptyValue />}</p>
      </div>
    </div>
  );
}

function RcsSendersWorkspace({ initialSenderId }: { initialSenderId?: string }) {
  const t = useTranslations("carrierMessaging.pages.rcsSenders");
  const tForm = useTranslations("rcs.senders.form");
  const format = useFormatter();
  const refusalText = useCarrierRefusalText();
  const load = useCallback((signal: AbortSignal) => listRcsSendersAction(signal), []);
  const senders = useLoaded(load);
  const [selection, setSelection] = useState<Selection>(initialSenderId ? { kind: "sender", id: initialSenderId } : { kind: "list" });
  const list = useMemo(() => senders.data?.senders ?? [], [senders.data]);
  const loading = senders.status === "loading";

  const upsert = (saved: RcsSender) => {
    senders.update((current) => ({
      senders: current.senders.some((item) => item.id === saved.id) ? current.senders.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current.senders],
    }));
    setSelection({ kind: "sender", id: saved.id });
  };

  const removed = (senderId: string) => {
    senders.update((current) => ({ senders: current.senders.filter((item) => item.id !== senderId) }));
    setSelection({ kind: "list" });
  };

  const columns = useMemo<DashboardTableColumn<RcsSender>[]>(
    () => [
      { header: t("table.brand"), key: "brand", render: (sender) => <BrandCell sender={sender} fallback={t("untitled")} /> },
      { header: t("table.status"), key: "status", render: (sender) => <SenderStatusChip status={sender.status} /> },
      {
        header: t("table.useCase"),
        key: "useCase",
        render: (sender) => (sender.use_case ? <span className="text-sm text-foreground">{tForm(`useCases.${sender.use_case}.label`)}</span> : <EmptyValue />),
      },
      {
        header: t("table.billing"),
        key: "billing",
        render: (sender) =>
          sender.billing_category ? <span className="text-sm text-foreground">{tForm(`billing.categories.${sender.billing_category}.label`)}</span> : <EmptyValue />,
      },
      {
        header: t("table.since"),
        key: "since",
        render: (sender) => (
          <span className="text-sm tabular-nums text-muted-foreground">{format.dateTime(new Date(sender.launched_at ?? sender.created_at), { dateStyle: "medium" })}</span>
        ),
      },
      {
        header: t("table.actions"),
        key: "actions",
        className: "text-right",
        render: (sender) => <Button variant="outline" size="sm" title={sender.editable ? t("edit") : t("open")} onClick={() => setSelection({ kind: "sender", id: sender.id })} />,
      },
    ],
    [t, tForm, format],
  );

  if (selection.kind !== "list") {
    const sender = selection.kind === "sender" ? (list.find((item) => item.id === selection.id) ?? null) : null;
    const waiting = selection.kind === "sender" && !sender;
    return (
      <motion.main className="w-full space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <DashboardPageHeader
          icon={<SealCheck className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          title={sender ? sender.brand_name || t("untitled") : t("editor.newTitle")}
          description={sender ? t("editor.description") : t("editor.newDescription")}
          back={{ onClick: () => setSelection({ kind: "list" }), label: t("editor.back") }}
          meta={sender ? <SenderStatusChip status={sender.status} /> : null}
        />
        {waiting ? (
          senders.status === "failed" ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-foreground">
              {refusalText(senders.error)}
              <Button variant="secondary" size="sm" title={t("retry")} onClick={senders.reload} />
            </div>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("notFound")}</p>
          )
        ) : (
          <RcsSenderEditor key={sender?.id ?? "new"} sender={sender} onSaved={upsert} onDeleted={removed} />
        )}
      </motion.main>
    );
  }

  const count = (statuses: readonly RcsSender["status"][]) => list.filter((sender) => statuses.includes(sender.status)).length;
  const stat = (value: number) => (loading ? "..." : format.number(value));

  return (
    <motion.main className="w-full space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardPageHeader
        icon={<SealCheck className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
        actions={<Button title={t("create")} icon={<Plus className="h-4 w-4" />} iconVisible onClick={() => setSelection({ kind: "new" })} />}
      />
      <DashboardTable<RcsSender>
        stats={[
          { label: t("stats.total"), value: stat(list.length), icon: <SealCheck className="h-4 w-4 text-muted-foreground" weight="fill" /> },
          { label: t("stats.launched"), value: stat(count(["launched"])), icon: <CheckCircle className="h-4 w-4 text-healthy-ink" weight="fill" /> },
          { label: t("stats.inReview"), value: stat(count(IN_REVIEW)), icon: <Hourglass className="h-4 w-4 text-info-ink" weight="fill" /> },
          { label: t("stats.attention"), value: stat(count(ATTENTION)), icon: <WarningCircle className="h-4 w-4 text-warning-ink" weight="fill" /> },
        ]}
        data={list}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) => setSelection({ kind: "sender", id: row.id })}
        emptyState={
          senders.status === "failed"
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("failedTitle"),
                description: refusalText(senders.error),
                action: <Button variant="secondary" title={t("retry")} onClick={senders.reload} />,
              }
            : {
                icon: <SealCheck className="h-7 w-7 text-muted-foreground" weight="fill" />,
                title: t("empty.title"),
                description: t("empty.description"),
                action: <Button title={t("create")} icon={<Plus className="h-4 w-4" />} iconVisible onClick={() => setSelection({ kind: "new" })} />,
              }
        }
      />
    </motion.main>
  );
}

export function RcsSendersPage({ initialSenderId }: { initialSenderId?: string }) {
  const t = useTranslations("carrierMessaging.pages.rcsSenders");
  return (
    <CarrierAreaGate badge={t("header.badge")} description={t("comingSoonDescription")}>
      <CarrierChannelGate channel="rcs" soon={<ComingSoonPage variant="rcs" badge={t("header.badge")} description={t("comingSoonDescription")} />}>
        <RcsSendersWorkspace initialSenderId={initialSenderId} />
      </CarrierChannelGate>
    </CarrierAreaGate>
  );
}
