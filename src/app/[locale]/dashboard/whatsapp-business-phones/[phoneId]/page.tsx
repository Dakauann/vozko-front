"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { motion, type Variants } from "framer-motion";
import {
  Phone,
  ArrowLeft,
  ArrowClockwise,
  Trash,
  CheckCircle,
  XCircle,
  Clock,
  Warning,
  Buildings,
  EnvelopeSimple,
  Globe,
  MapPin,
  Info,
  PencilSimple,
  CircleNotch,
  UserCircle,
  Lightning,
  ShieldCheck,
  SignOut,
  LinkBreak,
  DotsThreeVertical,
  WhatsappLogo,
  SealCheck,
} from "@phosphor-icons/react";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import Button from "@/components/elevated-design/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  getBusinessPhoneByIdAction,
  getBusinessPhoneByIdAdminAction,
  syncBusinessPhoneAction,
  deregisterBusinessPhoneAction,
  unassignPhoneOwnerAction,
  getBusinessProfileAction,
  getBusinessProfileAdminAction,
  getWhatsappCallingStatusAction,
  setWhatsappCallingStatusAction,
} from "@/app/actions/whatsapp-business-phones";
import { Switch } from "@/components/ui/switch";
import {
  listPhoneAccessAction,
  getMyPhoneAccessAction,
} from "@/app/actions/whatsapp-phone-access";
import { getWorkspaceAction } from "@/app/actions/workspace";
import type {
  WhatsAppBusinessPhone,
  BusinessPhoneStatus,
  QualityRating,
  NameStatus,
  BusinessProfile,
  PhoneAccess,
} from "@/lib/whatsapp-business-phones/types";
import type { Workspace } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import { EditProfileDialog } from "@/app/[locale]/dashboard/whatsapp-business-phones/_components/EditProfileDialog";
import { VerificationDialog } from "@/app/[locale]/dashboard/whatsapp-business-phones/_components/VerificationDialog";
import { RegisterPhoneDialog } from "@/app/[locale]/dashboard/whatsapp-business-phones/_components/RegisterPhoneDialog";
import { ReleasePhoneDialog } from "@/app/[locale]/dashboard/whatsapp-business-phones/_components/ReleasePhoneDialog";
import { ConfirmActionDialog } from "@/app/[locale]/dashboard/whatsapp-business-phones/_components/ConfirmActionDialog";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
  },
};

/** Quiet, tinted status treatment (not bright solid fills), on brand. */
function statusTone(status: BusinessPhoneStatus): string {
  switch (status) {
    case "CONNECTED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    case "PENDING":
    case "VERIFYING":
    case "RATE_LIMITED":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    case "DISCONNECTED":
    case "BANNED":
    case "FLAGGED":
    case "RESTRICTED":
    case "UNVERIFIED":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function qualityTone(quality: QualityRating): string {
  switch (quality) {
    case "GREEN":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    case "YELLOW":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    case "RED":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function statusIcon(status: BusinessPhoneStatus) {
  switch (status) {
    case "CONNECTED":
      return <CheckCircle className="h-3.5 w-3.5" weight="fill" />;
    case "PENDING":
    case "VERIFYING":
    case "RATE_LIMITED":
      return <Clock className="h-3.5 w-3.5" weight="fill" />;
    case "DELETED":
      return <Trash className="h-3.5 w-3.5" weight="fill" />;
    case "DISCONNECTED":
    case "BANNED":
    case "FLAGGED":
      return <XCircle className="h-3.5 w-3.5" weight="fill" />;
    default:
      return <Warning className="h-3.5 w-3.5" weight="fill" />;
  }
}

export default function BusinessPhoneDetailPage() {
  const t = useTranslations("whatsappBusinessPhones");
  const commonT = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const { can } = useWorkspace();
  const canManage = can("business_phones", "update");
  const isSystemAdmin = user?.role === "admin";

  const tRef = useRef(t);
  const toastRef = useRef(toast);
  const routerRef = useRef(router);
  tRef.current = t;
  toastRef.current = toast;
  routerRef.current = router;

  const phoneId = params.phoneId as string;

  const [phone, setPhone] = useState<WhatsAppBusinessPhone | null>(null);
  const [businessProfile, setBusinessProfile] =
    useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [callingEnabled, setCallingEnabled] = useState(false);
  const [callingLoading, setCallingLoading] = useState(false);
  const [callingSaving, setCallingSaving] = useState(false);
  const [showEditProfileDialog, setShowEditProfileDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showUnassignDialog, setShowUnassignDialog] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  const [accessItems, setAccessItems] = useState<PhoneAccess[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessPage, setAccessPage] = useState(1);
  const [accessMeta, setAccessMeta] = useState({
    page: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });
  const [accessWorkspaces, setAccessWorkspaces] = useState<
    Record<string, Workspace>
  >({});
  const accessWorkspacesRef = useRef<Record<string, Workspace>>({});

  const [myAccess, setMyAccess] = useState<PhoneAccess | null>(null);

  const isSystemAdminRef = useRef(isSystemAdmin);
  isSystemAdminRef.current = isSystemAdmin;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchFn = isSystemAdminRef.current
        ? getBusinessPhoneByIdAdminAction
        : getBusinessPhoneByIdAction;
      const phoneResult = await fetchFn(phoneId);
      if (!phoneResult.error && phoneResult.phone) {
        setPhone(phoneResult.phone);

        if (phoneResult.phone.status === "CONNECTED") {
          const profileFn = isSystemAdminRef.current
            ? getBusinessProfileAdminAction
            : getBusinessProfileAction;
          const profileResult = await profileFn(phoneId);
          if (!profileResult.error && profileResult.data) {
            setBusinessProfile(profileResult.data);
          }

          setCallingLoading(true);
          const callingResult = await getWhatsappCallingStatusAction(phoneId);
          if (!callingResult.error) {
            setCallingEnabled(callingResult.enabled);
          }
          setCallingLoading(false);
        }
      } else {
        toastRef.current({
          title: tRef.current("toast.errorFetchingPhone"),
          description: phoneResult.error || tRef.current("toast.unknownError"),
          variant: "destructive",
        });
        routerRef.current.push(`/${locale}/dashboard/whatsapp-business-phones`);
      }
    } catch {
      toastRef.current({
        title: tRef.current("toast.errorFetchingPhone"),
        description: tRef.current("toast.unknownError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [phoneId, locale]);

  const handleToggleCalling = useCallback(
    async (next: boolean) => {
      setCallingSaving(true);
      const result = await setWhatsappCallingStatusAction(phoneId, next);
      if (result.error) {
        toastRef.current({
          title: "WhatsApp Calling",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setCallingEnabled(result.enabled);
      }
      setCallingSaving(false);
    },
    [phoneId],
  );

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [fetchData, authLoading, isSystemAdmin]);

  useEffect(() => {
    accessWorkspacesRef.current = accessWorkspaces;
  }, [accessWorkspaces]);

  const hydrateAccessWorkspaces = useCallback(
    async (items: PhoneAccess[]): Promise<Record<string, Workspace>> => {
      const currentWorkspaces = accessWorkspacesRef.current;
      const missingWorkspaceIds = items
        .map((item) => item.workspaceId)
        .filter((wsId) => !currentWorkspaces[wsId]);

      if (missingWorkspaceIds.length === 0) return currentWorkspaces;

      const results = await Promise.all(
        missingWorkspaceIds.map((wsId) => getWorkspaceAction(wsId)),
      );

      const newWorkspaces = { ...currentWorkspaces };
      results.forEach((result, index) => {
        if (result.workspace) {
          newWorkspaces[missingWorkspaceIds[index]] = result.workspace;
        }
      });

      accessWorkspacesRef.current = newWorkspaces;
      setAccessWorkspaces(newWorkspaces);
      return newWorkspaces;
    },
    [],
  );

  const fetchPhoneAccess = useCallback(async () => {
    if (!isSystemAdmin) return;
    setAccessLoading(true);
    try {
      const result = await listPhoneAccessAction(phoneId, {
        page: accessPage,
        pageSize: accessMeta.pageSize,
      });
      if (!result.error) {
        setAccessItems(result.items);
        setAccessMeta(result.meta);
        await hydrateAccessWorkspaces(result.items);
      }
    } catch {
      // Silently fail
    } finally {
      setAccessLoading(false);
    }
  }, [phoneId, isSystemAdmin, accessPage, accessMeta.pageSize, hydrateAccessWorkspaces]);

  useEffect(() => {
    if (isSystemAdmin && phone) {
      fetchPhoneAccess();
    }
  }, [isSystemAdmin, phone, fetchPhoneAccess]);

  useEffect(() => {
    if (isSystemAdmin || !phone) return;

    const fetchMyAccess = async () => {
      try {
        const result = await getMyPhoneAccessAction(phoneId);
        if (!result.error && result.access) {
          setMyAccess(result.access);
        }
      } catch {
        // Silently fail
      }
    };

    fetchMyAccess();
  }, [phoneId, isSystemAdmin, phone]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncBusinessPhoneAction(phoneId);
      if (!result.error) {
        toast({
          title: t("toast.phoneSynced"),
          description: t("toast.phoneSyncedDesc"),
        });
        await fetchData();
      } else {
        toast({
          title: t("toast.syncFailed"),
          description: result.error || t("toast.unknownError"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("toast.syncFailed"),
        description: t("toast.unknownError"),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await deregisterBusinessPhoneAction(phoneId);
      if (!result.error) {
        toast({
          title: t("disconnect.successTitle"),
          description: t("disconnect.successDesc"),
        });
        setShowDisconnectDialog(false);
        await fetchData();
      } else {
        toast({
          title: t("disconnect.errorTitle"),
          description: result.error || t("toast.unknownError"),
          variant: "destructive",
        });
      }
    } finally {
      setDisconnecting(false);
    }
  };

  const handleUnassign = async () => {
    setUnassigning(true);
    try {
      const result = await unassignPhoneOwnerAction(phoneId);
      if (!result.error) {
        toast({
          title: t("unassign.successTitle"),
          description: t("unassign.successDesc"),
        });
        setShowUnassignDialog(false);
        await fetchData();
      } else {
        toast({
          title: t("unassign.errorTitle"),
          description: result.error || t("toast.unknownError"),
          variant: "destructive",
        });
      }
    } finally {
      setUnassigning(false);
    }
  };

  const getNameStatusColor = (status: NameStatus) => {
    switch (status) {
      case "APPROVED":
        return "text-emerald-600 dark:text-emerald-400";
      case "PENDING_REVIEW":
        return "text-amber-600 dark:text-amber-400";
      case "DECLINED":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  // Maps a raw name status to a known translation key, falling back to UNKNOWN so an
  // empty/unsynced value never leaks the raw i18n key (e.g. "nameStatus.") to the UI.
  const NAME_STATUS_KEYS = new Set([
    "APPROVED",
    "AVAILABLE_WITHOUT_REVIEW",
    "DECLINED",
    "EXPIRED",
    "PENDING_REVIEW",
    "NONE",
  ]);
  const nameStatusKey = (status?: string | null) =>
    status && NAME_STATUS_KEYS.has(status) ? status : "UNKNOWN";

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-9 w-1/3 rounded-lg bg-muted" />
          <div className="h-44 rounded-2xl bg-muted" />
          <div className="h-32 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!phone) {
    return null;
  }

  const isConnected = phone.status === "CONNECTED";
  const isVerified = phone.codeVerificationStatus === "VERIFIED";
  // 360dialog channels have no Meta-style "deregister but keep the number" pause; their
  // only reversible option is cancelling the channel, which "Remove" and "Return to
  // pool" already do. So Disconnect is hidden for them (it would just 401 on Meta).
  const isDialog360 = phone.provider === "dialog360";
  const phoneNumber = phone.displayPhoneNumber;
  const phoneLabel = phone.verifiedName || phone.displayPhoneNumber;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <motion.div
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Back link */}
        <motion.div variants={itemVariants}>
          <button
            type="button"
            onClick={() =>
              router.push(`/${locale}/dashboard/whatsapp-business-phones`)
            }
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" weight="bold" />
            {t("detail.backToList")}
          </button>
        </motion.div>

        {/* Identity + actions header */}
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <WhatsappLogo className="h-6 w-6" weight="fill" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold text-foreground">
                      {phoneLabel}
                    </h1>
                    {phone.isOfficialBusiness && (
                      <SealCheck
                        className="h-5 w-5 text-primary"
                        weight="fill"
                      />
                    )}
                  </div>
                  <p className="font-mono text-sm text-muted-foreground">
                    {phoneNumber}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        statusTone(phone.status),
                      )}
                    >
                      {statusIcon(phone.status)}
                      {t(`status.${phone.status}`)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        qualityTone(phone.qualityRating),
                      )}
                    >
                      {t("detail.qualityRating")}:{" "}
                      {t(`qualityRating.${phone.qualityRating || "UNKNOWN"}`)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status-driven primary action + overflow */}
              {canManage && (
                <div className="flex shrink-0 items-center gap-2">
                  {!isVerified && (
                    <Button
                      variant="primary"
                      size="sm"
                      title={t("button.requestVerification")}
                      icon={<ShieldCheck className="h-4 w-4" />}
                      iconVisible
                      iconSide="left"
                      onClick={() => setShowVerificationDialog(true)}
                    />
                  )}
                  {isSystemAdmin && isVerified && !isConnected && (
                    <Button
                      variant="primary"
                      size="sm"
                      title={t("cloudRegistration.registerButton")}
                      icon={<Lightning className="h-4 w-4" />}
                      iconVisible
                      iconSide="left"
                      onClick={() => setShowRegisterDialog(true)}
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    title={t("button.sync")}
                    icon={
                      <ArrowClockwise
                        className={cn("h-4 w-4", syncing && "animate-spin")}
                      />
                    }
                    iconVisible
                    iconSide="left"
                    onClick={handleSync}
                    disabled={syncing}
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("detail.moreActions")}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <DotsThreeVertical className="h-5 w-5" weight="bold" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      {isConnected && !isDialog360 && (
                        <DropdownMenuItem
                          onClick={() => setShowDisconnectDialog(true)}
                        >
                          <SignOut className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{t("button.disconnect")}</span>
                            <span className="text-xs text-muted-foreground">
                              {t("disconnect.menuHint")}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      )}
                      {isSystemAdmin && phone.ownerWorkspaceId && (
                        <DropdownMenuItem
                          onClick={() => setShowUnassignDialog(true)}
                        >
                          <LinkBreak className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{t("button.unassign")}</span>
                            <span className="text-xs text-muted-foreground">
                              {t(
                                isDialog360
                                  ? "unassign.menuHintDialog360"
                                  : "unassign.menuHint",
                              )}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      )}
                      {((isConnected && !isDialog360) ||
                        (isSystemAdmin && phone.ownerWorkspaceId)) && (
                        <DropdownMenuSeparator />
                      )}
                      <DropdownMenuItem
                        onClick={() => setShowReleaseDialog(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{t("button.remove")}</span>
                          <span className="text-xs text-muted-foreground">
                            {t("release.menuHint")}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </ElevatedContainer>
        </motion.div>

        {/* Details grid */}
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="p-6">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {/* Status details */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("detail.statusDetails")}
                </h3>
                <dl className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border py-2">
                    <dt className="text-sm text-muted-foreground">
                      {t("detail.nameStatus")}
                    </dt>
                    <dd
                      className={cn(
                        "text-sm font-medium",
                        getNameStatusColor(phone.nameStatus),
                      )}
                    >
                      {t(`nameStatus.${nameStatusKey(phone.nameStatus)}`)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-border py-2">
                    <dt className="text-sm text-muted-foreground">
                      {t("detail.codeVerification")}
                    </dt>
                    <dd className="text-sm font-medium">
                      {isVerified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="h-4 w-4" weight="fill" />
                          {t("detail.verified")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Warning className="h-4 w-4" weight="fill" />
                          {t("detail.notVerified")}
                        </span>
                      )}
                    </dd>
                  </div>
                  {phone.messagingLimitTier && (
                    <div className="flex items-center justify-between border-b border-border py-2">
                      <dt className="text-sm text-muted-foreground">
                        {t("detail.messagingLimit")}
                      </dt>
                      <dd className="text-sm font-medium text-foreground">
                        {phone.messagingLimitTier}
                      </dd>
                    </div>
                  )}
                  {phone.platformType && (
                    <div className="flex items-center justify-between py-2">
                      <dt className="text-sm text-muted-foreground">
                        {t("detail.platformType")}
                      </dt>
                      <dd className="text-sm font-medium text-foreground">
                        {phone.platformType}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Identifiers */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("detail.identifiers")}
                </h3>
                <dl className="space-y-3">
                  {phone.metaPhoneNumberId && (
                    <div className="border-b border-border py-2">
                      <dt className="mb-1 text-xs text-muted-foreground">
                        {t("detail.phoneNumberId")}
                      </dt>
                      <dd className="font-mono text-sm text-foreground">
                        {phone.metaPhoneNumberId}
                      </dd>
                    </div>
                  )}
                  <div className="border-b border-border py-2">
                    <dt className="mb-1 text-xs text-muted-foreground">
                      {t("detail.wabaId")}
                    </dt>
                    <dd className="font-mono text-sm text-foreground">
                      {phone.wabaId}
                    </dd>
                  </div>
                  <div className="border-b border-border py-2">
                    <dt className="mb-1 text-xs text-muted-foreground">
                      {t("detail.createdAt")}
                    </dt>
                    <dd className="text-sm text-foreground">
                      {new Date(phone.createdAt).toLocaleString(locale)}
                    </dd>
                  </div>
                  <div className="py-2">
                    <dt className="mb-1 text-xs text-muted-foreground">
                      {t("detail.lastSyncedAt")}
                    </dt>
                    <dd className="text-sm text-foreground">
                      {phone.lastSyncedAt
                        ? new Date(phone.lastSyncedAt).toLocaleString(locale)
                        : t("detail.neverSynced")}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </ElevatedContainer>
        </motion.div>

        {/* Business profile */}
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Buildings className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-base font-semibold text-foreground">
                  {t("profile.title")}
                </h3>
              </div>
              {canManage && isConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  title={t("button.editProfile")}
                  icon={<PencilSimple className="h-4 w-4" />}
                  iconVisible
                  iconSide="left"
                  onClick={() => setShowEditProfileDialog(true)}
                />
              )}
            </div>

            {businessProfile ? (
              <div className="space-y-4">
                {businessProfile.about && (
                  <div>
                    <span className="mb-1 block text-xs text-muted-foreground">
                      {t("profile.about")}
                    </span>
                    <p className="text-sm text-foreground">
                      {businessProfile.about}
                    </p>
                  </div>
                )}
                {businessProfile.description && (
                  <div>
                    <span className="mb-1 block text-xs text-muted-foreground">
                      {t("profile.description")}
                    </span>
                    <p className="text-sm text-foreground">
                      {businessProfile.description}
                    </p>
                  </div>
                )}
                {businessProfile.email && (
                  <div className="flex items-center gap-2">
                    <EnvelopeSimple className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {businessProfile.email}
                    </span>
                  </div>
                )}
                {businessProfile.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {businessProfile.address}
                    </span>
                  </div>
                )}
                {businessProfile.websites &&
                  businessProfile.websites.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Globe className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col gap-1">
                        {businessProfile.websites.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Buildings className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {!isConnected
                    ? t("profile.connectFirst")
                    : t("profile.noProfile")}
                </p>
              </div>
            )}
          </ElevatedContainer>
        </motion.div>

        {/* WhatsApp calling toggle */}
        {isConnected && (
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Phone className="h-5 w-5" weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {t("calling.title")}
                    </h3>
                    <p className="mt-0.5 max-w-md text-sm text-muted-foreground">
                      {t("calling.description")}
                    </p>
                  </div>
                </div>
                {callingLoading ? (
                  <CircleNotch className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    checked={callingEnabled}
                    disabled={callingSaving}
                    onCheckedChange={handleToggleCalling}
                  />
                )}
              </div>
            </ElevatedContainer>
          </motion.div>
        )}

        {/* Access granted-by (non-admin) */}
        {!isSystemAdmin && myAccess?.grantor && (
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserCircle className="h-5 w-5" weight="fill" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("access.grantedByLabel")}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {myAccess.grantor.name || myAccess.grantor.email}
                  </p>
                  {myAccess.createdAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(myAccess.createdAt).toLocaleDateString(locale)}
                    </p>
                  )}
                </div>
              </div>
            </ElevatedContainer>
          </motion.div>
        )}

        {/* Workspace access (system admin, deprecated/read-only) */}
        {isSystemAdmin && (
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Buildings className="h-5 w-5" weight="fill" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {t("access.title")}
                      </h3>
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                        {t("access.deprecated")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("access.deprecatedDescription")}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                  {t("access.count", { count: accessMeta.totalItems })}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {t("access.grantedWorkspaces")}
                  </p>
                  {accessMeta.totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t("access.previous")}
                        onClick={() =>
                          setAccessPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={accessPage <= 1}
                      />
                      <span className="px-2 text-xs tabular-nums text-muted-foreground">
                        {accessPage} / {accessMeta.totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t("access.next")}
                        onClick={() =>
                          setAccessPage((prev) =>
                            Math.min(accessMeta.totalPages, prev + 1),
                          )
                        }
                        disabled={accessPage >= accessMeta.totalPages}
                      />
                    </div>
                  )}
                </div>

                {accessLoading ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
                    <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                    {t("access.loading")}
                  </div>
                ) : accessItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                    <Buildings className="h-8 w-8 text-muted-foreground/40" weight="fill" />
                    <p className="text-sm text-muted-foreground">
                      {t("access.noWorkspaces")}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                    {accessItems.map((item) => {
                      const workspace = accessWorkspaces[item.workspaceId];
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <Buildings className="h-4 w-4" weight="fill" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {workspace?.name ??
                                    item.workspace?.name ??
                                    commonT("loading")}
                                </p>
                                {workspace?.isDefault && (
                                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {workspace?.ownerId && (
                                  <>
                                    {t("access.owner")}:{" "}
                                    {workspace.ownerName ??
                                      workspace.ownerEmail ??
                                      workspace.ownerId.slice(0, 8) + "..."}{" "}
                                    ·{" "}
                                  </>
                                )}
                                {t("access.grantedAt")}:{" "}
                                {new Date(item.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ElevatedContainer>
          </motion.div>
        )}
      </motion.div>

      {/* Dialogs */}
      <EditProfileDialog
        open={showEditProfileDialog}
        onOpenChange={setShowEditProfileDialog}
        phoneId={phoneId}
        currentProfile={businessProfile}
        onSuccess={fetchData}
      />

      <ReleasePhoneDialog
        open={showReleaseDialog}
        onOpenChange={setShowReleaseDialog}
        phoneId={phoneId}
        phoneNumber={phoneNumber}
        wabaId={phone.wabaId}
        phoneName={phoneLabel}
        onSuccess={() =>
          router.push(`/${locale}/dashboard/whatsapp-business-phones`)
        }
      />

      <ConfirmActionDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
        title={t("disconnect.title")}
        description={t("disconnect.description", { name: phoneLabel })}
        confirmLabel={t("button.disconnect")}
        cancelLabel={t("button.cancel")}
        loadingLabel={t("disconnect.loading")}
        loading={disconnecting}
        tone="warning"
        icon={<SignOut className="h-4 w-4" weight="bold" />}
        onConfirm={handleDisconnect}
      >
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("disconnect.note")}
          </p>
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={showUnassignDialog}
        onOpenChange={setShowUnassignDialog}
        title={t("unassign.title")}
        description={t("unassign.description", { name: phoneLabel })}
        confirmLabel={t("button.unassign")}
        cancelLabel={t("button.cancel")}
        loadingLabel={t("unassign.loading")}
        loading={unassigning}
        tone="warning"
        icon={<LinkBreak className="h-4 w-4" weight="bold" />}
        onConfirm={handleUnassign}
      >
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(isDialog360 ? "unassign.noteDialog360" : "unassign.note")}
          </p>
        </div>
      </ConfirmActionDialog>

      {canManage && (
        <>
          <VerificationDialog
            open={showVerificationDialog}
            onOpenChange={setShowVerificationDialog}
            phoneId={phoneId}
            phoneNumber={phone.displayPhoneNumber}
            onSuccess={fetchData}
          />

          <RegisterPhoneDialog
            open={showRegisterDialog}
            onOpenChange={setShowRegisterDialog}
            phoneId={phoneId}
            phoneNumber={phone.displayPhoneNumber}
            onSuccess={fetchData}
          />
        </>
      )}
    </div>
  );
}
