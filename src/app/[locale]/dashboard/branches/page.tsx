"use client";

import {
  ArrowClockwise,
  CheckCircle,
  CircleNotch,
  DeviceMobileCamera,
  Eye,
  Headset,
  Key,
  MagnifyingGlass,
  PhoneDisconnect,
  Plugs,
  PlugsConnected,
  Plus,
  PlusCircle,
  Prohibit,
  Trash,
  User,
  XCircle,
} from "@phosphor-icons/react";
import type { Branch, BranchRegistrationStatus, BranchSecretResult } from "@/lib/branches/types";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { deleteBranchAction, listBranchesAction, rotateBranchSecretAction, toggleBranchAction } from "@/app/actions/branches";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import BranchSecretDialog from "./_components/BranchSecretDialog";
import MyBranchCard from "./_components/MyBranchCard";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import DeleteBranchDialog from "./_components/DeleteBranchDialog";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { listMembersAction } from "@/app/actions/workspace";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const statusDot: Record<BranchRegistrationStatus, { dot: string; text: string }> = {
  never_registered: { dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  registered: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  expired: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  unreachable: { dot: "bg-red-500", text: "text-red-700 dark:text-red-300" },
};

export default function RamaisPage() {
  const t = useTranslations("branchesPage");
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { currentWorkspace, can } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const canCreate = can("branches", "create");
  const canManage = can("branches", "update");
  const canUse = can("branches", "use");

  const [searchQuery, setSearchQuery] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();
  const [deleting, setDeleting] = useState<Branch | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [secret, setSecret] = useState<BranchSecretResult | null>(null);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listBranchesAction({ pageSize: 500 });
      if (result.error) {
        toast({ title: t("toast.genericError"), description: result.error, variant: "destructive" });
      } else {
        setBranches(result.branches);
      }
    } catch {
      toast({ title: t("toast.genericError"), description: t("toast.loadError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (!workspaceId) return;
    void (async () => {
      const { members } = await listMembersAction(workspaceId);
      const map: Record<string, string> = {};
      members.forEach((m) => (map[m.userId] = m.username || m.email || m.userId));
      setMemberNames(map);
    })();
  }, [workspaceId]);

  const handleRefresh = () => startRefresh(async () => { await fetchBranches(); });

  const handleToggle = async (b: Branch) => {
    setBusyId(b.id);
    try {
      const { error } = await toggleBranchAction(b.id, { enabled: !b.enabled });
      if (error) {
        toast({ title: t("toast.genericError"), description: error, variant: "destructive" });
      } else {
        await fetchBranches();
        toast({ title: b.enabled ? t("toast.disabled") : t("toast.enabled") });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRotate = async (b: Branch) => {
    setBusyId(b.id);
    try {
      const { result, error } = await rotateBranchSecretAction(b.id);
      if (error || !result) {
        toast({ title: t("toast.genericError"), description: error ?? "", variant: "destructive" });
      } else {
        setSecret(result);
        toast({ title: t("toast.rotated") });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = () => {
    if (!deleting) return;
    startRefresh(async () => {
      const { error } = await deleteBranchAction(deleting.id);
      if (error) {
        toast({ title: t("toast.genericError"), description: error, variant: "destructive" });
      } else {
        await fetchBranches();
        toast({ title: t("toast.deleted") });
      }
      setDeleting(null);
    });
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return branches;
    const q = searchQuery.toLowerCase();
    return branches.filter(
      (b) =>
        b.sipUser.toLowerCase().includes(q) ||
        b.displayName?.toLowerCase().includes(q) ||
        memberNames[b.userId]?.toLowerCase().includes(q),
    );
  }, [branches, searchQuery, memberNames]);

  const stats = useMemo(
    () => ({
      total: branches.length,
      registered: branches.filter((b) => b.registrationStatus === "registered").length,
      enabled: branches.filter((b) => b.enabled).length,
      offline: branches.filter((b) => b.registrationStatus !== "registered").length,
    }),
    [branches],
  );

  const columns = useMemo<DashboardTableColumn<Branch>[]>(
    () => [
      {
        key: "extension",
        header: t("columns.extension"),
        render: (row) => {
          const s = statusDot[row.registrationStatus] ?? statusDot.never_registered;
          return (
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-lg">
                <Headset className="h-5 w-5" weight="fill" />
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/branches/${row.id}`)}
                  className="block truncate text-left text-sm font-semibold text-foreground transition-colors hover:text-primary"
                >
                  <span className="font-mono">{row.sipUser}</span>
                  {row.displayName ? <span className="ml-1.5 font-sans text-muted-foreground">· {row.displayName}</span> : null}
                </button>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                  <span className={cn("text-[10px] font-semibold uppercase", s.text)}>
                    {t(`status.${row.registrationStatus}`)}
                  </span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: "member",
        header: t("columns.member"),
        render: (row) => (
          <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
            <User className="h-3.5 w-3.5 text-muted-foreground" weight="fill" />
            {memberNames[row.userId] ?? "—"}
          </span>
        ),
      },
      {
        key: "realm",
        header: t("columns.realm"),
        render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.realm}</span>,
      },
      {
        key: "devices",
        header: t("columns.devices"),
        render: (row) => (
          <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
            <DeviceMobileCamera className="h-3.5 w-3.5 text-muted-foreground" weight="fill" />
            {row.maxContacts}
          </span>
        ),
      },
      {
        key: "enabled",
        header: t("columns.enabled"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1",
              row.enabled
                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
                : "bg-muted text-muted-foreground ring-border",
            )}
          >
            {row.enabled ? <CheckCircle className="h-3 w-3" weight="fill" /> : <XCircle className="h-3 w-3" weight="fill" />}
            {row.enabled ? t("active") : t("inactive")}
          </span>
        ),
      },
    ],
    [router, memberNames, t],
  );

  const renderRowActions = useCallback(
    (row: Branch) => {
      const busy = busyId === row.id;
      return (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            title=""
            icon={<Eye className="h-3.5 w-3.5" weight="bold" />}
            iconVisible
            onClick={() => router.push(`/dashboard/branches/${row.id}`)}
            className="h-8 w-8 p-0"
          />
          {canManage && (
            <>
              <Button
                variant="ghost"
                title=""
                icon={busy ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> : <Key className="h-3.5 w-3.5" weight="bold" />}
                iconVisible
                onClick={() => void handleRotate(row)}
                disabled={busy}
                className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted"
              />
              <Button
                variant="ghost"
                title=""
                icon={row.enabled ? <PhoneDisconnect className="h-3.5 w-3.5" weight="bold" /> : <PlugsConnected className="h-3.5 w-3.5" weight="bold" />}
                iconVisible
                onClick={() => void handleToggle(row)}
                disabled={busy}
                className={cn("h-8 w-8 p-0", row.enabled ? "text-muted-foreground hover:bg-muted" : "text-emerald-700 hover:bg-emerald-500/10")}
              />
              <Button
                variant="ghost"
                title=""
                icon={<Trash className="h-3.5 w-3.5" weight="bold" />}
                iconVisible
                onClick={() => setDeleting(row)}
                className="h-8 w-8 p-0 text-red-600 hover:bg-destructive/10 hover:text-red-700"
              />
            </>
          )}
        </div>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, canManage, busyId],
  );

  if (!user) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <ElevatedContainer className="max-w-md p-8 text-center">
          <Prohibit weight="fill" className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="text-xl font-semibold text-foreground">{t("restrictedTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("restrictedBody")}</p>
        </ElevatedContainer>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      <DashboardPageHeader
        icon={<Headset className="h-6 w-6" weight="fill" />}
        badge={t("badge")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              title={t("refresh")}
              icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", isRefreshing && "animate-spin")} />}
              iconVisible
              iconSide="left"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-[11px] font-semibold uppercase"
            />
            {canCreate && (
              <Button
                variant="action"
                title={t("new")}
                icon={<Plus weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                link="/dashboard/branches/new"
                newTab={false}
                className="text-[11px] font-semibold uppercase"
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("stats.total")} value={loading ? "…" : String(stats.total)} icon={<Plugs className="h-5 w-5" weight="fill" />} gradient="from-slate-500 to-slate-700" />
        <StatCard label={t("stats.registered")} value={loading ? "…" : String(stats.registered)} icon={<PlugsConnected className="h-5 w-5" weight="fill" />} gradient="from-emerald-500 to-emerald-700" />
        <StatCard label={t("stats.enabled")} value={loading ? "…" : String(stats.enabled)} icon={<CheckCircle className="h-5 w-5" weight="fill" />} gradient="from-primary to-[hsl(var(--primary-hover))]" />
        <StatCard label={t("stats.offline")} value={loading ? "…" : String(stats.offline)} icon={<PhoneDisconnect className="h-5 w-5" weight="fill" />} gradient="from-slate-400 to-slate-600" />
      </div>

      <ElevatedContainer className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full max-w-md">
            <ElevatedInput
              type="text"
              label={t("search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {loading ? t("loading") : t("count", { count: filtered.length })}
          </span>
        </div>
      </ElevatedContainer>

      <DashboardTable<Branch>
        data={filtered}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        renderRowActions={renderRowActions}
        onRowClick={(row) => router.push(`/dashboard/branches/${row.id}`)}
        emptyState={{
          icon: <Headset className="h-7 w-7 text-muted-foreground/40" weight="duotone" />,
          title: searchQuery.trim() ? t("empty.titleSearch") : t("empty.title"),
          description: searchQuery.trim() ? t("empty.descriptionSearch") : t("empty.description"),
          action:
            !searchQuery.trim() && canCreate ? (
              <Button variant="action" title={t("new")} icon={<PlusCircle weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" link="/dashboard/branches/new" newTab={false} />
            ) : undefined,
        }}
      />

      {/* Member self-service: your own extension + ring-device preferences,
          workspace-scoped. Placed after the admin table so it never buries the
          main content. */}
      {canUse ? <MyBranchCard /> : null}

      <DeleteBranchDialog
        open={!!deleting}
        branchName={deleting?.sipUser ?? ""}
        isLoading={isRefreshing}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />

      <BranchSecretDialog result={secret} rotated onClose={() => setSecret(null)} />
    </motion.div>
  );
}

function StatCard({ label, value, icon, gradient }: { label: string; value: string; icon: React.ReactNode; gradient: string }) {
  return (
    <ElevatedContainer className="flex items-center gap-3 p-4">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg", gradient)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
      </div>
    </ElevatedContainer>
  );
}
