"use client";

import {
  ArrowClockwise,
  CheckCircle,
  CircleNotch,
  Eye,
  Gear,
  Globe,
  Lock,
  MagnifyingGlass,
  PhoneCall,
  PhoneDisconnect,
  Plugs,
  PlugsConnected,
  Plus,
  Prohibit,
  Trash,
  User,
  XCircle,
} from "@phosphor-icons/react";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import type {
  RegistrationStatus,
  SipTrunk,
  TransportType,
  TrunkType,
} from "@/lib/sip-trunks/types";
import {
  deleteSipTrunkAction,
  listSipTrunksAction,
  toggleSipTrunkAction,
} from "@/app/actions/sip-trunks";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import DeleteTrunkDialog from "./_components/DeleteTrunkDialog";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/workspace-context";

const statusConfig: Record<
  RegistrationStatus,
  { label: string; dot: string; text: string }
> = {
  pending: {
    label: "Pendente",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
  registering: {
    label: "Registrando",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
  },
  registered: {
    label: "Online",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  failed: {
    label: "Falhou",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-300",
  },
  unregistered: {
    label: "Offline",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
};

const transportLabels: Record<TransportType, string> = {
  udp: "UDP",
  tcp: "TCP",
  tls: "TLS",
};

const trunkTypeLabels: Record<TrunkType, string> = {
  mobile: "Móvel",
  fixed: "Fixo",
};

type OwnershipKind = "owned" | "global" | "granted";

function getOwnership(
  trunk: SipTrunk,
  workspaceId: string | undefined,
): OwnershipKind {
  if (workspaceId && trunk.workspaceId && trunk.workspaceId === workspaceId) {
    return "owned";
  }
  if (trunk.isGloballyVisible) return "global";
  return "granted";
}

export default function SipTrunksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { currentWorkspace, can } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isPlatformAdmin = user?.role === "admin";
  const hasAccess = !!user;
  // Creating a workspace SIP trunk (BYO PABX) is open to any member with the
  // sip_trunks:create permission, not just platform admins. Owners/admins have
  // it implicitly; the backend enforces the same gate on POST /sip-trunks.
  const canCreate = can("sip_trunks", "create");

  const [searchQuery, setSearchQuery] = useState("");
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();
  const [deletingTrunk, setDeletingTrunk] = useState<SipTrunk | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTrunks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listSipTrunksAction({ pageSize: 500 });
      if (result.error) {
        toast({
          title: "Erro",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setTrunks(result.trunks);
      }
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os canais de telefonia.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTrunks();
  }, [fetchTrunks]);

  const handleRefresh = () => {
    startRefresh(async () => {
      await fetchTrunks();
    });
  };

  const handleToggleEnabled = async (trunk: SipTrunk) => {
    setTogglingId(trunk.id);
    try {
      const { error } = await toggleSipTrunkAction(trunk.id, {
        enabled: !trunk.enabled,
      });
      if (error) {
        toast({ title: "Erro", description: error, variant: "destructive" });
      } else {
        await fetchTrunks();
        toast({
          title: trunk.enabled
            ? `Canal "${trunk.name}" desativado`
            : `Canal "${trunk.name}" ativado`,
        });
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteTrunk = async () => {
    if (!deletingTrunk) return;
    startRefresh(async () => {
      const { error } = await deleteSipTrunkAction(deletingTrunk.id);
      if (error) {
        toast({ title: "Erro", description: error, variant: "destructive" });
      } else {
        await fetchTrunks();
        toast({
          title: "Canal excluído",
          description: `${deletingTrunk.name} foi removido.`,
        });
      }
      setDeletingTrunk(null);
    });
  };

  const filteredTrunks = useMemo(() => {
    if (!searchQuery.trim()) return trunks;
    const q = searchQuery.toLowerCase();
    return trunks.filter((t) => {
      const ownership = getOwnership(t, workspaceId);
      const canSeeSensitive = isPlatformAdmin || ownership === "owned";
      if (t.name.toLowerCase().includes(q)) return true;
      if (canSeeSensitive) {
        return (
          t.host.toLowerCase().includes(q) ||
          t.phoneNumber?.toLowerCase().includes(q) ||
          t.username.toLowerCase().includes(q)
        );
      }
      return false;
    });
  }, [trunks, searchQuery, workspaceId, isPlatformAdmin]);

  const stats = useMemo(() => {
    return {
      total: trunks.length,
      online: trunks.filter((t) => t.registrationStatus === "registered")
        .length,
      enabled: trunks.filter((t) => t.enabled).length,
      owned: trunks.filter(
        (t) => workspaceId && t.workspaceId && t.workspaceId === workspaceId,
      ).length,
    };
  }, [trunks, workspaceId]);

  const columns = useMemo<DashboardTableColumn<SipTrunk>[]>(
    () => [
      {
        key: "name",
        header: "Canal",
        render: (row) => {
          const status =
            statusConfig[row.registrationStatus] ?? statusConfig.unregistered;
          return (
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-lg">
                <PhoneCall className="h-5 w-5" weight="fill" />
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/sip-trunks/${row.id}`)}
                  className="block truncate text-sm font-semibold text-foreground hover:text-primary transition-colors text-left"
                >
                  {row.name}
                </button>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      status.dot,
                      row.registrationStatus === "registering" &&
                        "animate-pulse",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase",
                      status.text,
                    )}
                  >
                    {status.label}
                  </span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: "host",
        header: "Host",
        render: (row) => {
          const ownership = getOwnership(row, workspaceId);
          const canSeeSensitive = isPlatformAdmin || ownership === "owned";
          if (!canSeeSensitive) return <MaskedCell />;
          return (
            <span className="font-mono text-xs text-foreground">
              {row.host}
              <span className="text-muted-foreground">:{row.port}</span>
            </span>
          );
        },
      },
      {
        key: "transport",
        header: "Transporte",
        render: (row) => (
          <span className="text-xs font-semibold uppercase text-foreground">
            {transportLabels[row.transport]}
          </span>
        ),
      },
      {
        key: "trunkType",
        header: "Tipo",
        render: (row) => (
          <span className="text-xs text-foreground">
            {trunkTypeLabels[row.trunkType]}
          </span>
        ),
      },
      {
        key: "phoneNumber",
        header: "Telefone",
        render: (row) => {
          const ownership = getOwnership(row, workspaceId);
          const canSeeSensitive = isPlatformAdmin || ownership === "owned";
          if (!canSeeSensitive) return <MaskedCell />;
          return (
            <span className="font-mono text-xs text-muted-foreground">
              {row.phoneNumber || "—"}
            </span>
          );
        },
      },
      {
        key: "ownership",
        header: "Origem",
        render: (row) => {
          const kind = getOwnership(row, workspaceId);
          return <OwnershipBadge kind={kind} />;
        },
      },
      {
        key: "enabled",
        header: "Ativo",
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1",
              row.enabled
                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
                : "bg-muted text-muted-foreground ring-border",
            )}
          >
            {row.enabled ? (
              <CheckCircle className="h-3 w-3" weight="fill" />
            ) : (
              <XCircle className="h-3 w-3" weight="fill" />
            )}
            {row.enabled ? "Ativo" : "Inativo"}
          </span>
        ),
      },
    ],
    [router, workspaceId, isPlatformAdmin],
  );

  const renderRowActions = useCallback(
    (row: SipTrunk) => {
      const ownership = getOwnership(row, workspaceId);
      const canMutate = isPlatformAdmin || ownership === "owned";
      const busy = togglingId === row.id;
      return (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            title=""
            icon={<Eye className="h-3.5 w-3.5" weight="bold" />}
            iconVisible
            onClick={() => router.push(`/dashboard/sip-trunks/${row.id}`)}
            className="h-8 w-8 p-0"
          />
          {canMutate && (
            <>
              <Button
                variant="ghost"
                title=""
                icon={
                  busy ? (
                    <CircleNotch
                      className="h-3.5 w-3.5 animate-spin"
                      weight="bold"
                    />
                  ) : row.enabled ? (
                    <PhoneDisconnect className="h-3.5 w-3.5" weight="bold" />
                  ) : (
                    <PlugsConnected className="h-3.5 w-3.5" weight="bold" />
                  )
                }
                iconVisible
                onClick={() => void handleToggleEnabled(row)}
                disabled={busy}
                className={cn(
                  "h-8 w-8 p-0",
                  row.enabled
                    ? "text-muted-foreground hover:bg-muted"
                    : "text-emerald-700 hover:bg-emerald-500/10",
                )}
              />
              <Button
                variant="ghost"
                title=""
                icon={<Trash className="h-3.5 w-3.5" weight="bold" />}
                iconVisible
                onClick={() => setDeletingTrunk(row)}
                className="h-8 w-8 p-0 text-red-600 hover:bg-destructive/10 hover:text-red-700"
              />
            </>
          )}
        </div>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, workspaceId, isPlatformAdmin, togglingId],
  );

  if (!hasAccess) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <ElevatedContainer className="max-w-md p-8 text-center">
          <Prohibit
            weight="fill"
            className="mx-auto mb-4 h-12 w-12 text-red-500"
          />
          <h2 className="text-xl font-semibold text-foreground">
            Acesso Restrito
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Você não tem permissão para visualizar os canais de telefonia desta
            área de trabalho.
          </p>
        </ElevatedContainer>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <DashboardPageHeader
        icon={<PhoneCall className="h-6 w-6" weight="fill" />}
        badge="Canais de Telefonia"
        description="Canais que conectam seu workspace à rede telefônica para chamadas de voz"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              title="Atualizar"
              icon={
                <ArrowClockwise
                  weight="bold"
                  className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                />
              }
              iconVisible
              iconSide="left"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-[11px] font-semibold uppercase"
            />
            {isPlatformAdmin && (
              <Button
                variant="outline"
                title="Gerenciar (Admin)"
                icon={<Gear weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                link="/dashboard/admin/sip-trunks"
                newTab={false}
                className="text-[11px] font-semibold uppercase"
              />
            )}
            {canCreate && (
              <Button
                variant="action"
                title="Novo Canal"
                icon={<Plus weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                link="/dashboard/sip-trunks/new"
                newTab={false}
                className="text-[11px] font-semibold uppercase"
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total"
          value={loading ? "…" : String(stats.total)}
          icon={<Plugs className="h-5 w-5" weight="fill" />}
          gradient="from-slate-500 to-slate-700"
        />
        <StatCard
          label="Online"
          value={loading ? "…" : String(stats.online)}
          icon={<PlugsConnected className="h-5 w-5" weight="fill" />}
          gradient="from-emerald-500 to-emerald-700"
        />
        <StatCard
          label="Ativos"
          value={loading ? "…" : String(stats.enabled)}
          icon={<CheckCircle className="h-5 w-5" weight="fill" />}
          gradient="from-primary to-[hsl(var(--primary-hover))]"
        />
        <StatCard
          label="Deste workspace"
          value={loading ? "…" : String(stats.owned)}
          icon={<User className="h-5 w-5" weight="fill" />}
          gradient="from-violet-500 to-violet-700"
        />
      </div>

      <ElevatedContainer className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full max-w-md">
            <ElevatedInput
              type="text"
              label="Buscar por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {loading
              ? "Carregando…"
              : `${filteredTrunks.length} ${filteredTrunks.length === 1 ? "canal" : "canais"}`}
          </span>
        </div>
      </ElevatedContainer>

      <DashboardTable<SipTrunk>
        data={filteredTrunks}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        renderRowActions={renderRowActions}
        onRowClick={(row) => router.push(`/dashboard/sip-trunks/${row.id}`)}
        emptyState={{
          icon: (
            <PhoneCall
              className="h-7 w-7 text-muted-foreground/40"
              weight="duotone"
            />
          ),
          title: searchQuery.trim()
            ? "Nenhum canal encontrado"
            : "Nenhum canal disponível",
          description: searchQuery.trim()
            ? "Tente ajustar sua busca."
            : canCreate
              ? "Crie o primeiro canal SIP do seu workspace."
              : "Peça a um administrador para conceder acesso a um canal.",
          action:
            !searchQuery.trim() && canCreate ? (
              <Button
                variant="action"
                title="Novo Canal"
                icon={<Plus weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                link="/dashboard/sip-trunks/new"
                newTab={false}
              />
            ) : undefined,
        }}
      />

      <DeleteTrunkDialog
        open={!!deletingTrunk}
        onClose={() => setDeletingTrunk(null)}
        onConfirm={handleDeleteTrunk}
        trunkName={deletingTrunk?.name || ""}
        isLoading={isRefreshing}
      />
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  icon,
  gradient,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <ElevatedContainer className="flex items-center gap-3 p-4">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg",
          gradient,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
      </div>
    </ElevatedContainer>
  );
}

function OwnershipBadge({ kind }: { kind: OwnershipKind }) {
  if (kind === "owned") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary ring-1 ring-primary/20">
        <User className="h-3 w-3" weight="fill" />
        Próprio
      </span>
    );
  }
  if (kind === "global") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300">
        <Globe className="h-3 w-3" weight="fill" />
        Global
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300">
      Compartilhado
    </span>
  );
}

function MaskedCell() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
      <Lock className="h-3 w-3" weight="fill" />
      <span className="font-mono tracking-widest">••••••••</span>
    </span>
  );
}
