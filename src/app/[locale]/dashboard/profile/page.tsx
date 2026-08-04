"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  CheckCircle,
  CircleNotch,
  Desktop,
  DeviceMobile,
  Eye,
  EyeSlash,
  Globe,
  Lock,
  MapPin,
  PaperPlaneTilt,
  ShieldCheck,
  SignOut,
  Trash,
  User,
  UserCircle,
  X,
} from "@/components/icons";
import type { UserPlan, User as UserType } from "@/lib/auth/types";
import {
  getCurrentUserAction,
  getUserMeAction,
  listSessionsAction,
  revokeSessionAction,
  updateUserDocumentAction,
  updateUserPictureAction,
} from "@/app/actions/auth";
import { forgotPassword, resetPassword } from "@/lib/auth/auth-api";
import { useEffect, useRef, useState } from "react";

import type { ActiveSession } from "@/app/actions/auth";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { IconBox } from "@/components/elevated-design/listing-card";
import Image from "next/image";
import { uploadMediaAction } from "@/app/actions/medias";
import { useTranslations } from "next-intl";

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
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

const isRateLimitError = (message?: string | null) =>
  message?.toLowerCase().includes("rate limit") ?? false;

type PasswordResetStep = "idle" | "sending" | "code" | "resetting" | "success";

export default function ProfilePage() {
  const t = useTranslations("profilePage");
  const tCommon = useTranslations("common");

  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [picture, setPicture] = useState<string | undefined>(undefined);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [passwordResetStep, setPasswordResetStep] =
    useState<PasswordResetStep>("idle");
  const [passwordResetError, setPasswordResetError] = useState<string | null>(
    null,
  );
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null,
  );

  const [documentInput, setDocumentInput] = useState("");
  const [savingDocument, setSavingDocument] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentSaved, setDocumentSaved] = useState(false);

  const handleSaveDocument = async () => {
    const value = documentInput.trim();
    if (!value) return;
    setSavingDocument(true);
    setDocumentError(null);
    setDocumentSaved(false);
    try {
      const result = await updateUserDocumentAction(value);
      if (result.error) {
        if (result.errorCode === "invalid_document") {
          setDocumentError(t("document.invalid"));
        } else if (result.errorCode === "document_already_set") {
          setDocumentError(t("document.alreadySet"));
        } else {
          setDocumentError(result.error);
        }
        return;
      }
      if (result.user) {
        setUser(result.user);
      }
      setDocumentInput("");
      setDocumentSaved(true);
    } catch {
      setDocumentError(t("document.saveError"));
    } finally {
      setSavingDocument(false);
    }
  };

  useEffect(() => {
    async function fetchUser() {
      setLoading(true);
      try {
        const [userResult, meResult] = await Promise.all([
          getCurrentUserAction(),
          getUserMeAction(),
        ]);
        setUser(userResult.user);
        if (meResult.plan) {
          setPlan(meResult.plan);
        }
        if (meResult.picture) {
          setPicture(meResult.picture);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
    fetchSessions();
  }, []);

  async function fetchSessions() {
    setSessionsLoading(true);
    try {
      const result = await listSessionsAction();
      if (result.sessions) {
        setSessions(result.sessions);
      }
    } catch {
      // ignore
    } finally {
      setSessionsLoading(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    setRevokingSessionId(sessionId);
    try {
      const result = await revokeSessionAction(sessionId);
      if (result.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch {
      // ignore
    } finally {
      setRevokingSessionId(null);
    }
  }

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;
    setPasswordResetStep("sending");
    setPasswordResetError(null);

    try {
      const result = await forgotPassword(user.email);
      if (result.error) {
        if (result.statusCode === 429 || isRateLimitError(result.error)) {
          setPasswordResetError(tCommon("rateLimit"));
        } else {
          setPasswordResetError(result.error);
        }
        setPasswordResetStep("idle");
      } else {
        setPasswordResetStep("code");
      }
    } catch {
      setPasswordResetError(tCommon("rateLimit"));
      setPasswordResetStep("idle");
    }
  };

  const handleResetPassword = async () => {
    if (!resetCode || !newPassword || !confirmPassword) {
      setPasswordResetError(t("security.fillAll"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordResetError(t("security.passwordMismatch"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordResetError(t("security.passwordMinLength"));
      return;
    }

    setPasswordResetStep("resetting");
    setPasswordResetError(null);

    try {
      const result = await resetPassword(user?.email || "", resetCode, newPassword);
      if (result.error) {
        if (result.statusCode === 429 || isRateLimitError(result.error)) {
          setPasswordResetError(tCommon("rateLimit"));
        } else {
          setPasswordResetError(result.error);
        }
        setPasswordResetStep("code");
      } else {
        setPasswordResetStep("success");
        setResetCode("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordResetError(t("security.resetError"));
      setPasswordResetStep("code");
    }
  };

  const handleCancelPasswordReset = () => {
    setPasswordResetStep("idle");
    setPasswordResetError(null);
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; 

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      return;
    }

    setUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append("media", file);
      formData.append("mediaType", "image");
      formData.append("description", "issue-response-attachment");

      const result = await uploadMediaAction(formData);
      if (result.error || !result.mediaUrl) {
        // setSubmitError(t("response.error.imageUploadFailed"));
        // setImagePreview(null);
        // setImageUrl(null);
      } else {

        const updateResult = await updateUserPictureAction(result.mediaUrl);
        if (updateResult.success) {
          setPicture(result.mediaUrl);
        }
      }
    } catch {
      // ignore
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const result = await updateUserPictureAction("");
      if (result.success) {
        setPicture(undefined);
      }
    } catch {
      // ignore
    } finally {
      setUploadingAvatar(false);
    }
  };

  function parseDeviceInfo(ua: string) {
    if (!ua)
      return {
        browser: t("sessions.unknown"),
        os: t("sessions.unknown"),
        isMobile: false,
      };
    const isMobile = /mobile|android|iphone|ipad/i.test(ua);

    let browser = t("sessions.browser");
    if (/edg\//i.test(ua)) browser = "Edge";
    else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
    else if (/chrome\//i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
    else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
    else if (/firefox\//i.test(ua)) browser = "Firefox";

    let os = t("sessions.unknown");
    if (/windows/i.test(ua)) os = "Windows";
    else if (/mac os/i.test(ua)) os = "macOS";
    else if (/linux/i.test(ua)) os = "Linux";
    else if (/android/i.test(ua)) os = "Android";
    else if (/iphone|ipad/i.test(ua)) os = "iOS";

    return { browser, os, isMobile };
  }

  function formatSessionDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<
      string,
      { label: string; color: string; bg: string }
    > = {
      admin: {
        label: t("roles.admin"),
        color: "text-muted-foreground dark:text-purple-400",
        bg: "bg-muted",
      },
      manager: {
        label: t("roles.manager"),
        color: "text-lamp-ink",
        bg: "bg-primary/15",
      },
      user: {
        label: t("roles.user"),
        color: "text-foreground",
        bg: "bg-muted",
      },
      customer: {
        label: t("roles.customer"),
        color: "text-healthy dark:text-healthy",
        bg: "bg-healthy/15",
      },
    };
    return (
      roleConfig[role] || {
        label: role,
        color: "text-foreground",
        bg: "bg-muted",
      }
    );
  };

  if (loading) {
    return (
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full space-y-6"
      >
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="flex items-center justify-center py-20 border border-border bg-card">
            <div className="flex flex-col items-center gap-4">
              <CircleNotch
                className="h-8 w-8 animate-spin text-lamp-ink"
                weight="bold"
              />
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            </div>
          </ElevatedContainer>
        </motion.div>
      </motion.main>
    );
  }

  const roleBadge = user?.role ? getRoleBadge(user.role) : null;

  const initials = (user?.name || user?.email || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-6"
    >
      {/* Page header */}
      <motion.div variants={itemVariants}>
        <DashboardPageHeader
          icon={<UserCircle className="h-5 w-5" weight="fill" />}
          badge={t("badge")}
          description={t("description")}
        />
      </motion.div>

      {/* Avatar & Profile section */}
      <motion.div variants={itemVariants}>
        <PanelSection
          title={t("avatar.title")}
          description={t("avatar.subtitle")}
        >

          <div className="flex items-center gap-6">
            {/* Avatar preview */}
            <div className="relative shrink-0">
              <div className="h-20 w-20 overflow-hidden rounded-[--radius] border border-border bg-muted">
                {picture ? (
                  <Image
                    src={picture}
                    alt={user?.name || "Avatar"}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="text-2xl font-semibold text-lamp-ink">
                      {initials}
                    </span>
                  </div>
                )}
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-[--radius] bg-background">
                  <CircleNotch
                    className="h-6 w-6 animate-spin text-lamp-ink"
                    weight="bold"
                  />
                </div>
              )}
            </div>

            {/* Upload controls */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <Button
                  variant="secondary"
                  title={t("avatar.upload")}
                  icon={<Camera className="h-4 w-4" weight="fill" />}
                  iconVisible
                  iconSide="left"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                />
                {picture && (
                  <Button
                    variant="ghost"
                    title={t("avatar.remove")}
                    icon={<Trash className="h-4 w-4" weight="fill" />}
                    iconVisible
                    iconSide="left"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("avatar.hint")}
              </p>
            </div>
          </div>
        </PanelSection>
      </motion.div>

      {/* Profile information */}
      <motion.div variants={itemVariants}>
        <PanelSection
          title={t("info.title")}
          description={t("info.subtitle")}
        >

          <div className="rounded-[--radius] border border-border bg-muted p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("info.name")}
              </span>
              <span className="text-sm font-medium text-foreground">
                {user?.name || "—"}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("info.email")}
              </span>
              <span className="text-sm font-medium text-foreground truncate ml-4 max-w-[260px]">
                {user?.email || "—"}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("info.role")}
              </span>
              {roleBadge ? (
                <span
                  className={`inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-semibold ${roleBadge.bg} ${roleBadge.color}`}
                >
                  {roleBadge.label}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">,</span>
              )}
            </div>
            {user?.emailVerified !== undefined && (
              <>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("info.emailStatus")}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-[--radius] px-2.5 py-0.5 text-xs font-semibold ${
                      user.emailVerified
                        ? "bg-healthy text-healthy-foreground"
                        : "bg-warning text-warning-foreground"
                    }`}
                  >
                    {user.emailVerified ? (
                      <CheckCircle className="h-3 w-3" weight="fill" />
                    ) : null}
                    {user.emailVerified
                      ? t("emailVerified")
                      : t("emailNotVerified")}
                  </span>
                </div>
              </>
            )}
            {user?.id && (
              <>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("info.userId")}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground truncate ml-4 max-w-[220px]">
                    {user.id}
                  </span>
                </div>
              </>
            )}
          </div>

          {plan && (
            <div className="well mt-4 bg-muted p-4">
              <div className="flex items-center justify-between">
                <span className="legend">
                  {t("info.plan")}
                </span>
                <span className="readout text-[13px] font-semibold text-foreground">
                  {plan.name}
                </span>
              </div>
            </div>
          )}
        </PanelSection>
      </motion.div>

      {/* Document (CPF/CNPJ), required for billing */}
      <motion.div variants={itemVariants}>
        <PanelSection
          title={t("document.title")}
          description={t("document.subtitle")}
        >

          {user?.hasDocument ? (
            <div className="rounded-[--radius] border border-border bg-muted p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("document.label")}
                </span>
                <span className="text-sm font-mono font-medium text-foreground">
                  {user.document || "•••"}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("document.lockedHint")}
              </p>
            </div>
          ) : (
            <div className="rounded-[--radius] border border-warning/30 bg-warning/5 p-4 space-y-3">
              <p className="text-sm text-foreground">
                {t("document.requiredHint")}
              </p>
              <ElevatedInput
                value={documentInput}
                onChange={(e) => setDocumentInput(e.target.value)}
                placeholder={t("document.placeholder")}
                disabled={savingDocument}
                inputMode="numeric"
              />
              {documentError && (
                <p className="text-xs text-red-500">{documentError}</p>
              )}
              {documentSaved && (
                <p className="text-xs text-healthy">
                  {t("document.saved")}
                </p>
              )}
              <Button
                variant="primary"
                size="sm"
                className="w-full rounded-[--radius]"
                disabled={!documentInput.trim() || savingDocument}
                onClick={handleSaveDocument}
              >
                {savingDocument ? t("document.saving") : t("document.save")}
              </Button>
            </div>
          )}
        </PanelSection>
      </motion.div>

      {/* Security */}
      <motion.div variants={itemVariants}>
        <PanelSection
          title={t("security.title")}
          description={t("security.subtitle")}
        >

          <div className="space-y-4">
            {/* Password reset card */}
            <div className="rounded-[--radius] border border-border bg-muted p-4">
              <AnimatePresence mode="wait">
                {passwordResetStep === "idle" && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-start gap-3">
                      <ShieldCheck
                        className="h-5 w-5 text-healthy mt-0.5"
                        weight="fill"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {t("security.changePassword")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("security.changePasswordDesc", {
                            email: user?.email || "",
                          })}
                        </p>
                        <div className="mt-3">
                          <Button
                            variant="secondary"
                            title={t("security.sendCode")}
                            icon={
                              <PaperPlaneTilt
                                className="h-4 w-4"
                                weight="fill"
                              />
                            }
                            iconVisible
                            iconSide="left"
                            onClick={handleSendPasswordReset}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {passwordResetStep === "sending" && (
                  <motion.div
                    key="sending"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center py-8"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <CircleNotch
                        className="h-8 w-8 animate-spin text-lamp-ink"
                        weight="bold"
                      />
                      <p className="text-sm text-muted-foreground">
                        {t("security.sendingCode")}
                      </p>
                    </div>
                  </motion.div>
                )}

                {passwordResetStep === "code" && (
                  <motion.div
                    key="code"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-start gap-3">
                        <Lock
                          className="h-5 w-5 text-lamp-ink mt-0.5"
                          weight="fill"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {t("security.resetTitle")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("security.codeSentTo", {
                              email: user?.email || "",
                            })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleCancelPasswordReset}
                        className="p-1 rounded-lg hover:bg-border transition-colors"
                      >
                        <X
                          className="h-4 w-4 text-muted-foreground"
                          weight="bold"
                        />
                      </button>
                    </div>

                    {passwordResetError && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                        <p className="text-sm text-destructive dark:text-red-400">
                          {passwordResetError}
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <ElevatedInput
                        type="text"
                        label={t("security.verificationCode")}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        icon={<ShieldCheck className="h-5 w-5" weight="fill" />}
                        maxLength={6}
                        inputMode="numeric"
                        controlSize="sm"
                      />

                      <div className="relative">
                        <ElevatedInput
                          type={showNewPassword ? "text" : "password"}
                          label={t("security.newPassword")}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          icon={<Lock className="h-5 w-5" weight="fill" />}
                          controlSize="sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPassword ? (
                            <EyeSlash className="h-4 w-4" weight="fill" />
                          ) : (
                            <Eye className="h-4 w-4" weight="fill" />
                          )}
                        </button>
                      </div>

                      <div className="relative">
                        <ElevatedInput
                          type={showConfirmPassword ? "text" : "password"}
                          label={t("security.confirmPassword")}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          icon={<Lock className="h-5 w-5" weight="fill" />}
                          controlSize="sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? (
                            <EyeSlash className="h-4 w-4" weight="fill" />
                          ) : (
                            <Eye className="h-4 w-4" weight="fill" />
                          )}
                        </button>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {t("security.passwordMinLengthHint")}
                      </p>

                      <div className="flex items-center gap-3">
                        <Button
                          variant="primary"
                          title={t("security.confirmNewPassword")}
                          icon={<Check className="h-4 w-4" weight="bold" />}
                          iconVisible
                          iconSide="left"
                          onClick={handleResetPassword}
                          disabled={
                            !resetCode || !newPassword || !confirmPassword
                          }
                        />
                        <Button
                          variant="ghost"
                          title={t("security.cancel")}
                          onClick={handleCancelPasswordReset}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSendPasswordReset}
                        className="text-xs text-lamp-ink hover:text-lamp-ink/80 font-medium transition-colors"
                      >
                        {t("security.resendCode")}
                      </button>
                    </div>
                  </motion.div>
                )}

                {passwordResetStep === "resetting" && (
                  <motion.div
                    key="resetting"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center py-8"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <CircleNotch
                        className="h-8 w-8 animate-spin text-lamp-ink"
                        weight="bold"
                      />
                      <p className="text-sm text-muted-foreground">
                        {t("security.changingPassword")}
                      </p>
                    </div>
                  </motion.div>
                )}

                {passwordResetStep === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="text-center py-6"
                  >
                    <div className="mx-auto w-14 h-14 mb-4 rounded-full bg-healthy/15 flex items-center justify-center">
                      <CheckCircle
                        weight="fill"
                        className="w-8 h-8 text-healthy"
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {t("security.passwordChanged")}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("security.passwordChangedDesc")}
                    </p>
                    <Button
                      variant="secondary"
                      title={t("security.done")}
                      icon={<Check className="h-4 w-4" weight="bold" />}
                      iconVisible
                      iconSide="left"
                      onClick={() => setPasswordResetStep("idle")}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 2FA placeholder */}
            <div className="rounded-[--radius] border border-border bg-muted p-4">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-lamp-ink mt-0.5" weight="fill" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {t("security.twoFactor")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("security.twoFactorDesc")}
                  </p>
                  <span className="inline-flex items-center mt-2 rounded-[--radius] bg-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {t("security.comingSoon")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </PanelSection>
      </motion.div>

      {/* Active Sessions */}
      <motion.div variants={itemVariants}>
        <ElevatedContainer className="border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <IconBox color="primary" size="sm">
                <Globe weight="fill" />
              </IconBox>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {t("sessions.title")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("sessions.subtitle")}
                </p>
              </div>
            </div>
          </div>

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-10">
              <CircleNotch
                className="h-6 w-6 animate-spin text-lamp-ink"
                weight="bold"
              />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {t("sessions.noSessions")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const device = parseDeviceInfo(session.deviceInfo);
                const isRevoking = revokingSessionId === session.id;
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-4 rounded-[--radius] border border-border bg-muted p-4"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <IconBox color="primary" size="sm">
                        {device.isMobile ? (
                          <DeviceMobile weight="fill" />
                        ) : (
                          <Desktop weight="fill" />
                        )}
                      </IconBox>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {device.browser}, {device.os}
                          </p>
                          {session.isCurrent && (
                            <span className="inline-flex items-center rounded-[--radius] bg-healthy px-2 py-0.5 text-[10px] font-semibold text-white">
                              {t("sessions.thisDevice")}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          {session.ipAddress && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Globe className="h-3 w-3" weight="bold" />
                              {session.ipAddress}
                            </span>
                          )}
                          {session.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" weight="bold" />
                              {session.location}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatSessionDate(session.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={isRevoking}
                        className="shrink-0 flex items-center gap-1.5 rounded-lg border border-destructive bg-destructive px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-destructive disabled:opacity-50"
                      >
                        {isRevoking ? (
                          <CircleNotch
                            className="h-3.5 w-3.5 animate-spin"
                            weight="bold"
                          />
                        ) : (
                          <SignOut className="h-3.5 w-3.5" weight="bold" />
                        )}
                        {t("sessions.terminate")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ElevatedContainer>
      </motion.div>
    </motion.main>
  );
}
