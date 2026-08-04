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
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import GradientText from "@/components/elevated-design/gradient-text";
import { IconBox } from "@/components/elevated-design/listing-card";
import { useTranslations } from "next-intl";

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

const isRateLimitError = (message?: string | null) =>
  message?.toLowerCase().includes("rate limit") ?? false;

type PasswordResetStep = "idle" | "sending" | "code" | "resetting" | "success";

export default function SettingsPage() {
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");
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
      setPasswordResetError("Preencha todos os campos");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordResetError("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordResetError("A senha deve ter pelo menos 8 caracteres");
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
    if (!ua)
      return { browser: "Desconhecido", os: "Desconhecido", isMobile: false };
    const isMobile = /mobile|android|iphone|ipad/i.test(ua);
    let browser = "Navegador";
    if (/edg\//i.test(ua)) browser = "Edge";
    else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
    else if (/chrome\//i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
    else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
    else if (/firefox\//i.test(ua)) browser = "Firefox";

    let os = "Desconhecido";
    if (/windows/i.test(ua)) os = "Windows";
    else if (/mac os/i.test(ua)) os = "macOS";
    else if (/linux/i.test(ua)) os = "Linux";
    else if (/android/i.test(ua)) os = "Android";
    else if (/iphone|ipad/i.test(ua)) os = "iOS";

    return { browser, os, isMobile };
  }

  function formatSessionDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR", {
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
        label: "Administrador",
        color: "text-muted-foreground",
        bg: "bg-muted",
      },
      manager: { label: "Gerente", color: "text-lamp-ink", bg: "bg-primary/15" },
      user: { label: "Usuário", color: "text-foreground", bg: "bg-muted" },
      customer: {
        label: "Cliente",
        color: "text-healthy",
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

  const getCustomerTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; icon: React.ReactNode }> =
      {
        individual: {
          label: "Pessoa Física",
          icon: <User className="h-4 w-4" weight="fill" />,
        },
        company: {
          label: "Pessoa Jurídica",
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
    return (
      <div className="min-h-screen bg-muted pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
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
                  <p className="text-sm text-muted-foreground">
                    Carregando configurações...
                  </p>
                </div>
              </ElevatedContainer>
            </motion.div>
          </motion.main>
        </div>
      </div>
    );
  }

  const roleBadge = user?.role ? getRoleBadge(user.role) : null;
  const customerTypeBadge = user?.customerType
    ? getCustomerTypeBadge(user.customerType)
    : null;

  return (
    <div className="min-h-screen bg-muted pt-24 pb-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.main
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full space-y-6"
        >
          <motion.div variants={itemVariants}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <GearSix className="h-6 w-6 text-lamp-ink" weight="fill" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-lamp-ink">
                    Configurações
                  </span>
                </div>
                <GradientText
                  as="h1"
                  alignment="left"
                  startColor="#64748b"
                  endColor="#94a3b8"
                  className="text-2xl font-semibold md:text-3xl"
                >
                  Configurações da Conta
                </GradientText>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Gerencie suas informações pessoais, preferências de
                  notificação e configurações de segurança da sua conta.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={containerVariants}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <motion.div variants={itemVariants}>
              <ElevatedContainer className="border border-border bg-card p-5">
                <div className="flex items-center gap-4">
                  <IconBox color="blue" size="md">
                    <UserCircle weight="fill" />
                  </IconBox>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user?.name || "Não informado"}
                    </p>
                    <p className="text-xs text-muted-foreground">Nome</p>
                  </div>
                </div>
              </ElevatedContainer>
            </motion.div>

            <motion.div variants={itemVariants}>
              <ElevatedContainer className="border border-border bg-card p-5">
                <div className="flex items-center gap-4">
                  <IconBox color="emerald" size="md">
                    <Envelope weight="fill" />
                  </IconBox>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-semibold text-foreground truncate"
                      title={user?.email}
                    >
                      {user?.email || "Não informado"}
                    </p>
                    <p className="text-xs text-muted-foreground">E-mail</p>
                  </div>
                </div>
              </ElevatedContainer>
            </motion.div>

            <motion.div variants={itemVariants}>
              <ElevatedContainer className="border border-border bg-card p-5">
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
                    <p className="text-xs text-muted-foreground mt-1">Perfil</p>
                  </div>
                </div>
              </ElevatedContainer>
            </motion.div>

            <motion.div variants={itemVariants}>
              <ElevatedContainer className="border border-border bg-card p-5">
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
                      {customerTypeBadge?.label || "Não informado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tipo de conta
                    </p>
                  </div>
                </div>
              </ElevatedContainer>
            </motion.div>
          </motion.div>

          {plan && (
            <motion.div variants={itemVariants}>
              <ElevatedContainer className="border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <IconBox color="primary" size="sm">
                    <CrownSimple weight="fill" />
                  </IconBox>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Seu Plano
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Recursos e limites da sua conta
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
                        Plano atual
                      </p>
                    </div>
                  </div>
                </div>
              </ElevatedContainer>
            </motion.div>
          )}

          <motion.div
            variants={containerVariants}
            className="grid gap-6 lg:grid-cols-2"
          >
            <motion.div variants={itemVariants}>
              <ElevatedContainer className="h-full border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <IconBox color="blue" size="sm">
                    <IdentificationBadge weight="fill" />
                  </IconBox>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Informações do Perfil
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Seus dados pessoais
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
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Nome Completo
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {user?.name || "Não informado"}
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
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          E-mail
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {user?.email || "Não informado"}
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
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          ID do Usuário
                        </p>
                        <p className="text-sm font-medium text-foreground font-mono">
                          {user?.id || "Não informado"}
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
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Tipo de Conta
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {customerTypeBadge?.label || "Não informado"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </ElevatedContainer>
            </motion.div>

            <motion.div variants={itemVariants}>
              <ElevatedContainer className="h-full border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <IconBox color="emerald" size="sm">
                    <Lock weight="fill" />
                  </IconBox>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Segurança
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Gerencie a segurança da sua conta
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
                              className="h-5 w-5 text-healthy mt-0.5"
                              weight="fill"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">
                                Alterar Senha
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Enviaremos um código de verificação para{" "}
                                {user?.email}
                              </p>
                            </div>
                          </div>

                          {passwordResetError && (
                            <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                              <p className="text-sm text-destructive">
                                {passwordResetError}
                              </p>
                            </div>
                          )}

                          <div className="mt-4">
                            <Button
                              variant="primary"
                              title="Iniciar alteração de senha"
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
                              className="h-8 w-8 animate-spin text-lamp-ink"
                              weight="bold"
                            />
                            <p className="text-sm text-muted-foreground">
                              Enviando código para seu e-mail...
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
                                  Redefinir sua senha
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Digite o código enviado para{" "}
                                  <strong>{user?.email}</strong>
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
                              <p className="text-sm text-destructive">
                                {passwordResetError}
                              </p>
                            </div>
                          )}

                          <div className="space-y-4">
                            <ElevatedInput
                              type="text"
                              label="Código de verificação"
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
                                label="Nova senha"
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
                              A senha deve ter pelo menos 8 caracteres
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
                              className="text-xs text-lamp-ink hover:text-lamp-ink font-medium transition-colors"
                            >
                              Não recebeu o código? Enviar novamente
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
                              Alterando sua senha...
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
                            Senha alterada com sucesso!
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Sua senha foi atualizada. Use a nova senha no
                            próximo login.
                          </p>
                          <Button
                            variant="secondary"
                            title="Concluído"
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
                        className="h-5 w-5 text-lamp-ink mt-0.5"
                        weight="fill"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          Autenticação em Duas Etapas
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Adicione uma camada extra de segurança à sua conta.
                        </p>
                        <span className="inline-flex items-center mt-2 rounded-[--radius] bg-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Em breve
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </ElevatedContainer>
            </motion.div>
          </motion.div>

          {/* Active Sessions Section */}
          <motion.div variants={itemVariants}>
            <ElevatedContainer className="border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <IconBox color="primary" size="sm">
                    <Globe weight="fill" />
                  </IconBox>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Sessões Ativas
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Dispositivos conectados à sua conta
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
                                <span className="inline-flex items-center rounded-[--radius] bg-healthy px-2 py-0.5 text-[10px] font-semibold text-white">
                                  Este dispositivo
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
                            Encerrar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ElevatedContainer>
          </motion.div>

          <motion.div variants={itemVariants}>
            <ElevatedContainer className="border border-border bg-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <IconBox color="amber" size="sm">
                  <Bell weight="fill" />
                </IconBox>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Alertas e Notificações
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Configure suas preferências de comunicação
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-start gap-4 rounded-[--radius] border border-border bg-muted p-4 cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-1 h-4 w-4 rounded border-foreground/20 text-lamp-ink focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Atualizações de status
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Receber atualizações sobre status das importações e
                      liberações.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-4 rounded-[--radius] border border-border bg-muted p-4 cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-foreground/20 text-lamp-ink focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Novidades e promoções
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Avisar sobre novas terapias e promoções especiais
                      disponíveis.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-4 rounded-[--radius] border border-border bg-muted p-4 cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-1 h-4 w-4 rounded border-foreground/20 text-lamp-ink focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Alertas de segurança
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Notificações sobre atividades suspeitas ou login em novos
                      dispositivos.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-4 rounded-[--radius] border border-border bg-muted p-4 cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-foreground/20 text-lamp-ink focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Newsletter
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Receber nossa newsletter semanal com dicas e novidades.
                    </p>
                  </div>
                </label>
              </div>
            </ElevatedContainer>
          </motion.div>
        </motion.main>
      </div>
    </div>
  );
}
