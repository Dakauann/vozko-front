"use client";

import {
  ArrowLeft,
  Buildings,
  CheckCircle,
  CircleNotch,
  Clock,
  Eye,
  Globe,
  Hash,
  PencilSimple,
  PhoneDisconnect,
  Power,
  Prohibit,
  Trash,
  User,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import type { RegistrationStatus, SipTrunk } from "@/lib/sip-trunks/types";
import {
  adminDeleteSipTrunkAction,
  adminGetSipTrunkAction,
  adminToggleSipTrunkAction,
  adminUpdateSipTrunkAction,
  assignOwnerSipTrunkAction,
  getSipTrunkStatusAction,
} from "@/app/actions/sip-trunks";
import {
  adminListAllWorkspacesAction,
  getWorkspaceAction,
} from "@/app/actions/workspace";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";

import Button from "@/components/elevated-design/button";
import DeleteTrunkDialog from "../../../sip-trunks/_components/DeleteTrunkDialog";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { Workspace } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useAuth } from "@/contexts/auth-context";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useToast } from "@/hooks/use-toast";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const statusConfig: Record<
  RegistrationStatus,
  { icon: typeof CheckCircle; color: string; bgColor: string; label: string }
> = {
  pending: {
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-500/15",
    label: "Pendente",
  },
  registering: {
    icon: CircleNotch,
    color: "text-primary",
    bgColor: "bg-primary/15",
    label: "Registrando",
  },
  registered: {
    icon: CheckCircle,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/15",
    label: "Online",
  },
  failed: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    label: "Falhou",
  },
  unregistered: {
    icon: PhoneDisconnect,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    label: "Offline",
  },
};

export default function AdminSipTrunkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const trunkId = params.trunkId as string;
  const isPlatformAdmin = user?.role === "admin";

  const [trunk, setTrunk] = useState<SipTrunk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [togglingGlobal, setTogglingGlobal] = useState(false);

  const [ownerWorkspace, setOwnerWorkspace] = useState<Workspace | null>(null);
  const [assigningOwner, setAssigningOwner] = useState(false);

  const fetchTrunk = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { trunk: data, error: err } = await adminGetSipTrunkAction(trunkId);
      if (err) setError(err);
      else setTrunk(data);
    } catch {
      setError("Não foi possível carregar o canal.");
    } finally {
      setLoading(false);
    }
  }, [trunkId]);

  useEffect(() => {
    if (isPlatformAdmin && trunkId) fetchTrunk();
  }, [isPlatformAdmin, trunkId, fetchTrunk]);

  useEffect(() => {
    if (trunk?.registrationStatus !== "registering") return;
    const interval = setInterval(async () => {
      const { status } = await getSipTrunkStatusAction(trunkId);
      if (status && status.status !== trunk.registrationStatus) {
        fetchTrunk();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [trunk?.registrationStatus, trunkId, fetchTrunk]);

  useEffect(() => {
    if (!trunk?.workspaceId) {
      setOwnerWorkspace(null);
      return;
    }
    let cancelled = false;
    getWorkspaceAction(trunk.workspaceId).then((result) => {
      if (cancelled) return;
      if (result.workspace) setOwnerWorkspace(result.workspace);
    });
    return () => {
      cancelled = true;
    };
  }, [trunk?.workspaceId]);

  const workspaceSelect = usePaginatedSelect<Workspace>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await adminListAllWorkspacesAction({
        page,
        pageSize: 20,
        search: search || undefined,
      });
      return { items: result.workspaces, totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback((ws: Workspace) => {
      const ownerDisplay =
        ws.ownerName ?? ws.ownerEmail ?? ws.ownerId.slice(0, 8) + "...";
      return {
        label: ws.name,
        value: ws.id,
        description: `Proprietário: ${ownerDisplay}${ws.isDefault ? " · default" : ""}`,
        icon: <Buildings className="h-4 w-4" weight="fill" />,
      };
    }, []),
    enabled: isPlatformAdmin,
  });

  const handleAssignOwner = async (targetWorkspaceId: string) => {
    if (!trunk || targetWorkspaceId === trunk.workspaceId) return;
    setAssigningOwner(true);
    try {
      const { trunk: updated, error: err } = await assignOwnerSipTrunkAction(
        trunk.id,
        targetWorkspaceId,
      );
      if (err) {
        toast({
          title: "Erro ao atribuir proprietário",
          description: err,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Proprietário atualizado",
          description: "O canal agora pertence ao workspace selecionado.",
        });
        if (updated) setTrunk(updated);
        else await fetchTrunk();
      }
    } finally {
      setAssigningOwner(false);
    }
  };

  const handleToggleEnabled = () => {
    if (!trunk) return;
    startTransition(async () => {
      const { error: err } = await adminToggleSipTrunkAction(trunk.id, {
        enabled: !trunk.enabled,
      });
      if (err) {
        toast({ title: "Erro", description: err, variant: "destructive" });
      } else {
        await fetchTrunk();
        toast({
          title: trunk.enabled ? "Canal desativado" : "Canal ativado",
        });
      }
    });
  };

  const handleToggleGlobal = async () => {
    if (!trunk) return;
    setTogglingGlobal(true);
    try {
      const next = !trunk.isGloballyVisible;
      const { error: err } = await adminUpdateSipTrunkAction(trunk.id, {
        isGloballyVisible: next,
      });
      if (err) {
        toast({ title: "Erro", description: err, variant: "destructive" });
      } else {
        await fetchTrunk();
        toast({
          title: next ? "Canal tornado global" : "Canal restringido",
          description: next
            ? "Todos os workspaces agora podem usar este canal para chamadas de saída."
            : "Apenas o workspace proprietário pode usar este canal.",
        });
      }
    } finally {
      setTogglingGlobal(false);
    }
  };

  const handleDelete = () => {
    if (!trunk) return;
    startTransition(async () => {
      const { error: err } = await adminDeleteSipTrunkAction(trunk.id);
      if (err) {
        toast({ title: "Erro", description: err, variant: "destructive" });
      } else {
        toast({ title: "Canal excluído" });
        router.push("/dashboard/admin/sip-trunks");
      }
      setDeleteDialogOpen(false);
    });
  };

  function formatDate(dateString?: string) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

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

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <CircleNotch
          weight="bold"
          className="h-8 w-8 animate-spin text-primary"
        />
      </div>
    );
  }

  if (error || !trunk) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <ElevatedContainer className="max-w-md p-8 text-center">
          <Warning
            weight="fill"
            className="mx-auto mb-4 h-12 w-12 text-amber-500"
          />
          <h2 className="text-xl font-semibold text-foreground">
            Canal não encontrado
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "O canal solicitado não existe."}
          </p>
          <Button
            variant="outline"
            title="Voltar"
            link="/dashboard/admin/sip-trunks"
            newTab={false}
            className="mt-4 text-[11px] font-semibold uppercase"
          />
        </ElevatedContainer>
      </div>
    );
  }

  const statusInfo =
    statusConfig[trunk.registrationStatus] ?? statusConfig.unregistered;
  const StatusIcon = statusInfo.icon;
  const isGlobal = !!trunk.isGloballyVisible;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            title=""
            icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            link="/dashboard/admin/sip-trunks"
            newTab={false}
            className="text-xs font-semibold uppercase"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground">
                {trunk.name}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1",
                  isGlobal
                    ? "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300"
                    : "bg-primary/10 text-primary ring-primary/20",
                )}
              >
                {isGlobal ? (
                  <Globe className="h-3 w-3" weight="fill" />
                ) : (
                  <User className="h-3 w-3" weight="fill" />
                )}
                {isGlobal ? "Global" : "Workspace"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Gerenciamento administrativo · {trunk.host}:{trunk.port}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            title="Ver como usuário"
            icon={<Eye className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            link={`/dashboard/sip-trunks/${trunk.id}`}
            newTab={false}
            className="text-[11px] font-semibold uppercase"
          />
          <Button
            variant="outline"
            title="Editar"
            icon={<PencilSimple className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            link={`/dashboard/sip-trunks/${trunk.id}/edit`}
            newTab={false}
            className="text-[11px] font-semibold uppercase"
          />
          <Button
            variant="outline"
            title={trunk.enabled ? "Desativar" : "Ativar"}
            icon={<Power className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            onClick={handleToggleEnabled}
            disabled={isPending}
            className="text-[11px] font-semibold uppercase"
          />
          <Button
            variant="outline"
            title="Excluir"
            icon={<Trash className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isPending}
            className="text-[11px] font-semibold uppercase text-red-600 hover:bg-destructive/10"
          />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={itemVariants} className="space-y-6 lg:col-span-2">
          {/* Global visibility toggle */}
          <ElevatedContainer className="border border-border/70 bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg",
                    isGlobal
                      ? "bg-gradient-to-br from-sky-500 to-sky-700"
                      : "bg-gradient-to-br from-slate-500 to-slate-700",
                  )}
                >
                  <Globe className="h-5 w-5" weight="fill" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Visibilidade Global
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {isGlobal
                      ? "Este canal pode ser usado por qualquer workspace para chamadas de saída. Chamadas de entrada continuam indo apenas para o workspace proprietário."
                      : "Apenas o workspace proprietário pode usar este canal."}
                  </p>
                </div>
              </div>
              <Button
                variant={isGlobal ? "outline" : "action"}
                title={isGlobal ? "Tornar Restrito" : "Tornar Global"}
                icon={
                  togglingGlobal ? (
                    <CircleNotch
                      className="h-4 w-4 animate-spin"
                      weight="bold"
                    />
                  ) : (
                    <Globe className="h-4 w-4" weight="bold" />
                  )
                }
                iconVisible
                iconSide="left"
                onClick={handleToggleGlobal}
                disabled={togglingGlobal}
                className="text-[11px] font-semibold uppercase"
              />
            </div>
          </ElevatedContainer>

          {/* Owner Workspace */}
          <ElevatedContainer className="border border-border/70 bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-lg">
                  <Buildings className="h-5 w-5" weight="fill" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Workspace Proprietário
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Define qual workspace é dono deste canal. Chamadas de
                    entrada vão SEMPRE para o proprietário, mesmo se o canal for
                    global.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {ownerWorkspace && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shrink-0 shadow-lg">
                      <Buildings className="h-4 w-4" weight="fill" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {ownerWorkspace.name}
                        </p>
                        {ownerWorkspace.isDefault && (
                          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Proprietário:{" "}
                        {ownerWorkspace.ownerName ??
                          ownerWorkspace.ownerEmail ??
                          ownerWorkspace.ownerId.slice(0, 8) + "..."}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 ring-1 ring-emerald-500/20 shrink-0">
                    <CheckCircle className="h-3 w-3" weight="fill" />
                    Atual
                  </span>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Transferir propriedade
                </p>
                <ElevatedCommandSelect
                  label="Selecionar novo workspace proprietário..."
                  value={trunk.workspaceId ?? null}
                  searchPlaceholder="Buscar workspace..."
                  emptyMessage="Nenhum workspace encontrado"
                  disabled={assigningOwner}
                  fullWidth
                  onValueChange={(val) => handleAssignOwner(val)}
                  options={workspaceSelect.options}
                  onSearch={workspaceSelect.onSearch}
                  onScrollEnd={workspaceSelect.onScrollEnd}
                  onOpenChange={workspaceSelect.onOpenChange}
                  isLoading={workspaceSelect.isLoading}
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Ao trocar o proprietário, o workspace anterior perde acesso
                  exclusivo. As chamadas de entrada passam a ser entregues ao
                  novo proprietário.
                </p>
              </div>
            </div>
          </ElevatedContainer>
        </motion.div>

        {/* Sidebar */}
        <motion.div variants={itemVariants} className="space-y-6">
          <div
            className="rounded-[26px] border border-border/70 bg-card/90 p-6"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg",
                  "bg-gradient-to-br from-slate-500 to-slate-700",
                )}
              >
                <StatusIcon weight="fill" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Status
                </h2>
                <p className="text-sm text-muted-foreground">
                  {statusInfo.label}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {trunk.enabled ? "✓" : "✗"}
                </p>
                <p className="text-xs text-muted-foreground">Ativo</p>
              </div>
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {isGlobal ? "✓" : "✗"}
                </p>
                <p className="text-xs text-muted-foreground">Global</p>
              </div>
            </div>

            {trunk.lastError && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {trunk.lastError}
              </div>
            )}
          </div>

          <div
            className="rounded-[26px] border border-border/70 bg-card/90 p-6"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-lg">
                <Hash weight="bold" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Identificação
                </h2>
                <p className="text-sm text-muted-foreground">
                  Metadados técnicos
                </p>
              </div>
            </div>

            <dl className="space-y-3 text-xs">
              <div>
                <dt className="uppercase tracking-wide text-muted-foreground">
                  Trunk ID
                </dt>
                <dd className="mt-0.5 font-mono text-foreground break-all">
                  {trunk.id}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-muted-foreground">
                  Workspace Proprietário
                </dt>
                <dd className="mt-0.5 text-foreground break-all">
                  {ownerWorkspace?.name ?? trunk.workspaceId ?? "—"}
                </dd>
                {trunk.workspaceId && (
                  <dd className="mt-0.5 font-mono text-[10px] text-muted-foreground break-all">
                    {trunk.workspaceId}
                  </dd>
                )}
              </div>
              <div>
                <dt className="uppercase tracking-wide text-muted-foreground">
                  Criado em
                </dt>
                <dd className="mt-0.5 text-foreground">
                  {formatDate(trunk.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-muted-foreground">
                  Atualizado em
                </dt>
                <dd className="mt-0.5 text-foreground">
                  {formatDate(trunk.updatedAt)}
                </dd>
              </div>
              {trunk.lastRegisteredAt && (
                <div>
                  <dt className="uppercase tracking-wide text-muted-foreground">
                    Último Registro
                  </dt>
                  <dd className="mt-0.5 text-foreground">
                    {formatDate(trunk.lastRegisteredAt)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </motion.div>
      </div>

      <DeleteTrunkDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        trunkName={trunk.name}
        isLoading={isPending}
      />
    </motion.div>
  );
}
