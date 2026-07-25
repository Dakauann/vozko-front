"use client";

import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle,
  CircleNotch,
  Clock,
  Copy,
  DeviceMobileCamera,
  Globe,
  Hash,
  Headset,
  IdentificationCard,
  Info,
  Key,
  Lightning,
  PencilSimple,
  PhoneDisconnect,
  PlugsConnected,
  Power,
  ShieldCheck,
  Trash,
  User,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import type { Branch, BranchConnectionInfo, BranchRegistrationStatus, BranchSecretResult } from "@/lib/branches/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteBranchAction, getBranchAction, getBranchSipConfigAction, rotateBranchSecretAction, toggleBranchAction } from "@/app/actions/branches";
import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";

import BranchSecretDialog from "../_components/BranchSecretDialog";
import Button from "@/components/elevated-design/button";
import DeleteBranchDialog from "../_components/DeleteBranchDialog";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { cn } from "@/lib/utils";
import { listMembersAction } from "@/app/actions/workspace";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const statusConfig: Record<BranchRegistrationStatus, { icon: typeof CheckCircle; color: string; bgColor: string }> = {
  registered: { icon: CheckCircle, color: "text-emerald-600", bgColor: "bg-emerald-500/15" },
  never_registered: { icon: PhoneDisconnect, color: "text-muted-foreground", bgColor: "bg-muted" },
  expired: { icon: Clock, color: "text-amber-600", bgColor: "bg-amber-500/15" },
  unreachable: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-500/15" },
};

function formatDate(dateString?: string | null) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

function InfoRow({ icon, label, value, mono, copyable }: { icon: React.ReactNode; label: string; value?: string | null; mono?: boolean; copyable?: boolean }) {
  const { toast } = useToast();
  const t = useTranslations("branchesPage.secret");
  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      toast({ title: t("copied") });
    }
  };
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>{value || "-"}</span>
        {copyable && value && (
          <button type="button" onClick={handleCopy} className="text-muted-foreground transition-colors hover:text-foreground">
            <Copy weight="bold" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function BranchDetailPage() {
  const t = useTranslations("branchesPage");
  const tSecret = useTranslations("branchesPage.secret");
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentWorkspace, can } = useWorkspace();
  const branchId = String(params.branchId);
  const canManage = can("branches", "update");

  const [branch, setBranch] = useState<Branch | null>(null);
  const [sipConfig, setSipConfig] = useState<BranchConnectionInfo | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, startBusy] = useTransition();
  const [secret, setSecret] = useState<BranchSecretResult | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [{ branch: b, error }, { config }] = await Promise.all([getBranchAction(branchId), getBranchSipConfigAction()]);
      if (!active) return;
      if (error || !b) {
        toast({ title: t("toast.genericError"), description: error ?? "", variant: "destructive" });
      } else {
        setBranch(b);
      }
      setSipConfig(config);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [branchId, toast, t]);

  useEffect(() => {
    if (!branch || !currentWorkspace?.id) return;
    void (async () => {
      const { members } = await listMembersAction(currentWorkspace.id);
      const m = members.find((x) => x.userId === branch.userId);
      setMemberName(m ? m.username || m.email : null);
    })();
  }, [branch, currentWorkspace?.id]);

  const handleRotate = () =>
    startBusy(async () => {
      const { result, error } = await rotateBranchSecretAction(branchId);
      if (error || !result) {
        toast({ title: t("toast.genericError"), description: error ?? "", variant: "destructive" });
      } else {
        setSecret(result);
        toast({ title: t("toast.rotated") });
      }
    });

  const handleToggle = () =>
    startBusy(async () => {
      if (!branch) return;
      const { error } = await toggleBranchAction(branch.id, { enabled: !branch.enabled });
      if (error) {
        toast({ title: t("toast.genericError"), description: error, variant: "destructive" });
      } else {
        toast({ title: branch.enabled ? t("toast.disabled") : t("toast.enabled") });
        setBranch((prev) => (prev ? { ...prev, enabled: !prev.enabled } : prev));
      }
    });

  const handleDelete = () =>
    startBusy(async () => {
      const { error } = await deleteBranchAction(branchId);
      if (error) {
        toast({ title: t("toast.genericError"), description: error, variant: "destructive" });
      } else {
        toast({ title: t("toast.deleted") });
        router.push("/dashboard/branches");
      }
      setDeleting(false);
    });

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <CircleNotch weight="bold" className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <ElevatedContainer className="max-w-md p-8 text-center">
          <Warning weight="fill" className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h2 className="text-xl font-semibold text-foreground">{t("detail.notFoundTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("detail.notFoundBody")}</p>
          <Button variant="outline" title={t("detail.back")} link="/dashboard/branches" newTab={false} className="mt-4 text-[11px] font-semibold uppercase" />
        </ElevatedContainer>
      </div>
    );
  }

  const st = statusConfig[branch.registrationStatus] ?? statusConfig.never_registered;
  const StatusIcon = st.icon;

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            title=""
            icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            link="/dashboard/branches"
            newTab={false}
            className="text-xs font-semibold uppercase"
          />
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
              <Headset weight="fill" className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("badge")}</p>
              <h1 className="text-2xl font-bold text-foreground">
                <span className="font-mono">{branch.sipUser}</span>
                {branch.displayName ? <span className="ml-2 font-sans text-xl text-muted-foreground">{branch.displayName}</span> : null}
              </h1>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              title={t("detail.edit")}
              icon={<PencilSimple weight="bold" className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              link={`/dashboard/branches/${branch.id}/edit`}
              newTab={false}
              className="text-[11px] font-semibold uppercase"
              disabled={busy}
            />
            <Button
              type="button"
              variant={branch.enabled ? "ghost" : "action"}
              title={branch.enabled ? t("detail.disable") : t("detail.enable")}
              icon={<Power weight="fill" className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={handleToggle}
              disabled={busy}
              className={cn("text-[11px] font-semibold uppercase", branch.enabled && "text-amber-600 hover:bg-amber-500/10")}
            />
            <Button
              type="button"
              variant="ghost"
              title={t("detail.delete")}
              icon={<Trash weight="bold" className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={() => setDeleting(true)}
              disabled={busy}
              className="text-[11px] font-semibold uppercase text-red-600 hover:bg-destructive/10"
            />
          </div>
        )}
      </motion.div>

      {/* Status banner */}
      <motion.div variants={itemVariants}>
        <div className="rounded-[26px] border border-border/70 bg-card/90 p-5" style={{ boxShadow: softSurfaceShadow }}>
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide", st.bgColor, st.color)}>
              <StatusIcon weight="fill" className="h-3.5 w-3.5" />
              {t(`status.${branch.registrationStatus}`)}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
                branch.enabled ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
              )}
            >
              <Power weight="fill" className="h-3.5 w-3.5" />
              {branch.enabled ? t("active") : t("inactive")}
            </span>
            {sipConfig?.configured ? (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {sipConfig.transport} · {sipConfig.server}:{sipConfig.port}
              </span>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* Tabbed content */}
      <motion.div variants={itemVariants}>
        <div className="rounded-[26px] border border-border/70 bg-card/90 p-6" style={{ boxShadow: softSurfaceShadow }}>
          <Tabs defaultValue="connection" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1">
              <TabsTrigger value="connection" className="flex items-center gap-2 py-2">
                <Globe weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">{t("detail.connection")}</span>
              </TabsTrigger>
              <TabsTrigger value="identity" className="flex items-center gap-2 py-2">
                <IdentificationCard weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">{t("detail.identity")}</span>
              </TabsTrigger>
              <TabsTrigger value="registration" className="flex items-center gap-2 py-2">
                <ShieldCheck weight="bold" className="h-4 w-4" />
                <span className="hidden sm:inline">{t("detail.registration")}</span>
              </TabsTrigger>
            </TabsList>

            {/* Conexão */}
            <TabsContent value="connection" className="mt-6 space-y-4 focus-visible:outline-none">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-white">
                  <Globe weight="bold" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{t("detail.connection")}</h2>
                  <p className="text-sm text-muted-foreground">{t("detail.connectionHint")}</p>
                </div>
              </div>

              {sipConfig?.configured ? (
                <div>
                  <InfoRow icon={<Globe weight="fill" className="h-4 w-4" />} label={tSecret("server")} value={sipConfig.server} mono copyable />
                  <InfoRow icon={<Hash weight="fill" className="h-4 w-4" />} label={tSecret("port")} value={String(sipConfig.port)} mono copyable />
                  <InfoRow icon={<Lightning weight="fill" className="h-4 w-4" />} label={tSecret("transport")} value={sipConfig.transport} />
                  <InfoRow icon={<User weight="fill" className="h-4 w-4" />} label={tSecret("sipUser")} value={branch.sipUser} mono copyable />
                  <InfoRow icon={<Globe weight="fill" className="h-4 w-4" />} label={tSecret("realm")} value={branch.realm} mono />
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <div className="flex items-start gap-3">
                    <Warning weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    <p className="text-sm text-muted-foreground">{tSecret("serverNotConfigured")}</p>
                  </div>
                </div>
              )}

              {canManage && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    title={t("detail.rotate")}
                    icon={busy ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <Key className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    onClick={handleRotate}
                    disabled={busy}
                    className="text-[11px] font-semibold uppercase"
                  />
                  <p className="text-xs text-muted-foreground">{t("detail.rotateHint")}</p>
                </div>
              )}
            </TabsContent>

            {/* Identidade */}
            <TabsContent value="identity" className="mt-6 space-y-4 focus-visible:outline-none">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                  <IdentificationCard weight="fill" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{t("detail.identity")}</h2>
                  <p className="text-sm text-muted-foreground">{t("detail.identityHint")}</p>
                </div>
              </div>
              <div>
                <InfoRow icon={<User weight="fill" className="h-4 w-4" />} label={t("detail.member")} value={memberName} />
                <InfoRow icon={<Headset weight="fill" className="h-4 w-4" />} label={tSecret("sipUser")} value={branch.sipUser} mono copyable />
                {branch.displayName ? <InfoRow icon={<Info weight="fill" className="h-4 w-4" />} label={t("detail.displayName")} value={branch.displayName} /> : null}
                <InfoRow icon={<DeviceMobileCamera weight="fill" className="h-4 w-4" />} label={t("detail.maxContacts")} value={String(branch.maxContacts)} mono />
                <InfoRow icon={<PhoneDisconnect weight="fill" className="h-4 w-4" />} label={t("detail.dnd")} value={branch.dnd ? t("detail.on") : t("detail.off")} />
                {branch.codecs && branch.codecs.length > 0 ? (
                  <InfoRow icon={<Lightning weight="fill" className="h-4 w-4" />} label={t("detail.codecs")} value={branch.codecs.map((c) => c.toUpperCase()).join(", ")} mono />
                ) : null}
              </div>
            </TabsContent>

            {/* Registro */}
            <TabsContent value="registration" className="mt-6 space-y-4 focus-visible:outline-none">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
                  <ShieldCheck weight="bold" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{t("detail.registration")}</h2>
                  <p className="text-sm text-muted-foreground">{t("detail.registrationHint")}</p>
                </div>
              </div>
              <div>
                <InfoRow
                  icon={<ShieldCheck weight="fill" className="h-4 w-4" />}
                  label={t("detail.status")}
                  value={t(`status.${branch.registrationStatus}`)}
                />
                <InfoRow icon={<CalendarCheck weight="fill" className="h-4 w-4" />} label={t("detail.lastRegistered")} value={branch.lastRegisteredAt ? formatDate(branch.lastRegisteredAt) : t("detail.never")} />
                <InfoRow icon={<Clock weight="fill" className="h-4 w-4" />} label={t("detail.createdAt")} value={formatDate(branch.createdAt)} />
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant={branch.enabled ? "outline" : "action"}
                  title={branch.enabled ? t("detail.disable") : t("detail.enable")}
                  icon={branch.enabled ? <PhoneDisconnect className="h-4 w-4" weight="bold" /> : <PlugsConnected className="h-4 w-4" weight="bold" />}
                  iconVisible
                  iconSide="left"
                  onClick={handleToggle}
                  disabled={busy}
                  className="text-[11px] font-semibold uppercase"
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>

      <DeleteBranchDialog open={deleting} branchName={branch.sipUser} isLoading={busy} onClose={() => setDeleting(false)} onConfirm={handleDelete} />
      <BranchSecretDialog result={secret} rotated onClose={() => setSecret(null)} />
    </motion.div>
  );
}
