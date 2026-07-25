"use client";

import {
  ArrowClockwise,
  CheckCircle,
  CircleNotch,
  Eye,
  Globe,
  MagnifyingGlass,
  PencilSimple,
  PhoneCall,
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
import {
  adminDeleteSipTrunkAction,
  adminListSipTrunksAction,
  adminToggleSipTrunkAction,
  adminUpdateSipTrunkAction,
} from "@/app/actions/sip-trunks";
import type {
  RegistrationStatus,
  SipTrunk,
  TransportType,
  TrunkType,
} from "@/lib/sip-trunks/types";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import DeleteTrunkDialog from "../../sip-trunks/_components/DeleteTrunkDialog";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<
  RegistrationStatus,
  { label: string; dot: string; ring: string; text: string }
> = {
  pending: {
    label: "Pendente",
    dot: "bg-amber-500",
    ring: "ring-amber-500/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  registering: {
    label: "Registrando",
    dot: "bg-sky-500",
    ring: "ring-sky-500/30",
    text: "text-sky-700 dark:text-sky-300",
  },
  registered: {
    label: "Online",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  failed: {
    label: "Falhou",
    dot: "bg-red-500",
    ring: "ring-red-500/30",
    text: "text-red-700 dark:text-red-300",
  },
  unregistered: {
    label: "Offline",
    dot: "bg-muted-foreground/50",
    ring: "ring-muted-foreground/20",
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

export default function AdminSipTrunksPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const isPlatformAdmin = user?.role === "admin";

  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingTrunk, setDeletingTrunk] = useState<SipTrunk | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingGlobalId, setTogglingGlobalId] = useState<string | null>(null);

  const fetchTrunks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminListSipTrunksAction({ pageSize: 500 });
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
    if (isPlatformAdmin) fetchTrunks();
  }, [isPlatformAdmin, fetchTrunks]);

  const handleRefresh = () => {
    startRefresh(async () => {
      await fetchTrunks();
    });
  };

  const handleToggleEnabled = async (trunk: SipTrunk) => {
    setTogglingId(trunk.id);
    try {
      const { error } = await adminToggleSipTrunkAction(trunk.id, {
        enabled: !trunk.enabled,
      });
      if (error) {
        toast({ title: "Erro", description: error, variant: "destructive" });
      } else {
        toast({
          title: trunk.enabled
            ? `Canal "${trunk.name}" desativado`
            : `Canal "${trunk.name}" ativado`,
        });
        await fetchTrunks();
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleGlobal = async (trunk: SipTrunk) => {
    setTogglingGlobalId(trunk.id);
    try {
      const next = !trunk.isGloballyVisible;
      const { error } = await adminUpdateSipTrunkAction(trunk.id, {
        isGloballyVisible: next,
      });
      if (error) {
        toast({ title: "Erro", description: error, variant: "destructive" });
      } else {
        toast({
          title: next
            ? `Canal "${trunk.name}" agora é global`
            : `Canal "${trunk.name}" não é mais global`,
          description: next
            ? "Este canal está visível para todos os workspaces."
            : "Este canal voltou a ser restrito.",
        });
        await fetchTrunks();
      }
    } finally {
      setTogglingGlobalId(null);
    }
  };

  const handleDeleteTrunk = async () => {
    if (!deletingTrunk) return;
    startRefresh(async () => {
      const { error } = await adminDeleteSipTrunkAction(deletingTrunk.id);
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
    return trunks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.host.toLowerCase().includes(q) ||
        t.phoneNumber?.toLowerCase().includes(q) ||
        t.username.toLowerCase().includes(q),
    );
  }, [trunks, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: trunks.length,
      online: trunks.filter((t) => t.registrationStatus === "registered")
        .length,
      enabled: trunks.filter((t) => t.enabled).length,
      global: trunks.filter((t) => t.isGloballyVisible).length,
    };
  }, [trunks]);

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
                  onClick={() =>
                    router.push(`/dashboard/admin/sip-trunks/${row.id}`)
                  }
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
        render: (row) => (
          <span className="font-mono text-xs text-foreground">
            {row.host}
            <span className="text-muted-foreground">:{row.port}</span>
          </span>
        ),
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
        render: (row) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.phoneNumber || "—"}
          </span>
        ),
      },
      {
        key: "ownership",
        header: "Visibilidade",
        render: (row) => {
          const global = !!row.isGloballyVisible;
          const busy = togglingGlobalId === row.id;
          return (
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                void handleToggleGlobal(row);
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 transition-colors disabled:opacity-50",
                global
                  ? "bg-sky-500/10 text-sky-700 ring-sky-500/20 hover:bg-sky-500/20 dark:text-sky-300"
                  : "bg-muted text-muted-foreground ring-border hover:bg-muted/70",
              )}
              title={
                global ? "Clique para restringir" : "Clique para tornar global"
              }
            >
              {busy ? (
                <CircleNotch className="h-3 w-3 animate-spin" weight="bold" />
              ) : global ? (
                <Globe className="h-3 w-3" weight="fill" />
              ) : (
                <User className="h-3 w-3" weight="fill" />
              )}
              {global ? "Global" : "Workspace"}
            </button>
          );
        },
      },
      {
        key: "enabled",
        header: "Ativo",
        render: (row) => {
          const busy = togglingId === row.id;
          return (
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                void handleToggleEnabled(row);
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 transition-colors disabled:opacity-50",
                row.enabled
                  ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 hover:bg-emerald-500/20 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground ring-border hover:bg-muted/70",
              )}
            >
              {busy ? (
                <CircleNotch className="h-3 w-3 animate-spin" weight="bold" />
              ) : row.enabled ? (
                <CheckCircle className="h-3 w-3" weight="fill" />
              ) : (
                <XCircle className="h-3 w-3" weight="fill" />
              )}
              {row.enabled ? "Ativo" : "Inativo"}
            </button>
          );
        },
      },
    ],
    [router, togglingId, togglingGlobalId],
  );

  const renderRowActions = useCallback(
    (row: SipTrunk) => (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          title=""
          icon={<Eye className="h-3.5 w-3.5" weight="bold" />}
          iconVisible
          onClick={() => router.push(`/dashboard/admin/sip-trunks/${row.id}`)}
          className="h-8 w-8 p-0"
        />
        <Button
          variant="ghost"
          title=""
          icon={<PencilSimple className="h-3.5 w-3.5" weight="bold" />}
          iconVisible
          onClick={() => router.push(`/dashboard/admin/sip-trunks/${row.id}`)}
          className="h-8 w-8 p-0"
        />
        <Button
          variant="ghost"
          title=""
          icon={<Trash className="h-3.5 w-3.5" weight="bold" />}
          iconVisible
          onClick={() => setDeletingTrunk(row)}
          className="h-8 w-8 p-0 text-red-600 hover:bg-destructive/10 hover:text-red-700"
        />
      </div>
    ),
    [router],
  );

  if (!isPlatformAdmin) {
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
            Esta área é exclusiva para administradores da plataforma.
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
        badge="Admin · Canais de Telefonia"
        description="Gerencie todos os canais SIP da plataforma, controle visibilidade global e concessões de acesso por workspace."
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
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total"
          value={loading ? "…" : String(stats.total)}
          icon={<PhoneCall className="h-5 w-5" weight="fill" />}
          gradient="from-slate-500 to-slate-700"
        />
        <StatCard
          label="Online"
          value={loading ? "…" : String(stats.online)}
          icon={<CheckCircle className="h-5 w-5" weight="fill" />}
          gradient="from-emerald-500 to-emerald-700"
        />
        <StatCard
          label="Ativos"
          value={loading ? "…" : String(stats.enabled)}
          icon={<CheckCircle className="h-5 w-5" weight="fill" />}
          gradient="from-primary to-[hsl(var(--primary-hover))]"
        />
        <StatCard
          label="Globais"
          value={loading ? "…" : String(stats.global)}
          icon={<Globe className="h-5 w-5" weight="fill" />}
          gradient="from-sky-500 to-sky-700"
        />
      </div>

      {/* Search */}
      <ElevatedContainer className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full max-w-md">
            <ElevatedInput
              type="text"
              label="Buscar por nome, host, usuário ou telefone..."
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

      {/* Table */}
      <DashboardTable<SipTrunk>
        data={filteredTrunks}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        renderRowActions={renderRowActions}
        onRowClick={(row) =>
          router.push(`/dashboard/admin/sip-trunks/${row.id}`)
        }
        emptyState={{
          icon: (
            <PhoneCall
              className="h-7 w-7 text-muted-foreground/40"
              weight="duotone"
            />
          ),
          title: searchQuery.trim()
            ? "Nenhum canal encontrado"
            : "Nenhum canal cadastrado",
          description: searchQuery.trim()
            ? "Tente ajustar sua busca."
            : "Crie o primeiro canal SIP da plataforma.",
          action: !searchQuery.trim() ? (
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
