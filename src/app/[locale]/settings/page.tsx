"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Buildings,
  CalendarBlank,
  Check,
  CheckCircle,
  CircleNotch,
  CrownSimple,
  Desktop,
  DeviceMobile,
  Envelope,
  Eye,
  EyeSlash,
  GearSix,
  Globe,
  IdentificationBadge,
  Lock,
  MapPin,
  PaperPlaneTilt,
  Phone,
  ShieldCheck,
  SignOut,
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
} from "@/app/actions/auth";
import { forgotPassword, resetPassword } from "@/lib/auth/auth-api";
import { useEffect, useState } from "react";

import type { ActiveSession } from "@/app/actions/auth";
import { ScreenLoader } from "@/components/brand/screen-loader";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import { IconBox } from "@/components/elevated-design/listing-card";
import { useLocale, useTranslations } from "next-intl";

const isRateLimitError = (message?: string | null) =>
  message?.toLowerCase().includes("rate limit") ?? false;

type PasswordResetStep = "idle" | "sending" | "code" | "resetting" | "success";

export default function SettingsPage() {
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");
  const tProfile = useTranslations("profilePage");
  const tCustomerType = useTranslations("users.customerType");
  const locale = useLocale();
  const emptyText = useEmptyValue();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<UserPlan | null>(null);

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
      setPasswordResetError(tProfile("security.fillAll"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordResetError(tProfile("security.passwordMismatch"));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordResetError(tProfile("security.passwordMinLength"));
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
      setPasswordResetError(tSettings("resetPasswordError"));
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

  function parseDeviceInfo(ua: string): {
    browser: string;
    os: string;
    isMobile: boolean;
  } {
    const unknown = tProfile("sessions.unknown");
    if (!ua) return { browser: unknown, os: unknown, isMobile: false };
    const isMobile = /mobile|android|iphone|ipad/i.test(ua);
    let browser = tProfile("sessions.browser");
    if (/edg\//i.test(ua)) browser = "Edge";
    else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
    else if (/chrome\//i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
    else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
    else if (/firefox\//i.test(ua)) browser = "Firefox";

    let os = unknown;
    if (/windows/i.test(ua)) os = "Windows";
    else if (/mac os/i.test(ua)) os = "macOS";
    else if (/linux/i.test(ua)) os = "Linux";
    else if (/android/i.test(ua)) os = "Android";
    else if (/iphone|ipad/i.test(ua)) os = "iOS";

    return { browser, os, isMobile };
  }

  function formatSessionDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString(locale, {
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
        label: tProfile("roles.admin"),
        color: "text-muted-foreground",
        bg: "bg-muted",
      },
      manager: { label: tProfile("roles.manager"), color: "text-primary-ink", bg: "bg-muted"},
      user: { label: tProfile("roles.user"), color: "text-foreground", bg: "bg-muted" },
      customer: {
        label: tProfile("roles.customer"),
        color: "text-healthy-ink",
        bg: "bg-muted",
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

  const getCustomerTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; icon: React.ReactNode }> =
      {
        individual: {
          label: tCustomerType("individual"),
          icon: <User className="h-4 w-4" weight="fill" />,
        },
        company: {
          label: tCustomerType("company"),
          icon: <Buildings className="h-4 w-4" weight="fill" />,
        },
      };
    return (
      typeConfig[type] || {
        label: type,
        icon: <User className="h-4 w-4" weight="fill" />,
      }
    );
  };

  if (loading) {
    return <ScreenLoader fit="viewport" label={tSettings("loading")} />;
  }

  const roleBadge = user?.role ? getRoleBadge(user.role) : null;
  const customerTypeBadge = user?.customerType
    ? getCustomerTypeBadge(user.customerType)
    : null;

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <main className="w-full space-y-6">
          <div>
            <div className="border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <GearSix
                  className="h-[18px] w-[18px] text-muted-foreground"
                  weight="fill"
                />
                <h1 className="font-display text-xl font-semibold leading-tight tracking-[0.01em] text-foreground">
                  {tSettings("title")}
                </h1>
              </div>
              <p className="mt-0.5 max-w-2xl text-sm leading-snug text-muted-foreground">
                {tSettings("subtitle")}
              </p>
            </div>
          </div>

          <div>
            <div>
              <ElevatedContainer className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-4">
                  <IconBox color="blue" size="md">
                    <UserCircle weight="fill" />
                  </IconBox>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user?.name || emptyText}
                    </p>
                    <p className="text-xs text-muted-foreground">{tProfile("info.name")}</p>
                  </div>
                </div>
              </ElevatedContainer>
            </div>

            <div>
              <ElevatedContainer className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-4">
                  <IconBox color="emerald" size="md">
                    <Envelope weight="fill" />
                  </IconBox>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-semibold text-foreground truncate"
                      title={user?.email}
                    >
                      {user?.email || emptyText}
                    </p>
                    <p className="text-xs text-muted-foreground">{tProfile("info.email")}</p>
                  </div>
                </div>
              </ElevatedContainer>
            </div>

            <div>
              <ElevatedContainer className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-4">
                  <IconBox color="purple" size="md">
                    <ShieldCheck weight="fill" />
                  </IconBox>
                  <div>
                    {roleBadge && (
                      <span
                        className={`inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium ${roleBadge.bg} ${roleBadge.color}`}
                      >
                        {roleBadge.label}
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{tProfile("info.role")}</p>
                  </div>
                </div>
              </ElevatedContainer>
            </div>

            <div>
              <ElevatedContainer className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-4">
                  <IconBox color="amber" size="md">
                    {customerTypeBadge?.icon ? (
                      <div>{customerTypeBadge.icon}</div>
                    ) : (
                      <Buildings weight="fill" />
                    )}
                  </IconBox>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {customerTypeBadge?.label || emptyText}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tSettings("accountType")}
                    </p>
                  </div>
                </div>
              </ElevatedContainer>
            </div>
          </div>

          {plan && (
            <div>
              <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <IconBox color="primary" size="sm">
                    <CrownSimple weight="fill" />
                  </IconBox>
                  <div>
                    <h2 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                      {tSettings("plan.title")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {tSettings("plan.subtitle")}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-4 rounded-[--radius] border border-border bg-muted p-4">
                    <IconBox color="primary" size="md">
                      <CrownSimple weight="fill" />
                    </IconBox>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {plan.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tSettings("plan.current")}
                      </p>
                    </div>
                  </div>
                </div>
              </ElevatedContainer>
            </div>
          )}

          <div>
            <div>
              <ElevatedContainer className="h-full border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <IconBox color="blue" size="sm">
                    <IdentificationBadge weight="fill" />
                  </IconBox>
                  <div>
                    <h2 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                      {tProfile("info.title")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {tProfile("info.subtitle")}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-[--radius] border border-border bg-muted p-4">
                    <div className="flex items-center gap-3">
                      <User
                        className="h-5 w-5 text-muted-foreground"
                        weight="fill"
                      />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {tProfile("info.name")}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {user?.name || emptyText}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-[--radius] border border-border bg-muted p-4">
                    <div className="flex items-center gap-3">
                      <Envelope
                        className="h-5 w-5 text-muted-foreground"
                        weight="fill"
                      />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {tProfile("info.email")}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {user?.email || emptyText}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-[--radius] border border-border bg-muted p-4">
                    <div className="flex items-center gap-3">
                      <IdentificationBadge
                        className="h-5 w-5 text-muted-foreground"
                        weight="fill"
                      />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {tProfile("info.userId")}
                        </p>
                        <p className="text-sm font-medium text-foreground font-mono">
                          {user?.id || emptyText}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-[--radius] border border-border bg-muted p-4">
                    <div className="flex items-center gap-3">
                      <CalendarBlank
                        className="h-5 w-5 text-muted-foreground"
                        weight="fill"
                      />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {tSettings("accountType")}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {customerTypeBadge?.label || emptyText}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </ElevatedContainer>
            </div>

            <div>
              <ElevatedContainer className="h-full border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <IconBox color="emerald" size="sm">
                    <Lock weight="fill" />
                  </IconBox>
                  <div>
                    <h2 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                      {tProfile("security.title")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {tProfile("security.subtitle")}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[--radius] border border-border bg-muted p-4">
                    <AnimatePresence mode="wait">
                      {passwordResetStep === "idle" && (
                        <motion.div
                          key="idle"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex items-start gap-3">
                            <ShieldCheck
                              className="h-5 w-5 text-healthy-ink mt-0.5"
                              weight="fill"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {tProfile("security.changePassword")}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {tProfile("security.changePasswordDesc", {
                                  email: user?.email || "",
                                })}
                              </p>
                            </div>
                          </div>

                          {passwordResetError && (
                            <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted border border-border p-3">
                              <p className="text-sm text-destructive-ink">
                                {passwordResetError}
                              </p>
                            </div>
                          )}

                          <div className="mt-4">
                            <Button
                              variant="primary"
                              title={tProfile("security.sendCode")}
                              icon={
                                <PaperPlaneTilt
                                  className="h-4 w-4"
                                  weight="fill"
                                />
                              }
                              iconVisible
                              iconSide="left"
                              onClick={handleSendPasswordReset}
                              disabled={!user?.email}
                            />
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
                              className="h-8 w-8 animate-spin text-primary-ink"
                              weight="bold"
                            />
                            <p className="text-sm text-muted-foreground">
                              {tProfile("security.sendingCode")}
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
                                className="h-5 w-5 text-primary-ink mt-0.5"
                                weight="fill"
                              />
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {tProfile("security.resetTitle")}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {tProfile("security.codeSentTo", {
                                    email: user?.email || "",
                                  })}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleCancelPasswordReset}
                              aria-label={tSettings("cancel")}
                              className="p-1 rounded-lg hover:bg-border transition-colors"
                            >
                              <X
                                className="h-4 w-4 text-muted-foreground"
                                weight="bold"
                              />
                            </button>
                          </div>

                          {passwordResetError && (
                            <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted border border-border p-3">
                              <p className="text-sm text-destructive-ink">
                                {passwordResetError}
                              </p>
                            </div>
                          )}

                          <div className="space-y-4">
                            <ElevatedInput
                              type="text"
                              label={tProfile("security.verificationCode")}
                              value={resetCode}
                              onChange={(e) => setResetCode(e.target.value)}
                              icon={
                                <ShieldCheck
                                  className="h-5 w-5"
                                  weight="fill"
                                />
                              }
                              maxLength={6}
                              inputMode="numeric"
                              controlSize="sm"
                            />

                            <div className="relative">
                              <ElevatedInput
                                type={showNewPassword ? "text" : "password"}
                                label={tProfile("security.newPassword")}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                icon={
                                  <Lock className="h-5 w-5" weight="fill" />
                                }
                                controlSize="sm"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowNewPassword(!showNewPassword)
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-muted-foreground"
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
                                label={tSettings("confirmNewPassword")}
                                value={confirmPassword}
                                onChange={(e) =>
                                  setConfirmPassword(e.target.value)
                                }
                                icon={
                                  <Lock className="h-5 w-5" weight="fill" />
                                }
                                controlSize="sm"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowConfirmPassword(!showConfirmPassword)
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-muted-foreground"
                              >
                                {showConfirmPassword ? (
                                  <EyeSlash className="h-4 w-4" weight="fill" />
                                ) : (
                                  <Eye className="h-4 w-4" weight="fill" />
                                )}
                              </button>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              {tProfile("security.passwordMinLengthHint")}
                            </p>

                            <div className="flex items-center gap-3">
                              <Button
                                variant="primary"
                                title={tSettings("confirmNewPassword")}
                                icon={
                                  <Check className="h-4 w-4" weight="bold" />
                                }
                                iconVisible
                                iconSide="left"
                                onClick={handleResetPassword}
                                disabled={
                                  !resetCode || !newPassword || !confirmPassword
                                }
                              />
                              <Button
                                variant="ghost"
                                title={tSettings("cancel")}
                                onClick={handleCancelPasswordReset}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleSendPasswordReset}
                              className="text-xs text-primary-ink hover:text-primary-ink font-medium transition-colors"
                            >
                              {tProfile("security.resendCode")}
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
                              className="h-8 w-8 animate-spin text-primary-ink"
                              weight="bold"
                            />
                            <p className="text-sm text-muted-foreground">
                              {tProfile("security.changingPassword")}
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
                          <div className="mx-auto w-14 h-14 mb-4 rounded-full tile-healthy flex items-center justify-center">
                            <CheckCircle
                              weight="fill"
                              className="w-8 h-8 text-healthy-ink"
                            />
                          </div>
                          <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground mb-1">
                            {tProfile("security.passwordChanged")}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {tProfile("security.passwordChangedDesc")}
                          </p>
                          <Button
                            variant="secondary"
                            title={tProfile("security.done")}
                            icon={<Check className="h-4 w-4" weight="bold" />}
                            iconVisible
                            iconSide="left"
                            onClick={() => setPasswordResetStep("idle")}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="rounded-[--radius] border border-border bg-muted p-4">
                    <div className="flex items-start gap-3">
                      <Lock
                        className="h-5 w-5 text-primary-ink mt-0.5"
                        weight="fill"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {tProfile("security.twoFactor")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {tProfile("security.twoFactorDesc")}
                        </p>
                        <span className="inline-flex items-center mt-2 rounded-[--radius] bg-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {tProfile("security.comingSoon")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </ElevatedContainer>
            </div>
          </div>

          <div>
            <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <IconBox color="primary" size="sm">
                    <Globe weight="fill" />
                  </IconBox>
                  <div>
                    <h2 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                      {tProfile("sessions.title")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {tProfile("sessions.subtitle")}
                    </p>
                  </div>
                </div>
              </div>

              {sessionsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <CircleNotch
                    className="h-6 w-6 animate-spin text-primary-ink"
                    weight="bold"
                  />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    {tSettings("noActiveSessions")}
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
                                <span className="inline-flex items-center rounded-[--radius] bg-healthy px-2 py-0.5 text-2xs font-semibold text-healthy-foreground">
                                  {tProfile("sessions.thisDevice")}
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
                            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-destructive bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive disabled:opacity-50"
                          >
                            {isRevoking ? (
                              <CircleNotch
                                className="h-3.5 w-3.5 animate-spin"
                                weight="bold"
                              />
                            ) : (
                              <SignOut className="h-3.5 w-3.5" weight="bold" />
                            )}
                            {tProfile("sessions.terminate")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ElevatedContainer>
          </div>

          <div>
            <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <IconBox color="amber" size="sm">
                  <Bell weight="fill" />
                </IconBox>
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                    {tProfile("notifications.title")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {tProfile("notifications.subtitle")}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-start gap-4 rounded-[--radius] border border-border bg-muted p-4 cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-1 h-4 w-4 rounded border-foreground/20 text-primary-ink focus:ring-info"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {tSettings("notifications.statusUpdates.title")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tSettings("notifications.statusUpdates.description")}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-4 rounded-[--radius] border border-border bg-muted p-4 cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-foreground/20 text-primary-ink focus:ring-info"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {tSettings("notifications.news.title")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tSettings("notifications.news.description")}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-4 rounded-[--radius] border border-border bg-muted p-4 cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-1 h-4 w-4 rounded border-foreground/20 text-primary-ink focus:ring-info"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {tSettings("notifications.securityAlerts.title")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tSettings("notifications.securityAlerts.description")}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-4 rounded-[--radius] border border-border bg-muted p-4 cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-foreground/20 text-primary-ink focus:ring-info"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {tSettings("notifications.newsletter.title")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tSettings("notifications.newsletter.description")}
                    </p>
                  </div>
                </label>
              </div>
            </ElevatedContainer>
          </div>
        </main>
      </div>
    </div>
  );
}
