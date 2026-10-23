"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { revokeApiKeyAction } from "@/app/actions/api-keys";
import { CreateApiKeySheet } from "@/components/api-keys/create-api-key-sheet";
import { useApiKeyError } from "@/components/api-keys/use-api-key-error";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { SecretOnceDialog } from "@/components/elevated-design/secret-once-dialog";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { Key, Plus, Trash, XCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import type { ApiKey } from "@/lib/api-keys/types";

export default function ApiKeysPage() {
  const t = useTranslations("apiKeys");
  const format = useFormatter();
  const describe = useApiKeyError();
  const keys = useApiKeys();
  const canCreate = useSettledPermission("api_keys", "create");
  const canRevoke = useSettledPermission("api_keys", "delete");
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  const rows = keys.data?.keys ?? [];
  const active = rows.filter((k) => k.revoked_at === null).length;
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "short", timeStyle: "short" });

  const revoke = async () => {
    if (!revoking) return true;
    const result = await revokeApiKeyAction(revoking.id);
    if (isActionError(result)) {
      toast.error(describe(result));
      return true;
    }
    toast.success(t("revoked", { name: revoking.name }));
    void keys.refetch();
    return true;
  };

  const columns: DashboardTableColumn<ApiKey>[] = [
    {
      header: t("columns.name"),
      key: "name",
      render: (row) => (
        <span className="block min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{row.name}</span>
          <span className="block font-mono text-xs text-muted-foreground">{row.prefix}</span>
        </span>
      ),
    },
    {
      header: t("columns.scopes"),
      key: "scopes",
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.scopes.map((scope) => (
            <StatusChip key={scope} tone="outline" label={scope} />
          ))}
        </span>
      ),
    },
    { header: t("columns.created"), key: "created", render: (row) => <span className="text-sm text-muted-foreground tabular-nums">{date(row.created_at)}</span> },
    {
      header: t("columns.lastUsed"),
      key: "lastUsed",
      render: (row) => (row.last_used_at ? <span className="text-sm text-muted-foreground tabular-nums">{date(row.last_used_at)}</span> : <EmptyValue />),
    },
    {
      header: t("columns.status"),
      key: "status",
      render: (row) => (row.revoked_at ? <StatusChip tone="muted" label={t("status.revoked")} /> : <StatusChip tone="healthy" label={t("status.active")} />),
    },
    ...(canRevoke
      ? [
          {
            header: t("columns.actions"),
            key: "actions",
            className: "text-right",
            render: (row: ApiKey) =>
              row.revoked_at ? null : (
                <Button size="sm" variant="ghost" icon={<Trash className="h-3.5 w-3.5" weight="bold" />} iconVisible aria-label={t("revoke", { name: row.name })} onClick={() => setRevoking(row)} />
              ),
          },
        ]
      : []),
  ];

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        icon={<Key weight="fill" />}
        badge={t("title")}
        description={t("description")}
        actions={canCreate ? <Button icon={<Plus className="h-4 w-4" weight="bold" />} iconVisible title={t("create")} onClick={() => setCreating(true)} /> : undefined}
      />

      <DashboardTable<ApiKey>
        stats={[
          { label: t("stats.active"), value: active },
          { label: t("stats.revoked"), value: rows.length - active },
        ]}
        data={keys.isError ? [] : rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={keys.isPending}
        emptyState={
          keys.isError
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="bold" />,
                title: t("loadFailed"),
                description: describe(keys.error),
                action: <Button variant="outline" size="sm" title={t("common.retry")} onClick={() => void keys.refetch()} />,
              }
            : { icon: <Key className="h-7 w-7 text-muted-foreground" weight="bold" />, title: t("emptyTitle"), description: t("emptyText") }
        }
      />

      {creating ? (
        <CreateApiKeySheet
          products={keys.data?.products ?? []}
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            setSecret(created.key);
            void keys.refetch();
          }}
        />
      ) : null}

      <SecretOnceDialog secret={secret} title={t("secret.title")} description={t("secret.description")} onClose={() => setSecret(null)} />

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => (open ? undefined : setRevoking(null))}
        title={t("revokeTitle", { name: revoking?.name ?? "" })}
        description={t("revokeText")}
        confirmLabel={t("revokeConfirm")}
        cancelLabel={t("common.cancel")}
        onConfirm={revoke}
      />
    </main>
  );
}
