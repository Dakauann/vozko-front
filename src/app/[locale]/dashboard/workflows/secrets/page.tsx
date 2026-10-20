"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { DotsThree, Key, PencilSimple, Plus, Trash } from "@/components/icons";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedButton from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { CopyValueButton } from "@/components/crm/CopyValueButton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { useAssignableMembers } from "@/hooks/use-assignable-members";
import { codedErrorMessage } from "@/lib/api/coded-error";
import {
  deleteWorkflowSecretAction,
  listWorkflowSecretsAction,
} from "@/app/actions/workflow-secrets";
import type { SecretNameList } from "@/lib/workflow-secrets/secret-create";
import { secretUsageSnippets } from "@/lib/workflow-secrets/secret-name";
import type { WorkflowSecret } from "@/lib/workflow-secrets/types";

import {
  WorkflowSecretDialog,
  type WorkflowSecretDialogMode,
} from "./_components/workflow-secret-dialog";

interface LoadedSecrets {
  key: string;
  secrets: WorkflowSecret[];
  error: string | null;
}

export default function WorkflowSecretsPage() {
  const t = useTranslations("workflowSecretsPage");
  const format = useFormatter();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const canManage = useSettledPermission("workflows", "update");
  const canReadMembers = useSettledPermission("members", "read");
  const { names } = useAssignableMembers(canReadMembers);

  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<LoadedSecrets | null>(null);
  const [dialog, setDialog] = useState<WorkflowSecretDialogMode | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const requestKey = `${workspaceId}:${reloadKey}`;
  const loading = loaded?.key !== requestKey;
  const secrets = useMemo(() => (loading ? [] : (loaded?.secrets ?? [])), [loading, loaded]);
  const error = loading ? null : (loaded?.error ?? null);
  const existing = useMemo<SecretNameList>(
    () => ({ names: new Set(secrets.map((secret) => secret.name)), loading, failed: error !== null }),
    [secrets, loading, error],
  );

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void listWorkflowSecretsAction().then((result) => {
      if (cancelled) return;
      setLoaded({ key: requestKey, secrets: result.secrets, error: result.error ? codedErrorMessage(t, result, result.error) : null });
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, requestKey, t]);

  const reload = () => setReloadKey((previous) => previous + 1);

  const remove = async () => {
    if (!deleting) return;
    const result = await deleteWorkflowSecretAction(deleting);
    if (result.error) {
      toast.error(t("toast.deleteFailed"), { description: codedErrorMessage(t, result, result.error) });
      return false;
    }
    toast(t("toast.deleted"));
    setDeleting(null);
    reload();
  };

  const columns = useMemo<DashboardTableColumn<WorkflowSecret>[]>(
    () => [
      {
        key: "name",
        header: t("table.name"),
        render: (row) => (
          <span className="font-mono text-sm font-medium text-foreground">{row.name}</span>
        ),
      },
      {
        key: "usage",
        header: t("table.usage"),
        render: (row) => {
          const snippets = secretUsageSnippets(row.name);
          return (
            <div className="flex flex-col items-start gap-1 font-mono">
              <CopyValueButton value={snippets.template} label={t("copy.template")} copiedMessage={t("copy.copied")}>
                {snippets.template}
              </CopyValueButton>
              <CopyValueButton value={snippets.code} label={t("copy.code")} copiedMessage={t("copy.copied")}>
                {snippets.code}
              </CopyValueButton>
            </div>
          );
        },
      },
      {
        key: "updatedAt",
        header: t("table.updatedAt"),
        render: (row) => {
          const at = new Date(row.updatedAt);
          if (!row.updatedAt || Number.isNaN(at.getTime())) return <EmptyValue className="text-sm" />;
          return (
            <span className="text-sm text-muted-foreground">
              {format.dateTime(at, { dateStyle: "short", timeStyle: "short" })}
            </span>
          );
        },
      },
      {
        key: "updatedBy",
        header: t("table.updatedBy"),
        render: (row) => {
          const name = names.get(row.updatedBy);
          return name ? (
            <span className="text-sm text-foreground">{name}</span>
          ) : (
            <EmptyValue className="text-sm" />
          );
        },
      },
    ],
    [t, format, names],
  );

  const newSecretButton = canManage ? (
    <ElevatedButton
      onClick={() => setDialog({ kind: "create" })}
      className="gap-2"
      icon={<Plus size={16} weight="bold" />}
      title={t("actions.new")}
      iconVisible
    />
  ) : null;

  return (
    <motion.main
      className="w-full space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <DashboardPageHeader
        icon={<Key size={20} weight="duotone" />}
        badge={t("header.badge")}
        description={t("header.description")}
        back={{ onClick: () => router.push("/dashboard/workflows"), label: t("header.back") }}
      />

      <DashboardTable<WorkflowSecret>
        data={secrets}
        columns={columns}
        rowKey={(row) => row.name}
        loading={loading}
        headerRight={newSecretButton}
        renderRowActions={
          canManage
            ? (row) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("actions.menu", { name: row.name })}
                      onClick={(event) => event.stopPropagation()}
                      className="rounded-lg p-1.5 transition-colors hover:bg-muted"
                    >
                      <DotsThree size={18} weight="bold" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setDialog({ kind: "replace", name: row.name })}>
                      <PencilSimple size={14} className="mr-2" />
                      {t("actions.replace")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDeleting(row.name)} className="text-destructive-ink">
                      <Trash size={14} className="mr-2" />
                      {t("actions.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            : undefined
        }
        emptyState={
          error
            ? {
                icon: <Key size={48} weight="duotone" className="text-destructive-ink" />,
                title: t("error.title"),
                description: error,
                action: <ElevatedButton variant="outline" title={t("error.retry")} onClick={reload} />,
              }
            : {
                icon: <Key size={48} weight="duotone" className="text-muted-foreground" />,
                title: t("empty.title"),
                description: t("empty.description"),
                action: newSecretButton ? <div className="mt-4">{newSecretButton}</div> : undefined,
              }
        }
      />

      {dialog ? (
        <WorkflowSecretDialog
          key={dialog.kind === "replace" ? `replace:${dialog.name}` : "create"}
          mode={dialog}
          existing={existing}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("confirm.deleteTitle", { name: deleting ?? "" })}
        description={t("confirm.deleteDescription")}
        confirmLabel={t("confirm.deleteConfirm")}
        cancelLabel={t("confirm.cancel")}
        onConfirm={remove}
      />
    </motion.main>
  );
}
