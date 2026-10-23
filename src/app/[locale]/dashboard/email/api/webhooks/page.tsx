"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { deleteEmailWebhookAction, rotateEmailWebhookSecretAction } from "@/app/actions/email-api";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { WebhookDeliveriesSheet } from "@/components/email-api/webhook-deliveries-sheet";
import { WebhookSheet } from "@/components/email-api/webhook-sheet";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import { CopyableCode } from "@/components/elevated-design/copyable-code";
import { SecretOnceDialog } from "@/components/elevated-design/secret-once-dialog";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowsClockwise, Eye, PencilSimple, Plus, Trash, WebhooksLogo, XCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useEmailWebhooks } from "@/hooks/use-email-api";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { EMAIL_API_PATH, endpointHealth, endpointHealthTone } from "@/lib/email-api/presentation";
import type { EmailWebhookEndpoint } from "@/lib/email-api/types";

const SIGNATURE_SAMPLE = "X-Webhook-Id: evt_3f2c...\nX-Webhook-Attempt: 1\nX-Webhook-Signature: t=1761140000,v1=5257e6b7...\n\nv1 = hex(HMAC_SHA256(secret, t + \".\" + raw_body))";

export default function EmailWebhooksPage() {
  const t = useTranslations("emailApi.webhooks");
  const ta = useTranslations("emailApi");
  const tm = useTranslations("emailMarketing");
  const format = useFormatter();
  const describe = useEmailError();
  const router = useRouter();
  const webhooks = useEmailWebhooks();
  const canConfigure = useSettledPermission("email_marketing", "configure");
  const [editing, setEditing] = useState<EmailWebhookEndpoint | null | undefined>(undefined);
  const [watching, setWatching] = useState<EmailWebhookEndpoint | null>(null);
  const [removing, setRemoving] = useState<EmailWebhookEndpoint | null>(null);
  const [rotating, setRotating] = useState<EmailWebhookEndpoint | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const endpoints = webhooks.data?.endpoints ?? [];
  const events = webhooks.data?.events ?? [];
  const limit = webhooks.data?.limit ?? 0;
  const failing = endpoints.filter((e) => endpointHealth(e) === "failing").length;
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "short", timeStyle: "short" });

  const remove = async () => {
    if (!removing) return true;
    const result = await deleteEmailWebhookAction(removing.id);
    if (isActionError(result)) {
      toast.error(describe(result));
      return true;
    }
    toast.success(t("removed"));
    void webhooks.refetch();
    return true;
  };

  const rotate = async () => {
    if (!rotating) return true;
    const result = await rotateEmailWebhookSecretAction(rotating.id);
    if (isActionError(result)) {
      toast.error(describe(result));
      return true;
    }
    setSecret(result.data.secret);
    void webhooks.refetch();
    return true;
  };

  const columns: DashboardTableColumn<EmailWebhookEndpoint>[] = [
    {
      header: t("columns.url"),
      key: "url",
      render: (row) => (
        <span className="block min-w-0">
          <span className="block truncate font-mono text-xs text-foreground">{row.url}</span>
          <span className="block text-xs text-muted-foreground">{t("secretHint", { hint: row.secret_hint })}</span>
        </span>
      ),
    },
    {
      header: t("columns.events"),
      key: "events",
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.events.map((event) => (
            <StatusChip key={event} tone="outline" label={t.has(`eventNames.${event}`) ? t(`eventNames.${event}`) : event} />
          ))}
        </span>
      ),
    },
    {
      header: t("columns.health"),
      key: "health",
      render: (row) => {
        const health = endpointHealth(row);
        return (
          <span className="flex flex-col gap-0.5">
            <StatusChip tone={endpointHealthTone(health)} label={t(`health.${health}`)} />
            {health === "failing" && row.failing_since ? <span className="text-xs text-muted-foreground">{t("failingSince", { at: date(row.failing_since) })}</span> : null}
          </span>
        );
      },
    },
    {
      header: t("columns.actions"),
      key: "actions",
      className: "text-right",
      render: (row) => (
        <span className="inline-flex gap-1">
          <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" weight="bold" />} iconVisible aria-label={t("viewDeliveries")} onClick={() => setWatching(row)} />
          {canConfigure ? (
            <>
              <Button size="sm" variant="ghost" icon={<PencilSimple className="h-3.5 w-3.5" weight="bold" />} iconVisible aria-label={t("edit")} onClick={() => setEditing(row)} />
              <Button size="sm" variant="ghost" icon={<ArrowsClockwise className="h-3.5 w-3.5" weight="bold" />} iconVisible aria-label={t("rotate")} onClick={() => setRotating(row)} />
              <Button size="sm" variant="ghost" icon={<Trash className="h-3.5 w-3.5" weight="bold" />} iconVisible aria-label={t("remove")} onClick={() => setRemoving(row)} />
            </>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        icon={<WebhooksLogo weight="bold" />}
        badge={t("title")}
        description={t("description")}
        back={{ onClick: () => router.push(EMAIL_API_PATH), label: ta("detail.back") }}
        actions={
          canConfigure && endpoints.length < limit ? <Button icon={<Plus className="h-4 w-4" weight="bold" />} iconVisible title={t("create")} onClick={() => setEditing(null)} /> : undefined
        }
      />

      <DashboardTable<EmailWebhookEndpoint>
        stats={[
          { label: t("stats.endpoints"), value: `${endpoints.length}/${limit}` },
          { label: t("stats.failing"), value: failing },
        ]}
        data={webhooks.isError ? [] : endpoints}
        columns={columns}
        rowKey={(row) => row.id}
        loading={webhooks.isPending}
        emptyState={
          webhooks.isError
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="bold" />,
                title: t("loadFailed"),
                description: describe(webhooks.error),
                action: <Button variant="outline" size="sm" title={tm("common.retry")} onClick={() => void webhooks.refetch()} />,
              }
            : { icon: <WebhooksLogo className="h-7 w-7 text-muted-foreground" weight="bold" />, title: t("emptyTitle"), description: t("emptyText") }
        }
      />

      <PanelSection title={t("signing.title")} description={t("signing.description")}>
        <CopyableCode code={SIGNATURE_SAMPLE} copyLabel={t("signing.copy")} copiedLabel={t("signing.copied")} failedLabel={t("signing.copyFailed")} />
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("signing.retries")}</p>
      </PanelSection>

      {editing !== undefined ? (
        <WebhookSheet
          endpoint={editing}
          events={events}
          onClose={() => setEditing(undefined)}
          onSaved={(created) => {
            setEditing(undefined);
            if (created) setSecret(created);
            else toast.success(t("saved"));
            void webhooks.refetch();
          }}
        />
      ) : null}

      {watching ? <WebhookDeliveriesSheet endpoint={watching} canConfigure={canConfigure} onClose={() => setWatching(null)} /> : null}

      <SecretOnceDialog secret={secret} title={t("secret.title")} description={t("secret.description")} onClose={() => setSecret(null)} />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title={t("removeTitle")}
        description={t("removeText", { url: removing?.url ?? "" })}
        confirmLabel={t("removeConfirm")}
        cancelLabel={tm("common.cancel")}
        onConfirm={remove}
      />
      <ConfirmDialog
        open={rotating !== null}
        onOpenChange={(open) => (open ? undefined : setRotating(null))}
        title={t("rotateTitle")}
        description={t("rotateText")}
        confirmLabel={t("rotateConfirm")}
        cancelLabel={tm("common.cancel")}
        onConfirm={rotate}
        tone="default"
      />
    </main>
  );
}
