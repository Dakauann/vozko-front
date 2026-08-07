"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Envelope,
  Lock,
} from "@/components/icons";
import { Link, useRouter } from "@/i18n/routing";
import { forgotPassword, resetPassword } from "@/lib/auth/auth-api";
import { useState, useTransition } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

type Step = "email" | "token" | "success";

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await forgotPassword(email);

      if (result.error) {
        setError(result.error);
      } else {
        setStep("token");
      }
    });
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      return;
    }

    if (newPassword.length < 8) {
      setError(t("errors.passwordTooShort"));
      return;
    }

    startTransition(async () => {
      const result = await resetPassword(email, token, newPassword);

      if (result.error) {
        setError(result.error);
      } else {
        setStep("success");
      }
    });
  };

  return (
    <div className="min-h-screen pt-0 bg-muted overflow-y-auto">
      <div className="flex items-center justify-center px-4 py-8 sm:py-12 relative min-h-[calc(100vh-3rem)] sm:min-h-[calc(100vh-3rem)]">
        <div
          className="fixed inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-[520px] relative"
        >
          <div
            className="rounded-[--radius] sm:rounded-[--radius] bg-card p-6 sm:p-8 border border-border"
            style={{
              boxShadow:
                "0 4px 40px -12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.02)",
            }}
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft weight="bold" className="w-4 h-4" />
              {t("backLink")}
            </Link>

            {step === "email" && (
              <>
                <div className="mb-6">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="inline-flex items-center rounded-[--radius] bg-muted border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground mb-4"
                  >
                    {t("badge")}
                  </motion.div>
                  <h1 className="text-3xl font-semibold text-foreground tracking-tight">
                    {t("title")}
                  </h1>
                  <p className="mt-3 text-muted-foreground text-[15px]">
                    {t("description")}
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-muted border border-border rounded-[--radius]"
                  >
                    <p className="text-sm text-destructive-ink font-medium">{error}</p>
                  </motion.div>
                )}

                <form onSubmit={handleEmailSubmit} className="space-y-5">
                  <ElevatedInput
                    type="email"
                    label={t("form.email")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<Envelope weight="fill" className="w-5 h-5" />}
                    required
                  />

                  <Button
                    variant="main-cta"
                    size="lg"
                    type="submit"
                    className="w-full"
                    title={isPending ? "..." : t("form.submit")}
                    disabled={isPending}
                    icon={<ArrowRight weight="bold" className="w-5 h-5" />}
                    iconVisible
                    iconSide="right"
                  />
                </form>
              </>
            )}

            {step === "token" && (
              <>
                <div className="mb-6">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="inline-flex items-center rounded-[--radius] bg-muted border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground mb-4"
                  >
                    {t("reset.badge")}
                  </motion.div>
                  <h1 className="text-3xl font-semibold text-foreground tracking-tight">
                    {t("reset.title")}
                  </h1>
                  <p className="mt-3 text-muted-foreground text-[15px]">
                    {t("reset.description")} <strong>{email}</strong>
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-muted border border-border rounded-[--radius]"
                  >
                    <p className="text-sm text-destructive-ink font-medium">{error}</p>
                  </motion.div>
                )}

                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <ElevatedInput
                    type="text"
                    label={t("reset.form.token")}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    icon={<Lock weight="fill" className="w-5 h-5" />}
                    required
                    maxLength={6}
                    inputMode="numeric"
                  />

                  <ElevatedInput
                    type="password"
                    label={t("reset.form.newPassword")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    icon={<Lock weight="fill" className="w-5 h-5" />}
                    required
                  />

                  <ElevatedInput
                    type="password"
                    label={t("reset.form.confirmPassword")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    icon={<Lock weight="fill" className="w-5 h-5" />}
                    required
                  />

                  <Button
                    variant="main-cta"
                    size="lg"
                    type="submit"
                    className="w-full"
                    title={isPending ? "..." : t("reset.form.submit")}
                    disabled={isPending}
                    icon={<ArrowRight weight="bold" className="w-5 h-5" />}
                    iconVisible
                    iconSide="right"
                  />
                </form>

                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setToken("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setError("");
                  }}
                  className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
                >
                  {t("reset.backToEmail")}
                </button>
              </>
            )}

            {step === "success" && (
              <div className="text-center py-6">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="w-16 h-16 mx-auto mb-6 rounded-full tile-healthy flex items-center justify-center"
                >
                  <CheckCircle
                    weight="fill"
                    className="w-10 h-10 text-healthy-ink"
                  />
                </motion.div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  {t("success.title")}
                </h2>
                <p className="text-muted-foreground mb-6 text-[15px]">
                  {t("success.description")}
                </p>
                <Button
                  variant="main-cta"
                  size="lg"
                  onClick={() => router.push("/login")}
                  className="w-full"
                  title={t("success.button")}
                  icon={<ArrowRight weight="bold" className="w-5 h-5" />}
                  iconVisible
                  iconSide="right"
                />
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link
              href="/terms-of-service"
              className="hover:text-muted-foreground transition-colors"
            >
              {t("termsLink")}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
