"use client";

import {
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  Eye,
  MagnifyingGlass,
  Plus,
  Trash,
  Warning,
} from "@/components/icons";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { RestrictionNotice, SessionState } from "@/components/unofficial-whatsapp/session-state";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteInstanceAction,
  getInstanceAllowanceAction,
  listInstancesAction,
  resetInstanceAction,
  updateInstanceAction,
} from "@/app/actions/unofficial-whatsapp";
import {
  instanceIssue,
  type UnofficialWhatsAppAllowance,
  type UnofficialWhatsAppInstance,
} from "@/lib/unofficial-whatsapp/types";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DepartmentRowSwitcher } from "@/components/dashboard/DepartmentRowSwitcher";
import UnofficialWhatsAppCapacityCard from "@/components/dashboard/addons/UnofficialWhatsAppCapacityCard";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { WhatsAppLogoColor } from "@/components/icons/channel-logos";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const ITEMS_PER_PAGE = 15;

const LIVE_REFRESH_MS = 8000;

export default function UnofficialWhatsAppPage() {
  const t = useTranslations("unofficialWhatsapp");
  const { can } = useWorkspace();
  const router = useRouter();
  const { toast } = useToast();

  const [instances, setInstances] = useState<UnofficialWhatsAppInstance[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<UnofficialWhatsAppAllowance | null>(null);

  const canCreate = can("unofficial_whatsapp_instances", "create");
  const canUpdate = can("unofficial_whatsapp_instances", "update");
  const canDelete = can("unofficial_whatsapp_instances", "delete");

  const fetchInstances = useCallback(
    async (nextPage = 1, term = "", quiet = false) => {
      if (!quiet) setLoading(true);
      const result = await listInstancesAction(nextPage, ITEMS_PER_PAGE, term || undefined);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setInstances(result.instances);
        setPage(result.meta.page);
        setTotalPages(result.meta.totalPages);
        setTotalItems(result.meta.totalItems);
      }
      if (!quiet) setLoading(false);
    },
    [],
  );

  const fetchAllowance = useCallback(async () => {
    const result = await getInstanceAllowanceAction();
    if (!result.error && result.allowance) setAllowance(result.allowance);
  }, []);

  useEffect(() => {
    void fetchInstances(1, "");
    void fetchAllowance();
  }, [fetchInstances, fetchAllowance]);

  const hasMovingParts = useMemo(
    () =>
      instances.some((instance) => {
        const issue = instanceIssue(instance);
        return issue === "awaiting-scan" || issue === "provisioning" || issue === "disconnected";
      }),
    [instances],
  );

  useEffect(() => {
    if (!hasMovingParts) return;
    const timer = setInterval(() => void fetchInstances(page, search, true), LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasMovingParts, fetchInstances, page, search]);

  const handleSearch = useCallback(
    (term: string) => {
      setSearch(term);
      void fetchInstances(1, term);
    },
    [fetchInstances],
  );

  const handleDelete = useCallback(
    async (instance: UnofficialWhatsAppInstance) => {
      setBusyId(instance.id);
      const result = await deleteInstanceAction(instance.id);
      setBusyId(null);

      if (result.error) {
        toast({ title: t("actions.remove"), description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: t("actions.remove"),
        description: t("notice.removed", { name: instance.displayName }),
      });
      void fetchInstances(page, search);
      void fetchAllowance();
    },
    [toast, t, fetchInstances, fetchAllowance, page, search],
  );

  const handleReset = useCallback(
    async (instance: UnofficialWhatsAppInstance) => {
      setBusyId(instance.id);
      const result = await resetInstanceAction(instance.id);
      setBusyId(null);

      toast({
        title: t("actions.reset"),
        description: result.error ?? t("notice.resetStarted"),
        variant: result.error ? "destructive" : undefined,
      });
      void fetchInstances(page, search, true);
    },
    [toast, t, fetchInstances, page, search],
  );

  const restricted = useMemo(
    () => instances.filter((instance) => instance.restriction?.active),
    [instances],
  );

  const columns = useMemo<DashboardTableColumn<UnofficialWhatsAppInstance>[]>(
    () => [
      {
        key: "number",
        header: t("table.number"),
        render: (instance) => (
          <div className="flex min-w-0 items-center gap-3">
            {
}
            <WhatsAppLogoColor className="h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {instance.phoneNumber ? (
                  <span className="readout">+{instance.phoneNumber}</span>
                ) : (
                  instance.displayName || t("table.unlinked")
                )}
              </p>
              {instance.profileName && (
                <p className="truncate text-xs text-muted-foreground">{instance.profileName}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "state",
        header: t("table.state"),
        render: (instance) => <SessionState instance={instance} />,
      },
      {
        key: "automation",
        header: t("table.automation"),
        render: (instance) => {
          const on = instance.enableAgentResponses || instance.enableWorkflow;
          return (
            <span className={cn("text-xs", on ? "text-foreground" : "text-muted-foreground")}>
              {on ? t("table.automationOn") : t("table.automationOff")}
            </span>
          );
        },
      },
    ],
    [t],
  );

  const renderRowActions = useCallback(
    (instance: UnofficialWhatsAppInstance) => (
      <div className="flex items-center gap-1">
        {
}
        {canUpdate && (
          <DepartmentRowSwitcher
            departmentId={instance.departmentId}
            onAssign={(departmentId) =>
              updateInstanceAction(instance.id, { departmentId }).then((result) => ({
                item: result.instance ?? null,
                error: result.error,
              }))
            }
            onAssigned={() => {
              void fetchInstances(page, search);
            }}
          />
        )}

        {canUpdate && instance.sessionLive && (
          <button
            type="button"
            disabled={busyId === instance.id}
            onClick={(event) => {
              event.stopPropagation();
              void handleReset(instance);
            }}
            title={t("actions.reset")}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <ArrowClockwise
              className={cn("h-3.5 w-3.5", busyId === instance.id && "animate-spin")}
              weight="bold"
            />
            {t("actions.reset")}
          </button>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            router.push(`/dashboard/unofficial-whatsapp/${instance.id}`);
          }}
          title={t("actions.open")}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Eye className="h-3.5 w-3.5" weight="bold" />
          {t("actions.open")}
        </button>

        {canDelete && (
          <button
            type="button"
            disabled={busyId === instance.id}
            onClick={(event) => {
              event.stopPropagation();
              void handleDelete(instance);
            }}
            title={t("actions.remove")}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-destructive-ink transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Trash className="h-3.5 w-3.5" weight="bold" />
            {t("actions.remove")}
          </button>
        )}
      </div>
    ),
    [t, canUpdate, canDelete, busyId, handleDelete, handleReset, router, fetchInstances, page, search],
  );

  const connectedCount = useMemo(
    () => instances.filter((instance) => instance.sessionLive).length,
    [instances],
  );
  const attentionCount = useMemo(
    () => instances.filter((instance) => instanceIssue(instance) !== null).length,
    [instances],
  );

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader
        icon={<WhatsAppLogoColor className="h-6 w-6" />}
        badge={t("page.badge")}
        description={t("page.description")}
        colorClass="text-healthy-ink"
        actions={
          <div className="flex items-center gap-2">
            {
}
            {allowance && (
              <span
                className={cn(
                  "hidden rounded-[--radius] border px-2.5 py-1 text-xs font-medium tabular-nums sm:inline-flex",
                  allowance.canConnect
                    ? "border-border bg-card text-muted-foreground"
                    : "border-border bg-muted text-warning-ink",
                )}
                title={t("allowance.tooltip")}
              >
                {t("allowance.counter", {
                  used: allowance.used,
                  limit: allowance.limit,
                })}
              </span>
            )}
            {canCreate && (
              <Button
                variant="primary"
                link={
                  allowance && !allowance.canConnect
                    ? undefined
                    : "/dashboard/unofficial-whatsapp/connect"
                }
                newTab={false}
                title={t("page.connect")}
                icon={<Plus weight="bold" className="h-4 w-4" />}
                iconVisible
                disabled={Boolean(allowance && !allowance.canConnect)}
              />
            )}
          </div>
        }
      />

      {
}
      <UnofficialWhatsAppCapacityCard allowance={allowance} />

      {
}
      {restricted.map((instance) => (
        <RestrictionNotice key={instance.id} instance={instance} />
      ))}

      {
}
      <div className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-card px-5 py-3 shadow-sm">
        <div className="relative w-full max-w-xs">
          <ElevatedInput
            type="text"
            label={t("table.search")}
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
            controlSize="sm"
            className="w-full"
          />
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-4">
          <Stat label={t("stats.total")} value={loading ? "…" : totalItems} />
          <Stat label={t("stats.connected")} value={loading ? "…" : connectedCount} />
          <Stat label={t("stats.attention")} value={loading ? "…" : attentionCount} />
        </div>

        <Button
          variant="ghost"
          title=""
          aria-label={t("actions.refresh")}
          icon={
            <ArrowClockwise weight="bold" className={cn("h-4 w-4", loading && "animate-spin")} />
          }
          iconVisible
          iconSide="left"
          onClick={() => void fetchInstances(page, search)}
          disabled={loading}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <DashboardTable<UnofficialWhatsAppInstance>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          loading
        />
      ) : instances.length === 0 ? (
        <DashboardTable<UnofficialWhatsAppInstance>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          emptyState={{
            icon: <WhatsAppLogoColor className="h-7 w-7 opacity-40" />,
            title: search ? t("empty.noMatch") : t("empty.title"),
            description: search ? t("empty.noMatchHint") : t("empty.description"),
            action:
              !search && canCreate ? (
                <div className="mt-2 flex items-center gap-3">
                  <Button
                    variant="primary"
                    link="/dashboard/unofficial-whatsapp/connect"
                    newTab={false}
                    title={t("page.connect")}
                    icon={<Plus weight="bold" className="h-4 w-4" />}
                    iconVisible
                    iconSide="left"
                  />
                </div>
              ) : undefined,
          }}
        />
      ) : (
        <div className="space-y-4">
          {
}
          <ElevatedContainer className="overflow-hidden rounded-lg border border-border !p-0">
            <DashboardTable<UnofficialWhatsAppInstance>
              data={instances}
              columns={columns}
              rowKey={(row) => row.id}
              onRowClick={(row) => router.push(`/dashboard/unofficial-whatsapp/${row.id}`)}
              renderRowActions={renderRowActions}
              className="rounded-none border-0 shadow-none"
            />
          </ElevatedContainer>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 px-1">
              <span className="text-xs text-muted-foreground">
                {t("pagination.pageOf", { page, totalPages })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => void fetchInstances(page - 1, search)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CaretLeft className="h-3.5 w-3.5" weight="bold" />
                  {t("pagination.previous")}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => void fetchInstances(page + 1, search)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("pagination.next")}
                  <CaretRight className="h-3.5 w-3.5" weight="bold" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
