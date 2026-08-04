"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Buildings,
  CalendarCheck,
  CaretDown,
  CaretUp,
  CircleNotch,
  CurrencyDollar,
  Envelope,
  Eye,
  MagnifyingGlass,
  Star,
  UserCircle,
  UsersFour,
  Wallet,
  X,
} from "@/components/icons";
import type { Workspace, WorkspaceMember } from "@/lib/workspace/types";
import {
  adminListAllWorkspacesAction,
  adminListWorkspaceMembersAction,
} from "@/app/actions/workspace";
import { adminCancelWorkspaceSubscriptionAction } from "@/app/actions/workspace-plan";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import Link from "next/link";
import type { User } from "@/lib/users/types";
import { cn } from "@/lib/utils";
import { getUserByIdAction } from "@/app/actions/users";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function MembersPanel({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("adminWorkspaces");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;
  const initialized = useRef(false);

  const fetchMembers = useCallback(
    async (p: number, append = false) => {
      setLoading(true);
      const result = await adminListWorkspaceMembersAction({
        workspaceId,
        page: p,
        pageSize,
      });
      if (!result.error) {
        setMembers((prev) =>
          append ? [...prev, ...result.members] : result.members,
        );
        setTotal(result.meta.total);
      }
      setLoading(false);
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      fetchMembers(1);
    }
  }, [fetchMembers]);

  const hasMore = members.length < total;

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMembers(nextPage, true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      <div className="bg-muted border-t border-border px-6 py-4">
        {loading && members.length === 0 ? (
          <div className="flex items-center justify-center py-6 gap-2">
            <CircleNotch
              className="h-4 w-4 animate-spin text-lamp-ink"
              weight="bold"
            />
            <span className="text-xs text-muted-foreground">
              {t("members.loading")}
            </span>
          </div>
        ) : members.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t("members.empty")}
          </p>
        ) : (
          <>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("members.username")}
                  </th>
                  <th className="pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("members.email")}
                  </th>
                  <th className="pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("members.role")}
                  </th>
                  <th className="pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("members.joined")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => (
                  <tr key={member.id} className="text-xs">
                    <td className="py-2 text-foreground">
                      <div className="flex items-center gap-2">
                        <UserCircle
                          className="h-4 w-4 text-muted-foreground"
                          weight="fill"
                        />
                        {member.username || "-"}
                      </div>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {member.email}
                    </td>
                    <td className="py-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-[--radius] px-2 py-0.5 text-[10px] font-semibold uppercase",
                          member.role === "owner"
                            ? "bg-muted text-white"
                            : member.role === "admin"
                              ? "bg-primary text-white"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {hasMore && (
              <div className="flex justify-center pt-3">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted hover:border-blue-300 hover:text-lamp-ink disabled:opacity-50"
                  style={{ boxShadow: softSurfaceShadow }}
                >
                  {loading ? (
                    <CircleNotch
                      className="h-3 w-3 animate-spin"
                      weight="bold"
                    />
                  ) : null}
                  {t("members.loadMore")} ({members.length}/{total})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function AdminWorkspacesPage() {
  const t = useTranslations("adminWorkspaces");
  const { toast } = useToast();
  const [searchMode, setSearchMode] = useState<"workspace" | "email">(
    "workspace",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [owners, setOwners] = useState<Record<string, User>>({});
  const ownersRef = useRef<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(
    new Set(),
  );
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const toggleExpanded = (id: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminListAllWorkspacesAction({
        page: currentPage,
        pageSize,
        search:
          searchMode === "workspace" ? searchQuery || undefined : undefined,
        memberEmail:
          searchMode === "email" ? searchQuery || undefined : undefined,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setWorkspaces(result.workspaces);
        setTotalPages(result.meta.totalPages);
        setTotalItems(result.meta.totalItems);

        const uniqueOwnerIds = [
          ...new Set(result.workspaces.map((w) => w.ownerId)),
        ];
        const missingIds = uniqueOwnerIds.filter(
          (id) => !ownersRef.current[id],
        );
        if (missingIds.length > 0) {
          Promise.all(missingIds.map((id) => getUserByIdAction(id))).then(
            (ownerResults) => {
              const newOwners: Record<string, User> = {};
              for (const res of ownerResults) {
                if (res.user) {
                  newOwners[res.user.id] = res.user;
                }
              }
              ownersRef.current = { ...ownersRef.current, ...newOwners };
              setOwners((prev) => ({ ...prev, ...newOwners }));
            },
          );
        }
      }
    } catch {
      setError(t("error.default"));
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, searchMode, t]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setExpandedWorkspaces(new Set());
  }, [workspaces]);

  const totalCount = totalItems;
  const defaultCount = workspaces.filter((w) => w.isDefault).length;

  const tableColumns = useMemo<DashboardTableColumn<Workspace>[]>(
    () => [
      {
        header: t("table.workspace"),
        key: "workspace",
        render: (ws) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted ring-1 ring-ring">
              <Buildings className="h-5 w-5 text-lamp-ink" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{ws.name}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {ws.id.slice(0, 8)}...
              </p>
            </div>
          </div>
        ),
      },
      {
        header: t("table.owner"),
        key: "owner",
        render: (ws) => (
          <div className="flex items-center gap-2">
            <UserCircle
              className="h-5 w-5 text-muted-foreground"
              weight="fill"
            />
            <div>
              <p className="text-sm text-foreground">
                {owners[ws.ownerId]?.username ||
                  owners[ws.ownerId]?.email ||
                  ws.ownerId.slice(0, 8) + "..."}
              </p>
              {owners[ws.ownerId]?.email && (
                <p className="text-[10px] text-muted-foreground">
                  {owners[ws.ownerId].email}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        header: t("table.members"),
        key: "members",
        render: (ws) => {
          const isExpanded = expandedWorkspaces.has(ws.id);
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(ws.id);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[--radius] border px-3 py-1.5 text-xs font-semibold transition-all",
                isExpanded
                  ? "bg-muted border-blue-300 text-lamp-ink"
                  : "bg-card border-border text-muted-foreground hover:bg-muted hover:border-blue-300 hover:text-lamp-ink",
              )}
            >
              <UsersFour className="h-3.5 w-3.5" weight="bold" />
              {ws.memberCount ?? 0}
              {isExpanded ? (
                <CaretUp className="h-3 w-3" weight="bold" />
              ) : (
                <CaretDown className="h-3 w-3" weight="bold" />
              )}
            </button>
          );
        },
      },
      {
        header: t("table.type"),
        key: "type",
        render: (ws) =>
          ws.isDefault ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[10px] font-semibold text-white uppercase">
              <Star className="h-3 w-3" weight="fill" />
              {t("badge.default")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-[--radius] bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
              {t("badge.custom")}
            </span>
          ),
      },
      {
        header: t("table.plan"),
        key: "plan",
        render: (ws) => {
          const isCancelling = cancellingId === ws.id;
          const isActive = ws.subscriptionStatus === "active";

          if (!ws.planName) {
            return (
              <span className="text-xs text-muted-foreground">
                {t("plan.none")}
              </span>
            );
          }

          return (
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {ws.planName}
                </p>
                <span
                  className={cn(
                    "inline-flex items-center rounded-[--radius] px-2 py-0.5 text-[10px] font-semibold uppercase",
                    isActive
                      ? "bg-healthy text-white"
                      : ws.subscriptionStatus === "cancelled"
                        ? "bg-destructive text-white"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {ws.subscriptionStatus}
                </span>
              </div>
              {isActive && (
                <button
                  disabled={isCancelling}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (
                      !window.confirm(
                        t("plan.cancelConfirm", { name: ws.name }),
                      )
                    )
                      return;
                    setCancellingId(ws.id);
                    const result = await adminCancelWorkspaceSubscriptionAction(
                      ws.id,
                    );
                    setCancellingId(null);
                    if (result.error) {
                      toast({
                        title: result.error,
                        variant: "destructive",
                      });
                      return;
                    }
                    setWorkspaces((prev) =>
                      prev.map((w) =>
                        w.id === ws.id
                          ? { ...w, subscriptionStatus: "cancelled" }
                          : w,
                      ),
                    );
                    toast({ title: t("plan.cancelSuccess") });
                  }}
                  className="ml-1 inline-flex items-center justify-center rounded-lg border border-destructive bg-destructive p-1.5 text-white transition-all hover:bg-destructive hover:border-red-700 disabled:opacity-50"
                  title={t("plan.cancel")}
                >
                  {isCancelling ? (
                    <CircleNotch
                      className="h-3 w-3 animate-spin"
                      weight="bold"
                    />
                  ) : (
                    <X className="h-3 w-3" weight="bold" />
                  )}
                </button>
              )}
            </div>
          );
        },
      },
      {
        header: t("table.createdAt"),
        key: "createdAt",
        render: (ws) => (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarCheck className="h-3.5 w-3.5" weight="fill" />
            {formatDate(ws.createdAt)}
          </div>
        ),
      },
      {
        header: t("table.actions"),
        key: "actions",
        className: "text-right",
        render: (ws) => (
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/dashboard/workspaces/${ws.id}`}
              className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted hover:border-blue-300 hover:text-lamp-ink"
              onClick={(e) => e.stopPropagation()}
            >
              <Eye className="h-4 w-4" weight="bold" />
              {t("button.viewDetails")}
            </Link>
            <Link
              href={`/dashboard/workspaces/${ws.id}/balance`}
              className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted hover:border-blue-300 hover:text-lamp-ink"
              onClick={(e) => e.stopPropagation()}
            >
              <Wallet className="h-4 w-4" weight="bold" />
              {t("button.manageBalance")}
            </Link>
          </div>
        ),
      },
    ],
    [t, owners, expandedWorkspaces, cancellingId],
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <DashboardPageHeader
          icon={<Buildings className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.title")}
        />
      </motion.div>

      {/* Workspaces Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <DashboardTable<Workspace>
          stats={[
            {
              label: t("stats.total"),
              value: loading ? "..." : String(totalCount),
              icon: (
                <Buildings className="h-4 w-4 text-blue-500" weight="fill" />
              ),
            },
            {
              label: t("stats.default"),
              value: loading ? "..." : String(defaultCount),
              icon: <Star className="h-4 w-4 text-warning" weight="fill" />,
            },
            {
              label: t("stats.onPage"),
              value: loading ? "..." : String(workspaces.length),
              icon: (
                <UsersFour
                  className="h-4 w-4 text-muted-foreground"
                  weight="fill"
                />
              ),
            },
          ]}
          headerLeft={
            <div className="flex items-center gap-2">
              {/* Search Mode Toggle */}
              <div className="flex items-center rounded-[--radius] border border-border bg-card overflow-hidden flex-shrink-0">
                <button
                  onClick={() => {
                    setSearchMode("workspace");
                    setSearchQuery("");
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors",
                    searchMode === "workspace"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-muted-foreground",
                  )}
                >
                  <Buildings className="h-3.5 w-3.5" weight="bold" />
                  {t("search.modeWorkspace")}
                </button>
                <button
                  onClick={() => {
                    setSearchMode("email");
                    setSearchQuery("");
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors",
                    searchMode === "email"
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-muted-foreground",
                  )}
                >
                  <Envelope className="h-3.5 w-3.5" weight="bold" />
                  {t("search.modeEmail")}
                </button>
              </div>
              {/* Search Input */}
              <ElevatedInput
                label={
                  searchMode === "workspace"
                    ? t("search.placeholder")
                    : t("search.emailPlaceholder")
                }
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                controlSize="sm"
                icon={
                  searchMode === "workspace" ? (
                    <MagnifyingGlass
                      className="h-4 w-4 text-muted-foreground"
                      weight="bold"
                    />
                  ) : (
                    <Envelope
                      className="h-4 w-4 text-muted-foreground"
                      weight="bold"
                    />
                  )
                }
                className="w-full max-w-xs"
              />
            </div>
          }
          data={workspaces}
          columns={tableColumns}
          rowKey={(row) => row.id}
          loading={loading}
          onRowClick={(ws) => toggleExpanded(ws.id)}
          isRowExpanded={(ws) => expandedWorkspaces.has(ws.id)}
          renderExpandedRow={(ws) => <MembersPanel workspaceId={ws.id} />}
          pagination={
            totalPages > 1
              ? {
                  currentPage,
                  totalPages,
                  pageSize,
                  totalItems,
                  onPageChange: setCurrentPage,
                }
              : undefined
          }
          emptyState={
            error
              ? {
                  icon: (
                    <Buildings className="h-7 w-7 text-red-400" weight="fill" />
                  ),
                  title: t("error.title"),
                  description: error,
                  action: (
                    <Button
                      variant="outline"
                      title={t("button.retry")}
                      onClick={fetchWorkspaces}
                    />
                  ),
                }
              : {
                  icon: (
                    <Buildings
                      className="h-7 w-7 text-muted-foreground"
                      weight="fill"
                    />
                  ),
                  title: t("empty.title"),
                  description: t("empty.description"),
                }
          }
        />
      </motion.div>
    </motion.main>
  );
}
