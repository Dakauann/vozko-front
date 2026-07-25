"use client";

import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle,
  CircleNotch,
  Clock,
  Copy,
  Equalizer,
  Gear,
  Globe,
  Hash,
  Info,
  Lightning,
  ListNumbers,
  PencilSimple,
  Phone,
  PhoneDisconnect,
  Plugs,
  Power,
  Prohibit,
  ShieldCheck,
  SimCard,
  Trash,
  User,
  Users,
  Warning,
  WifiHigh,
  XCircle,
} from "@phosphor-icons/react";
import type { RegistrationStatus, SipTrunk } from "@/lib/sip-trunks/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteSipTrunkAction,
  getSipTrunkAction,
  getSipTrunkStatusAction,
  toggleSipTrunkAction,
} from "@/app/actions/sip-trunks";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";

import Button from "@/components/elevated-design/button";
import DeleteTrunkDialog from "../_components/DeleteTrunkDialog";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

const statusConfig: Record<
  RegistrationStatus,
  { icon: typeof CheckCircle; color: string; bgColor: string }
> = {
  pending: {
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-500/15",
  },
  registering: {
    icon: CircleNotch,
    color: "text-primary",
    bgColor: "bg-primary/15",
  },
  registered: {
    icon: CheckCircle,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/15",
  },
  failed: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  unregistered: {
    icon: PhoneDisconnect,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
};

function InfoRow({
  icon,
  label,
  value,
  mono,
  copyable,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  mono?: boolean;
  copyable?: boolean;
}) {
  const { toast } = useToast();

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      toast({ title: "Copiado!" });
    }
  };

  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-sm font-medium text-foreground",
            mono && "font-mono",
          )}
        >
          {value || "-"}
        </span>
        {copyable && value && (
          <button
            type="button"
            onClick={handleCopy}
            className="text-muted-foreground transition-colors hover:text-muted-foreground"
          >
            <Copy weight="bold" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function SipTrunkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useTranslations("sipTrunksPage");
  const commonT = useTranslations("common");
  const trunkId = params.trunkId as string;

  const [trunk, setTrunk] = useState<SipTrunk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { currentWorkspace } = useWorkspace();
  const isPlatformAdmin = user?.role === "admin";

  const tRef = useRef(t);
  tRef.current = t;

  const fetchTrunk = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { trunk: data, error: err } = await getSipTrunkAction(trunkId);
      if (err) {
        setError(err);
      } else {
        setTrunk(data);
      }
    } catch {
      setError(tRef.current("toast.error"));
    } finally {
      setLoading(false);
    }
  }, [trunkId]);

  useEffect(() => {
    fetchTrunk();
  }, [fetchTrunk]);

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


  const handleToggleEnabled = () => {
    if (!trunk) return;

    startTransition(async () => {
      const { error: err } = await toggleSipTrunkAction(trunk.id, {
        enabled: !trunk.enabled,
      });
      if (err) {
        toast({
          title: commonT("error"),
          description: err,
          variant: "destructive",
        });
      } else {
        await fetchTrunk();
        toast({
          title: trunk.enabled
            ? t("toast.disableSuccess")
            : t("toast.enableSuccess"),
          description: trunk.enabled
            ? t("toast.disableSuccess")
            : t("toast.enableSuccess"),
        });
      }
    });
  };

  const handleDelete = () => {
    if (!trunk) return;

    startTransition(async () => {
      const { error: err } = await deleteSipTrunkAction(trunk.id);
      if (err) {
        toast({
          title: commonT("error"),
          description: err,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toast.deleteSuccess"),
          description: t("toast.deleteSuccess"),
        });
        router.push("/dashboard/sip-trunks");
      }
      setDeleteDialogOpen(false);
    });
  };


  function formatDate(dateString?: string) {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
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
            SIP Trunk não encontrado
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "O tronco solicitado não existe."}
          </p>
          <Button
            variant="outline"
            title="Voltar"
            link="/dashboard/sip-trunks"
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
  const knownStatuses: RegistrationStatus[] = [
    "pending",
    "registering",
    "registered",
    "failed",
    "unregistered",
  ];
  const statusKey = knownStatuses.includes(trunk.registrationStatus)
    ? trunk.registrationStatus
    : "unregistered";
  const statusLabel = t(`status.${statusKey}`);

  const isOwnedByWorkspace =
    !!currentWorkspace?.id &&
    !!trunk.workspaceId &&
    trunk.workspaceId === currentWorkspace.id;
  const canMutate = isPlatformAdmin || isOwnedByWorkspace;

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
            link="/dashboard/sip-trunks"
            newTab={false}
            className="text-xs font-semibold uppercase"
          />
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
              <Plugs weight="fill" className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {t("header.badge")}
              </p>
              <h1 className="text-2xl font-bold text-foreground">
                {trunk.name}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canMutate && (
            <>
              <Button
                variant="outline"
                title={t("actions.edit")}
                icon={<PencilSimple weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                link={`/dashboard/sip-trunks/${trunk.id}/edit`}
                newTab={false}
                className="text-[11px] font-semibold uppercase"
                disabled={isPending}
              />
              <Button
                type="button"
                variant={trunk.enabled ? "ghost" : "action"}
                title={
                  trunk.enabled ? t("actions.disable") : t("actions.enable")
                }
                icon={<Power weight="fill" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                onClick={handleToggleEnabled}
                disabled={isPending}
                className={cn(
                  "text-[11px] font-semibold uppercase",
                  trunk.enabled && "text-amber-600 hover:bg-amber-500/10",
                )}
              />
              <Button
                type="button"
                variant="ghost"
                title={t("actions.delete")}
                icon={<Trash weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isPending}
                className="text-[11px] font-semibold uppercase text-red-600 hover:bg-destructive/10"
              />
            </>
          )}
        </div>
      </motion.div>

      {/* Status banner, always visible above tabs */}
      <motion.div variants={itemVariants}>
        <div
          className="rounded-[26px] border border-border/70 bg-card/90 p-5"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide",
                statusInfo.bgColor,
                statusInfo.color,
              )}
            >
              <StatusIcon
                weight="fill"
                className={cn(
                  "h-3.5 w-3.5",
                  trunk.registrationStatus === "registering" && "animate-spin",
                )}
              />
              {statusLabel}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
                trunk.enabled
                  ? "bg-emerald-500 text-white"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Power weight="fill" className="h-3.5 w-3.5" />
              {trunk.enabled ? t("status.active") : t("status.inactive")}
            </span>
            <span className="ml-auto text-xs font-mono text-muted-foreground">
              {t(`transport.${trunk.transport}`)} · {t("detail.labels.port")}{" "}
              {trunk.port}
            </span>
          </div>

          {trunk.lastError && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <Warning
                  weight="fill"
                  className="h-5 w-5 text-red-600 mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    {t("detail.lastError")}
                  </p>
                  <p className="text-xs text-red-700 mt-1">{trunk.lastError}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabbed content card */}
      <motion.div variants={itemVariants}>
        <div
          className="rounded-[26px] border border-border/70 bg-card/90 p-6"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto gap-1 p-1">
              <TabsTrigger
                value="overview"
                className="flex items-center gap-2 py-2"
              >
                <Info weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">Visão geral</span>
              </TabsTrigger>
              <TabsTrigger
                value="connection"
                className="flex items-center gap-2 py-2"
              >
                <Globe weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">Conexão</span>
              </TabsTrigger>
              <TabsTrigger
                value="registration"
                className="flex items-center gap-2 py-2"
              >
                <ShieldCheck weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">Registro</span>
              </TabsTrigger>
              <TabsTrigger
                value="media"
                className="flex items-center gap-2 py-2"
              >
                <Equalizer weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">Mídia &amp; Discagem</span>
              </TabsTrigger>
              <TabsTrigger
                value="system"
                className="flex items-center gap-2 py-2"
              >
                <Hash weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">Sistema</span>
              </TabsTrigger>
            </TabsList>

            {/* ───────────────────── Visão geral ───────────────────── */}
            <TabsContent
              value="overview"
              className="mt-6 space-y-4 focus-visible:outline-none"
            >
              <div className="mb-2 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                  <Gear weight="fill" className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("detail.overview")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("header.description")}
                  </p>
                </div>
              </div>

              {trunk.description && (
                <div className="rounded-xl bg-muted border border-border p-4">
                  <p className="text-sm text-foreground leading-relaxed">
                    {trunk.description}
                  </p>
                </div>
              )}

              <div>
                <InfoRow
                  icon={<Phone weight="fill" className="h-4 w-4" />}
                  label={t("form.labels.trunkType")}
                  value={
                    trunk.trunkType === "mobile"
                      ? t("detail.trunkTypeMobile")
                      : t("detail.trunkTypeFixed")
                  }
                />
                <InfoRow
                  icon={<Users weight="fill" className="h-4 w-4" />}
                  label={t("detail.labels.rotational")}
                  value={
                    trunk.isRotational
                      ? t("detail.values.yes")
                      : t("detail.values.no")
                  }
                />
                {trunk.phoneNumber && canMutate && (
                  <InfoRow
                    icon={<Phone weight="fill" className="h-4 w-4" />}
                    label={t("detail.phoneNumber")}
                    value={trunk.phoneNumber}
                    mono
                    copyable
                  />
                )}
              </div>
            </TabsContent>

            {/* ───────────────────── Conexão ───────────────────── */}
            <TabsContent
              value="connection"
              className="mt-6 space-y-4 focus-visible:outline-none"
            >
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-white">
                  <Globe weight="bold" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("detail.connectionSettings")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("form.sections.connection")}
                  </p>
                </div>
              </div>

              {canMutate ? (
                <div>
                  <InfoRow
                    icon={<Globe weight="fill" className="h-4 w-4" />}
                    label={t("detail.labels.host")}
                    value={trunk.host}
                    mono
                    copyable
                  />
                  <InfoRow
                    icon={<Hash weight="fill" className="h-4 w-4" />}
                    label={t("detail.labels.port")}
                    value={String(trunk.port)}
                    mono
                  />
                  <InfoRow
                    icon={<User weight="fill" className="h-4 w-4" />}
                    label={t("detail.labels.username")}
                    value={trunk.username}
                    mono
                    copyable
                  />
                  <InfoRow
                    icon={<Globe weight="fill" className="h-4 w-4" />}
                    label={t("detail.labels.fromDomain")}
                    value={trunk.domain || trunk.host}
                    mono
                  />
                  <InfoRow
                    icon={<Lightning weight="fill" className="h-4 w-4" />}
                    label={t("detail.labels.transport")}
                    value={t(`transport.${trunk.transport}`)}
                  />
                  {trunk.advanced?.outboundProxy && (
                    <InfoRow
                      icon={<Globe weight="fill" className="h-4 w-4" />}
                      label="Outbound proxy"
                      value={trunk.advanced.outboundProxy}
                      mono
                      copyable
                    />
                  )}
                  {trunk.advanced?.authUsername && (
                    <InfoRow
                      icon={<User weight="fill" className="h-4 w-4" />}
                      label="Auth username"
                      value={trunk.advanced.authUsername}
                      mono
                    />
                  )}
                  {trunk.advanced?.userAgent && (
                    <InfoRow
                      icon={<Info weight="fill" className="h-4 w-4" />}
                      label="User-Agent"
                      value={trunk.advanced.userAgent}
                      mono
                    />
                  )}
                  {(trunk.advanced?.bindHost || trunk.advanced?.bindPort) && (
                    <InfoRow
                      icon={<WifiHigh weight="fill" className="h-4 w-4" />}
                      label="Bind"
                      value={`${trunk.advanced?.bindHost ?? "0.0.0.0"}:${trunk.advanced?.bindPort ?? "auto"}`}
                      mono
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-muted/40 border border-border p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-lg">
                      <Prohibit className="h-5 w-5" weight="fill" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">
                        Detalhes de conexão restritos
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Este canal pertence a outro workspace. Por segurança,
                        informações sensíveis (endereço do servidor, usuário,
                        domínio) ficam visíveis apenas para o proprietário e
                        para administradores da plataforma.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ───────────────────── Registro ───────────────────── */}
            <TabsContent
              value="registration"
              className="mt-6 space-y-4 focus-visible:outline-none"
            >
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
                  <ShieldCheck weight="bold" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Registro SIP
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Como o tronco mantém a sessão ativa com o registrar
                  </p>
                </div>
              </div>

              <div>
                <InfoRow
                  icon={<ShieldCheck weight="fill" className="h-4 w-4" />}
                  label="REGISTER habilitado"
                  value={
                    trunk.advanced?.registerEnabled === false
                      ? t("detail.values.no") + " (inbound-only)"
                      : t("detail.values.yes")
                  }
                />
                <InfoRow
                  icon={<Clock weight="fill" className="h-4 w-4" />}
                  label="Expires (s)"
                  value={
                    trunk.advanced?.registerExpirySeconds
                      ? String(trunk.advanced.registerExpirySeconds)
                      : "60 (default)"
                  }
                  mono
                />
                <InfoRow
                  icon={<CircleNotch weight="fill" className="h-4 w-4" />}
                  label="Retry interval (s)"
                  value={
                    trunk.advanced?.registerRetrySeconds
                      ? String(trunk.advanced.registerRetrySeconds)
                      : "5 (default)"
                  }
                  mono
                />
                {trunk.lastRegisteredAt && (
                  <InfoRow
                    icon={<CheckCircle weight="fill" className="h-4 w-4" />}
                    label={t("detail.lastRegistration")}
                    value={formatDate(trunk.lastRegisteredAt)}
                  />
                )}
                {trunk.advanced?.sessionTimerEnabled !== undefined && (
                  <InfoRow
                    icon={<Clock weight="fill" className="h-4 w-4" />}
                    label="Session timer"
                    value={
                      trunk.advanced.sessionTimerEnabled
                        ? `${trunk.advanced.sessionTimerSeconds ?? 1800}s (refresher=${trunk.advanced.sessionRefresher || "auto"})`
                        : t("detail.values.no")
                    }
                  />
                )}
              </div>
            </TabsContent>

            {/* ───────────────────── Mídia & Discagem ───────────────────── */}
            <TabsContent
              value="media"
              className="mt-6 space-y-4 focus-visible:outline-none"
            >
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                  <Equalizer weight="bold" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Mídia &amp; plano de discagem
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Codecs, DTMF, SRTP e transformações de número
                  </p>
                </div>
              </div>

              <div>
                {trunk.advanced?.codecs && trunk.advanced.codecs.length > 0 && (
                  <InfoRow
                    icon={<Equalizer weight="fill" className="h-4 w-4" />}
                    label="Codecs"
                    value={trunk.advanced.codecs.join(", ")}
                    mono
                  />
                )}
                {trunk.advanced?.ptimeMs && (
                  <InfoRow
                    icon={<Clock weight="fill" className="h-4 w-4" />}
                    label="ptime (ms)"
                    value={String(trunk.advanced.ptimeMs)}
                    mono
                  />
                )}
                {trunk.advanced?.srtpMode && (
                  <InfoRow
                    icon={<ShieldCheck weight="fill" className="h-4 w-4" />}
                    label="SRTP"
                    value={trunk.advanced.srtpMode}
                  />
                )}
                {trunk.advanced?.dtmfPayloadType && (
                  <InfoRow
                    icon={<ListNumbers weight="fill" className="h-4 w-4" />}
                    label="DTMF payload type"
                    value={String(trunk.advanced.dtmfPayloadType)}
                    mono
                  />
                )}
                {trunk.advanced?.dialPrefix && (
                  <InfoRow
                    icon={<ListNumbers weight="fill" className="h-4 w-4" />}
                    label="Tech-prefix"
                    value={trunk.advanced.dialPrefix}
                    mono
                  />
                )}
                {trunk.advanced?.dialStripDigits !== undefined &&
                  trunk.advanced.dialStripDigits > 0 && (
                    <InfoRow
                      icon={<ListNumbers weight="fill" className="h-4 w-4" />}
                      label="Strip digits"
                      value={String(trunk.advanced.dialStripDigits)}
                      mono
                    />
                  )}
                {trunk.advanced?.numberFormat &&
                  trunk.advanced.numberFormat !== "passthrough" && (
                    <InfoRow
                      icon={<Hash weight="fill" className="h-4 w-4" />}
                      label="Number format"
                      value={trunk.advanced.numberFormat}
                    />
                  )}
                {trunk.advanced?.hideCallerId && (
                  <InfoRow
                    icon={<Prohibit weight="fill" className="h-4 w-4" />}
                    label="Hide caller ID"
                    value={t("detail.values.yes")}
                  />
                )}
                {trunk.advanced?.publicAddress && (
                  <InfoRow
                    icon={<WifiHigh weight="fill" className="h-4 w-4" />}
                    label="Public address"
                    value={trunk.advanced.publicAddress}
                    mono
                  />
                )}
                {trunk.advanced?.stunEnabled && (
                  <InfoRow
                    icon={<WifiHigh weight="fill" className="h-4 w-4" />}
                    label="STUN servers"
                    value={
                      trunk.advanced.stunServers?.join(", ") || "(default)"
                    }
                    mono
                  />
                )}
                {!trunk.advanced && (
                  <p className="rounded-xl bg-muted/40 border border-border p-4 text-xs text-muted-foreground">
                    Nenhuma configuração avançada definida, usando padrões do
                    sistema.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* ───────────────────── Sistema ───────────────────── */}
            <TabsContent
              value="system"
              className="mt-6 space-y-4 focus-visible:outline-none"
            >
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500 text-white">
                  <Hash weight="bold" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("detail.details")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("detail.detailsSubtitle")}
                  </p>
                </div>
              </div>

              <div>
                <InfoRow
                  icon={<Hash weight="fill" className="h-4 w-4" />}
                  label={t("detail.labels.trunkId")}
                  value={trunk.id}
                  mono
                  copyable
                />
                <InfoRow
                  icon={<Clock weight="fill" className="h-4 w-4" />}
                  label={t("detail.labels.createdAt")}
                  value={formatDate(trunk.createdAt)}
                />
                <InfoRow
                  icon={<CalendarCheck weight="fill" className="h-4 w-4" />}
                  label={t("detail.labels.updatedAt")}
                  value={formatDate(trunk.updatedAt)}
                />
                <InfoRow
                  icon={<SimCard weight="fill" className="h-4 w-4" />}
                  label="Visibilidade"
                  value={trunk.isGloballyVisible ? "Global" : "Workspace"}
                />
              </div>

              {isPlatformAdmin && (
                <div className="rounded-[20px] border border-sky-500/30 bg-sky-500/5 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-lg">
                      <Gear className="h-5 w-5" weight="fill" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">
                        Gerenciamento administrativo
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Como administrador da plataforma, use a área dedicada
                        para controlar visibilidade global e transferir a
                        propriedade deste trunk.
                      </p>
                      <div className="mt-3">
                        <Button
                          variant="action"
                          title="Abrir visão administrativa"
                          icon={<Gear className="h-4 w-4" weight="bold" />}
                          iconVisible
                          iconSide="left"
                          link={`/dashboard/admin/sip-trunks/${trunk.id}`}
                          newTab={false}
                          className="text-[11px] font-semibold uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>

      {/* Delete Dialog */}
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
