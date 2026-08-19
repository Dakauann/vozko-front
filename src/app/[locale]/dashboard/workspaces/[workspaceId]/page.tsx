"use client";

import * as React from "react";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Buildings,
  CalendarCheck,
  CircleNotch,
  Crown,
  CurrencyDollar,
  Envelope,
  Info,
  Eye,
  FloppyDisk,
  Microphone,
  PencilSimple,
  Phone,
  Shield,
  SpeakerHigh,
  Star,
  UserCircle,
  Users,
  Wallet,
  WhatsappLogo,
  X,
} from "@/components/icons";
import { channelPlate } from "@/components/channels/channel-tile";
import type { Icon } from "@/components/icons";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/elevated-design/elevated-tabs";
import type {
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from "@/lib/workspace/types";
import { getResolvedPricingAction } from "@/app/actions/pricing";
import {
  getWorkspaceAction,
  listMembersAction,
  listWorkspaceInvitesAction,
} from "@/app/actions/workspace";
import {
  getWorkspaceConfigAction,
  adminUpdateWorkspaceConfigAction,
} from "@/app/actions/workspace-config";
import {
  adminCancelWorkspaceSubscriptionAction,
  adminCreateSubscriptionInvoiceAction,
  adminGetWorkspaceSubscriptionAction,
  adminListPlansAction,
} from "@/app/actions/workspace-plan";
import type { WorkspaceConfig } from "@/lib/workspace/workspace-config/types";
import type {
  PlanDefinition,
  WorkspaceSubscriptionDetails,
} from "@/lib/workspace-plan/types";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { IconBox } from "@/components/elevated-design/listing-card";
import { formatPricingServiceFallback } from "@/lib/branding/ai-models";
import Link from "next/link";
import type { ResolvedPricingItem } from "@/lib/pricing/types";
import type { BillingType } from "@/lib/invoices/types";
import type { User } from "@/lib/users/types";
import type { Workspace } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import { getUserByIdAction } from "@/app/actions/users";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";


const MICROS = 1_000_000;

function microsToDisplay(micros: number): string {
  return (micros / MICROS).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

// The plate carries the glyph colour, so `fg` is vestigial and empty. Both the
// fixed `text-white` and the `bg-muted` fallback that replaced it were wrong in
// the same place: tts and telephony rendered a glyph nobody could see.
const CATEGORY_META: Record<string, { icon: Icon; bg: string; fg: string }> = {
  tts: { icon: SpeakerHigh, bg: "tile-5", fg: "" },
  stt: { icon: Microphone, bg: "tile-4", fg: "" },
  whatsapp: { icon: WhatsappLogo, bg: channelPlate("whatsapp"), fg: "" },
  telephony: { icon: Phone, bg: channelPlate("voice"), fg: "" },
  exchange_rate: { icon: CurrencyDollar, bg: "tile-3", fg: "" },
};

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

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


function RoleBadge({
  role,
  t,
}: {
  role: WorkspaceRole;
  t: ReturnType<typeof useTranslations>;
}) {
  const config = {
    owner: { bg: "tile-3", icon: Crown },
    admin: { bg: "tile-brand", icon: Shield },
    member: { bg: "tile-2", icon: Users },
    employee: { bg: "tile-2", icon: Users },
  };
  const { bg, icon: Icon } = config[role] ?? config.member;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
        bg,
      )}
    >
      <Icon className="h-3 w-3" weight="fill" />
      {t(`roles.${role}`)}
    </span>
  );
}


function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const config: Record<string, string> = {
    pending: "bg-warning text-warning-foreground",
    accepted: "bg-healthy text-healthy-foreground",
    declined: "bg-destructive text-destructive-foreground",
    expired: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[--radius] px-2 py-0.5 text-2xs font-semibold",
        config[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {t(`inviteStatus.${status}`)}
    </span>
  );
}


export default function AdminWorkspaceDetailPage() {
  const t = useTranslations("adminWorkspaceDetail");
  const tp = useTranslations("adminPricing");
  const { toast } = useToast();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [workspace, setWorkspace] = React.useState<Workspace | null>(null);
  const [owner, setOwner] = React.useState<User | null>(null);
  const [members, setMembers] = React.useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = React.useState<WorkspaceInvite[]>([]);
  const [resolvedPricing, setResolvedPricing] = React.useState<
    ResolvedPricingItem[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [wsConfig, setWsConfig] = React.useState<WorkspaceConfig | null>(null);
  /**
   * The unofficial-WhatsApp allowance, editable here and NOWHERE else.
   *
   * This screen is behind the platform-admin routes; the workspace's own
   * settings page cannot express this field at all, because the tenant-facing
   * update takes a different input type on the server. Granting capacity on
   * hosts we pay for, on a channel where a connected number can get a customer
   * banned, is a decision that belongs to us.
   */
  const [includedInstances, setIncludedInstances] = React.useState<number | "">("");
  const [spamDays, setSpamDays] = React.useState<number | "">(0);
  const [savingConfig, setSavingConfig] = React.useState(false);

  const [workspaceSubscription, setWorkspaceSubscription] =
    React.useState<WorkspaceSubscriptionDetails | null>(null);
  const [subscriptionError, setSubscriptionError] = React.useState<
    string | null
  >(null);
  const [cancellingSubscription, setCancellingSubscription] =
    React.useState(false);

  const [availablePlans, setAvailablePlans] = React.useState<PlanDefinition[]>(
    [],
  );
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>("");
  const [selectedBillingType, setSelectedBillingType] =
    React.useState<string>("PIX");
  const [generatingInvoice, setGeneratingInvoice] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setSubscriptionError(null);
    try {
      const [
        wsRes,
        membersRes,
        invitesRes,
        pricingRes,
        configRes,
        subscriptionRes,
        plansRes,
      ] = await Promise.all([
        getWorkspaceAction(workspaceId),
        listMembersAction(workspaceId),
        listWorkspaceInvitesAction(workspaceId),
        getResolvedPricingAction(workspaceId),
        getWorkspaceConfigAction(workspaceId),
        adminGetWorkspaceSubscriptionAction(workspaceId),
        adminListPlansAction(false),
      ]);

      if (wsRes.error) {
        setError(wsRes.error);
        return;
      }

      setWorkspace(wsRes.workspace);
      if (!membersRes.error) setMembers(membersRes.members);
      if (!invitesRes.error) setInvites(invitesRes.invites);
      if (!pricingRes.error) setResolvedPricing(pricingRes.items);
      if (!configRes.error && configRes.config) {
        setWsConfig(configRes.config);
        setSpamDays(configRes.config.campaignSpamProtectionDays);
        setIncludedInstances(
          configRes.config.includedUnofficialWhatsAppInstances ?? 0,
        );
      }
      if (subscriptionRes.error) {
        setSubscriptionError(subscriptionRes.error);
        setWorkspaceSubscription(null);
      } else {
        setWorkspaceSubscription(subscriptionRes.subscription);
      }

      if (!plansRes.error && plansRes.plans) {
        setAvailablePlans(
          plansRes.plans.filter(
            (p) => !p.archivedAt && p.basePriceBRLCents > 0,
          ),
        );
      }

      if (wsRes.workspace?.ownerId) {
        const ownerRes = await getUserByIdAction(wsRes.workspace.ownerId);
        if (ownerRes.user) setOwner(ownerRes.user);
      }
    } catch {
      setError(t("error.default"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, t]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const memberColumns = React.useMemo<DashboardTableColumn<WorkspaceMember>[]>(
    () => [
      {
        header: t("members.user"),
        key: "user",
        render: (member) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted">
              <UserCircle
                className="h-6 w-6 text-muted-foreground"
                weight="fill"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {member.username || member.email}
              </p>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </div>
          </div>
        ),
      },
      {
        header: t("members.role"),
        key: "role",
        render: (member) => <RoleBadge role={member.role} t={t} />,
      },
      {
        header: t("members.joinedAt"),
        key: "joinedAt",
        render: (member) => (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarCheck
              className="h-3.5 w-3.5 text-muted-foreground"
              weight="fill"
            />
            {formatDate(member.createdAt)}
          </div>
        ),
      },
    ],
    [t],
  );

  const inviteColumns = React.useMemo<DashboardTableColumn<WorkspaceInvite>[]>(
    () => [
      {
        header: t("invites.email"),
        key: "email",
        render: (invite) => (
          <div className="flex items-center gap-2">
            <Envelope className="h-4 w-4 text-muted-foreground" weight="fill" />
            <span className="text-sm text-foreground">{invite.email}</span>
          </div>
        ),
      },
      {
        header: t("invites.role"),
        key: "role",
        render: (invite) => <RoleBadge role={invite.role} t={t} />,
      },
      {
        header: t("invites.status"),
        key: "status",
        render: (invite) => <StatusBadge status={invite.status} t={t} />,
      },
      {
        header: t("invites.invitedBy"),
        key: "invitedBy",
        render: (invite) => (
          <span className="text-xs text-muted-foreground">
            {invite.inviterEmail}
          </span>
        ),
      },
      {
        header: t("invites.expiresAt"),
        key: "expiresAt",
        render: (invite) => (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarCheck
              className="h-3.5 w-3.5 text-muted-foreground"
              weight="fill"
            />
            {formatDate(invite.expiresAt)}
          </div>
        ),
      },
    ],
    [t],
  );

  const pricingColumns = React.useMemo<
    DashboardTableColumn<ResolvedPricingItem>[]
  >(
    () => [
      {
        header: tp("table.category"),
        key: "category",
        render: (item) => {
          const meta = CATEGORY_META[item.category];
          if (!meta) return <span className="text-sm">{item.category}</span>;
          const Icon = meta.icon;
          return (
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  meta.bg,
                )}
              >
                <Icon className={cn("h-4 w-4", meta.fg)} weight="fill" />
              </div>
              <span className="text-xs font-semibold text-foreground">
                {tp(`categories.${item.category}`)}
              </span>
            </div>
          );
        },
      },
      {
        header: tp("table.service"),
        key: "service",
        render: (item) => (
          <span className="text-sm text-foreground">
            {(() => {
              const translationKey =
                `services.${item.category}.${item.service}` as const;
              return tp.has(translationKey)
                ? tp(translationKey)
                : formatPricingServiceFallback(item.service);
            })()}
          </span>
        ),
      },
      {
        header: tp("table.price"),
        key: "price",
        className: "text-right",
        render: (item) => {
          return (
            <div className="flex items-center justify-end gap-1.5">
              {item.isOverride && (
                <span className="text-2xs text-muted-foreground line-through tabular-nums">
                  ${microsToDisplay(item.defaultPriceMicros)}
                </span>
              )}
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums whitespace-nowrap",
                  item.isOverride ? "text-warning-ink" : "text-foreground",
                )}
              >
                ${microsToDisplay(item.priceMicros)}
              </span>
            </div>
          );
        },
      },
    ],
    [tp],
  );

  const overrideCount = resolvedPricing.filter((p) => p.isOverride).length;
  const currentSubscription = workspaceSubscription?.subscription ?? null;

  const ownerMember = members.find((m) => m.role === "owner");
  const adminMembers = members.filter((m) => m.role === "admin");
  const employeeMembers = members.filter(
    (m) => m.role !== "owner" && m.role !== "admin",
  );
  const pendingInvites = invites.filter((i) => i.status === "pending");

  const subscriptionStatusLabel = currentSubscription
    ? t(`subscriptionStatus.${currentSubscription.status}`)
    : null;

  const subscriptionStatusClass = currentSubscription
    ? currentSubscription.status === "active"
      ? "bg-healthy text-healthy-foreground"
      : currentSubscription.status === "cancelled"
        ? "bg-warning text-warning-foreground"
        : "bg-muted text-muted-foreground"
    : "bg-muted text-muted-foreground";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <CircleNotch
          className="h-8 w-8 animate-spin text-primary-ink"
          weight="bold"
        />
        <p className="text-sm text-muted-foreground mt-3">{t("loading")}</p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div
        className="mx-auto max-w-2xl rounded-[--radius] border border-border bg-card p-12 text-center mt-8"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <Buildings
          className="h-12 w-12 text-destructive-ink mx-auto mb-4"
          weight="fill"
        />
        <p className="font-semibold text-foreground">{t("error.title")}</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
        <Button
          variant="outline"
          title={t("button.retry")}
          className="mt-4"
          onClick={loadData}
        />
      </div>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      {/* Back link */}
      <Link
        href="/dashboard/workspaces"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary-ink transition-colors"
      >
        <ArrowLeft className="h-4 w-4" weight="bold" />
        {t("header.backToWorkspaces")}
      </Link>

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <DashboardPageHeader
          icon={<Buildings className="h-6 w-6" weight="fill" />}
          badge={workspace.name}
          description={t("header.title")}
          actions={
            <>
              <Link
                href="/dashboard/plans"
                className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-muted hover:border-border hover:text-primary-ink flex-shrink-0"
                style={{ boxShadow: softSurfaceShadow }}
              >
                <CurrencyDollar className="h-4 w-4" weight="bold" />
                {t("config.subscription.managePlans")}
              </Link>
              <Link
                href={`/dashboard/workspaces/${workspace.id}/balance`}
                className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-muted hover:border-border hover:text-primary-ink flex-shrink-0"
                style={{ boxShadow: softSurfaceShadow }}
              >
                <Wallet className="h-4 w-4" weight="bold" />
                {t("button.manageBalance")}
              </Link>
            </>
          }
        />
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">{t("tabs.overview")}</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("tabs.members")} ({members.length})
              </span>
            </TabsTrigger>
            <TabsTrigger value="invites" className="gap-2">
              <Envelope className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("tabs.invites")} ({pendingInvites.length})
              </span>
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2">
              <CurrencyDollar className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("overview.pricing")} ({resolvedPricing.length})
              </span>
            </TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview">
            {/* ── Spam Protection Config ── */}
            <div
              className="rounded-[--radius] border border-border bg-card p-5 space-y-4 mb-4"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <WhatsappLogo
                  className="h-4 w-4 text-healthy-ink"
                  weight="fill"
                />
                {t("config.spamProtection.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("config.spamProtection.description")}
              </p>
              <div className="flex items-end gap-3">
                <div className="w-48">
                  <ElevatedInput
                    type="number"
                    label={t("config.spamProtection.label")}
                    min={0}
                    value={spamDays}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSpamDays(
                        Number.isNaN(val) ? "" : Math.max(0, Math.round(val)),
                      );
                    }}
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  title={
                    savingConfig
                      ? t("config.spamProtection.saving")
                      : t("config.spamProtection.save")
                  }
                  icon={<FloppyDisk className="h-3.5 w-3.5" weight="bold" />}
                  iconVisible
                  iconSide="left"
                  disabled={
                    savingConfig ||
                    spamDays === "" ||
                    spamDays === wsConfig?.campaignSpamProtectionDays
                  }
                  onClick={async () => {
                    if (spamDays === "") return;
                    setSavingConfig(true);
                    const res = await adminUpdateWorkspaceConfigAction(
                      workspaceId,
                      { campaignSpamProtectionDays: spamDays },
                    );
                    setSavingConfig(false);
                    if (res.error) {
                      toast({ title: res.error, variant: "destructive" });
                    } else if (res.config) {
                      setWsConfig(res.config);
                      setSpamDays(res.config.campaignSpamProtectionDays);
                      toast({ title: t("config.spamProtection.success") });
                    }
                  }}
                />
              </div>
            </div>

            {/* ── Unofficial WhatsApp allowance ── */}
            <div
              className="rounded-[--radius] border border-border bg-card p-5 space-y-4 mb-4"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <h3 className="text-sm font-semibold text-foreground">
                {t("config.unofficialWhatsapp.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("config.unofficialWhatsapp.description")}
              </p>
              <div className="flex items-end gap-3">
                <div className="w-48">
                  <ElevatedInput
                    type="number"
                    label={t("config.unofficialWhatsapp.label")}
                    min={0}
                    value={includedInstances}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      // Clamped to a non-negative integer here as well as on the
                      // server, which REJECTS a negative rather than clamping:
                      // silently turning a typo into zero would revoke a
                      // workspace's whole allowance while reporting success.
                      setIncludedInstances(
                        Number.isNaN(val) ? "" : Math.max(0, Math.round(val)),
                      );
                    }}
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  title={
                    savingConfig
                      ? t("config.unofficialWhatsapp.saving")
                      : t("config.unofficialWhatsapp.save")
                  }
                  icon={<FloppyDisk className="h-3.5 w-3.5" weight="bold" />}
                  iconVisible
                  iconSide="left"
                  disabled={
                    savingConfig ||
                    includedInstances === "" ||
                    includedInstances ===
                      (wsConfig?.includedUnofficialWhatsAppInstances ?? 0)
                  }
                  onClick={async () => {
                    if (includedInstances === "") return;
                    setSavingConfig(true);
                    // ONLY this field. The server reads an absent field as
                    // "leave it alone", so sending the whole form would rewrite
                    // settings nobody touched.
                    const res = await adminUpdateWorkspaceConfigAction(
                      workspaceId,
                      { includedUnofficialWhatsAppInstances: includedInstances },
                    );
                    setSavingConfig(false);
                    if (res.error) {
                      toast({ title: res.error, variant: "destructive" });
                    } else if (res.config) {
                      setWsConfig(res.config);
                      setIncludedInstances(
                        res.config.includedUnofficialWhatsAppInstances ?? 0,
                      );
                      toast({ title: t("config.unofficialWhatsapp.success") });
                    }
                  }}
                />
              </div>
            </div>

            {/* ── Workspace Subscription ── */}
            <div
              className="rounded-[--radius] border border-border bg-card p-5 space-y-4 mb-4"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CurrencyDollar
                      className="h-4 w-4 text-healthy-ink"
                      weight="fill"
                    />
                    {t("config.subscription.title")}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("config.subscription.description")}
                  </p>
                </div>

                {currentSubscription?.status === "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    title={
                      cancellingSubscription
                        ? t("config.subscription.cancelling")
                        : t("config.subscription.cancel")
                    }
                    icon={
                      cancellingSubscription ? (
                        <CircleNotch
                          className="h-3.5 w-3.5 animate-spin"
                          weight="bold"
                        />
                      ) : (
                        <X className="h-3.5 w-3.5" weight="bold" />
                      )
                    }
                    iconVisible
                    iconSide="left"
                    disabled={cancellingSubscription}
                    onClick={async () => {
                      setCancellingSubscription(true);
                      const result =
                        await adminCancelWorkspaceSubscriptionAction(
                          workspaceId,
                        );
                      setCancellingSubscription(false);
                      if (result.error) {
                        toast({ title: result.error, variant: "destructive" });
                        return;
                      }
                      setWorkspaceSubscription(result.subscription);
                      toast({ title: t("config.subscription.cancelSuccess") });
                    }}
                  />
                ) : null}
              </div>

              {subscriptionError ? (
                <div className="rounded-[--radius] border border-destructive bg-destructive px-4 py-3 text-xs text-destructive-foreground">
                  {subscriptionError}
                </div>
              ) : currentSubscription ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {t("config.subscription.contractFlow")}
                    </span>
                    <span
                      className={cn(
                        "rounded-[--radius] px-2.5 py-1 font-semibold",
                        subscriptionStatusClass,
                      )}
                    >
                      {subscriptionStatusLabel}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-2xs text-muted-foreground font-medium">
                        {t("config.subscription.plan")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {workspaceSubscription?.plan?.name ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-2xs text-muted-foreground font-medium">
                        {t("config.subscription.period")}
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {formatDate(currentSubscription.currentPeriodStart)}
                        {" - "}
                        {formatDate(currentSubscription.currentPeriodEnd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-2xs text-muted-foreground font-medium">
                        {t("config.subscription.basePrice")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(
                          (workspaceSubscription?.plan?.basePriceBRLCents ??
                            0) / 100,
                        )}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[--radius] border border-dashed border-border bg-background px-4 py-5">
                    <p className="text-sm font-medium text-foreground">
                      {t("config.subscription.empty")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("config.subscription.emptyDescription")}
                    </p>
                  </div>

                  {availablePlans.length > 0 && (
                    <div className="rounded-[--radius] border border-border bg-background p-4 space-y-3">
                      <p className="text-xs font-semibold text-foreground">
                        {t("config.subscription.generateInvoice")}
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-56">
                          <label className="block text-2xs text-muted-foreground font-medium mb-1">
                            {t("config.subscription.plan")}
                          </label>
                          <select
                            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                            value={selectedPlanId}
                            onChange={(e) => setSelectedPlanId(e.target.value)}
                          >
                            <option value="">
                              {t("config.subscription.selectPlan")}
                            </option>
                            {availablePlans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name} ,{" "}
                                {new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(plan.basePriceBRLCents / 100)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-36">
                          <label className="block text-2xs text-muted-foreground font-medium mb-1">
                            {t("config.subscription.billingType")}
                          </label>
                          <select
                            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                            value={selectedBillingType}
                            onChange={(e) =>
                              setSelectedBillingType(e.target.value)
                            }
                          >
                            <option value="PIX">PIX</option>
                            <option value="BOLETO">Boleto</option>
                            <option value="CREDIT_CARD">
                              {t("config.subscription.creditCard")}
                            </option>
                          </select>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          title={
                            generatingInvoice
                              ? t("config.subscription.generating")
                              : t("config.subscription.generate")
                          }
                          icon={
                            generatingInvoice ? (
                              <CircleNotch
                                className="h-3.5 w-3.5 animate-spin"
                                weight="bold"
                              />
                            ) : (
                              <CurrencyDollar
                                className="h-3.5 w-3.5"
                                weight="bold"
                              />
                            )
                          }
                          iconVisible
                          iconSide="left"
                          disabled={generatingInvoice || !selectedPlanId}
                          onClick={async () => {
                            setGeneratingInvoice(true);
                            const result =
                              await adminCreateSubscriptionInvoiceAction(
                                workspaceId,
                                {
                                  planId: selectedPlanId,
                                  billingType:
                                    selectedBillingType as BillingType,
                                },
                              );
                            setGeneratingInvoice(false);
                            if (result.error) {
                              toast({
                                title: result.error,
                                variant: "destructive",
                              });
                              return;
                            }
                            toast({
                              title: t("config.subscription.generateSuccess"),
                            });
                            loadData();
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Info Card */}
              <div
                className="rounded-[--radius] border border-border bg-card p-5 space-y-4"
                style={{ boxShadow: softSurfaceShadow }}
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Buildings className="h-4 w-4 text-primary-ink" weight="fill" />
                  {t("overview.info")}
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-2xs text-muted-foreground font-medium">
                      {t("overview.name")}
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {workspace.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xs text-muted-foreground font-medium">
                      ID
                    </p>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {workspace.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xs text-muted-foreground font-medium">
                      {t("overview.type")}
                    </p>
                    <p className="text-sm text-foreground">
                      {workspace.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-2xs font-semibold text-warning-foreground">
                          <Star className="h-3 w-3" weight="fill" />
                          {t("badge.default")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-semibold text-muted-foreground">
                          {t("badge.custom")}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <p className="text-2xs text-muted-foreground font-medium">
                        {t("overview.createdAt")}
                      </p>
                      <p className="text-sm text-foreground">
                        {formatDateTime(workspace.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-2xs text-muted-foreground font-medium">
                        {t("overview.updatedAt")}
                      </p>
                      <p className="text-sm text-foreground">
                        {formatDateTime(workspace.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner Card */}
              <div
                className="rounded-[--radius] border border-border bg-card p-5 space-y-4"
                style={{ boxShadow: softSurfaceShadow }}
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Crown className="h-4 w-4 text-warning-ink" weight="fill" />
                  {t("overview.owner")}
                </h3>
                <div className="flex items-center gap-3">
                  <IconBox color="amber" size="md">
                    <Crown weight="fill" />
                  </IconBox>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {owner?.username || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {owner?.email || workspace.ownerId}
                    </p>
                  </div>
                </div>
                {owner && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {t("overview.role")}
                      </span>
                      <span className="text-muted-foreground capitalize">
                        {owner.role}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {t("overview.customerType")}
                      </span>
                      <span className="text-muted-foreground capitalize">
                        {owner.customerType}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {t("overview.emailVerified")}
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          owner.emailVerified
                            ? "text-healthy-ink"
                            : "text-destructive-ink",
                        )}
                      >
                        {owner.emailVerified
                          ? t("overview.yes")
                          : t("overview.no")}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Members Summary Card */}
              <div
                className="rounded-[--radius] border border-border bg-card p-5 space-y-4"
                style={{ boxShadow: softSurfaceShadow }}
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary-ink" weight="fill" />
                  {t("overview.membersSummary")}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-warning-ink" weight="fill" />
                      <span className="text-sm text-foreground">
                        {t("roles.owner")}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {ownerMember ? 1 : 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary-ink" weight="fill" />
                      <span className="text-sm text-foreground">
                        {t("roles.admin")}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {adminMembers.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users
                        className="h-4 w-4 text-muted-foreground"
                        weight="fill"
                      />
                      <span className="text-sm text-foreground">
                        {t("roles.employee")}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {employeeMembers.length}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {t("overview.total")}
                    </span>
                    <span className="text-sm font-semibold text-primary-ink">
                      {members.length}
                    </span>
                  </div>
                </div>
                {pendingInvites.length > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Envelope
                      className="h-4 w-4 text-warning-ink"
                      weight="fill"
                    />
                    <span className="text-xs text-warning-ink font-medium">
                      {pendingInvites.length} {t("overview.pendingInvites")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Members Tab ── */}
          <TabsContent value="members">
            <DashboardTable<WorkspaceMember>
              data={members}
              columns={memberColumns}
              rowKey={(row) => row.id}
              stats={[
                {
                  label: t("overview.total"),
                  value: String(members.length),
                  icon: (
                    <Users className="h-4 w-4 text-primary-ink" weight="fill" />
                  ),
                },
                {
                  label: t("roles.owner"),
                  value: String(ownerMember ? 1 : 0),
                  icon: (
                    <Crown className="h-4 w-4 text-warning-ink" weight="fill" />
                  ),
                },
                {
                  label: t("roles.admin"),
                  value: String(adminMembers.length),
                  icon: (
                    <Shield className="h-4 w-4 text-primary-ink" weight="fill" />
                  ),
                },
                {
                  label: t("roles.employee"),
                  value: String(employeeMembers.length),
                  icon: (
                    <Users
                      className="h-4 w-4 text-muted-foreground"
                      weight="fill"
                    />
                  ),
                },
              ]}
              emptyState={{
                icon: (
                  <Users
                    className="h-7 w-7 text-muted-foreground"
                    weight="fill"
                  />
                ),
                title: t("members.empty"),
              }}
            />
          </TabsContent>

          {/* ── Invites Tab ── */}
          <TabsContent value="invites">
            <DashboardTable<WorkspaceInvite>
              data={invites}
              columns={inviteColumns}
              rowKey={(row) => row.id}
              stats={[
                {
                  label: t("overview.total"),
                  value: String(invites.length),
                  icon: (
                    <Envelope className="h-4 w-4 text-primary-ink" weight="fill" />
                  ),
                },
                {
                  label: t("overview.pendingInvites"),
                  value: String(pendingInvites.length),
                  icon: (
                    <Envelope
                      className="h-4 w-4 text-warning-ink"
                      weight="fill"
                    />
                  ),
                },
              ]}
              emptyState={{
                icon: (
                  <Envelope
                    className="h-7 w-7 text-muted-foreground"
                    weight="fill"
                  />
                ),
                title: t("invites.empty"),
              }}
            />
          </TabsContent>

          {/* ── Pricing Tab ── */}
          <TabsContent value="pricing">
            {resolvedPricing.some((p) => p.category === "exchange_rate") && (
              <div className="flex items-start gap-3 rounded-[--radius] border border-warning/30 bg-warning/60 px-4 py-3 mb-4">
                <Info
                  className="h-4 w-4 text-warning-ink mt-0.5 flex-shrink-0"
                  weight="fill"
                />
                <p className="text-xs text-warning-ink">
                  {t("overview.exchangeRateWarning")}
                </p>
              </div>
            )}
            <DashboardTable<ResolvedPricingItem>
              data={resolvedPricing}
              columns={pricingColumns}
              rowKey={(row) => `${row.category}|${row.service}|${row.metric}`}
              stats={[
                {
                  label: t("overview.total"),
                  value: String(resolvedPricing.length),
                  icon: (
                    <CurrencyDollar
                      className="h-4 w-4 text-primary-ink"
                      weight="fill"
                    />
                  ),
                },
                {
                  label: t("overview.overrides"),
                  value: String(overrideCount),
                  icon: (
                    <PencilSimple
                      className="h-4 w-4 text-warning-ink"
                      weight="bold"
                    />
                  ),
                },
              ]}
              rowClassName={(row) => (row.isOverride ? "bg-warning/50" : "")}
              emptyState={{
                icon: (
                  <CurrencyDollar
                    className="h-7 w-7 text-muted-foreground"
                    weight="fill"
                  />
                ),
                title: t("overview.noPricing"),
              }}
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.main>
  );
}
