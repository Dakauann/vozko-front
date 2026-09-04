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

import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { CircuitTraces, DotMatrix } from "@/components/brand/circuit";
import { LightPool } from "@/components/brand/light-pool";
import { BrandLogo } from "@/components/brand-logo";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { useTranslations } from "next-intl";

type Step = "email" | "token" | "success";

/**
 * Password recovery, on login's plate.
 *
 * This page was shipped as a marketing card from a different visual world —
 * viewport noise texture, glow shadow, eyebrow badge, 3xl hero, a card that
 * slid in on mount — sitting one navigation away from the redesigned login.
 * It is now the same object as login: one quiet sheet, the brand at its head,
 * fields in order, one commit. The three-step flow is untouched.
 */
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
    <main className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden bg-background px-4 py-10 sm:py-16">
      {/* The brand's trace lines, same register as the login plate —
          token-coloured, pulse honours prefers-reduced-motion. */}
      <LightPool />
      <CircuitTraces className="pointer-events-none absolute -right-12 -top-12 hidden h-80 w-80 sm:block lg:-right-16 lg:-top-16 lg:h-[30rem] lg:w-[30rem]" />
      <DotMatrix className="pointer-events-none absolute bottom-10 left-8 hidden h-24 w-36 sm:block" />
      <div className="relative w-full max-w-[400px]">
        <div className="well overflow-hidden">
          <div className="rule-engraved flex items-center gap-2.5 px-5 py-3.5">
            <BrandLogo size="sm" />
          </div>

          <div className="px-5 py-6 sm:px-6">
            <Link
              href="/login"
              className="mb-4 inline-flex items-center gap-1.5 rounded-[--radius] text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft weight="bold" className="h-4 w-4" />
              {t("backLink")}
            </Link>

            {step === "email" && (
              <>
                <h1 className="font-display text-xl font-semibold leading-tight tracking-[0.01em] text-foreground">
                  {t("title")}
                </h1>
                <p className="mt-1.5 max-w-[46ch] text-sm leading-snug text-muted-foreground">
                  {t("description")}
                </p>

                {error && (
                  <div className="mt-4">
                    <AuthFormAlert message={error} />
                  </div>
                )}

                <form onSubmit={handleEmailSubmit} className="mt-6 space-y-6">
                  <ElevatedInput
                    type="email"
                    label={t("form.email")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<Envelope className="h-4 w-4" />}
                    autoComplete="email"
                    autoFocus
                    required
                    disabled={isPending}
                  />

                  <Button
                    variant="primary"
                    size="lg"
                    type="submit"
                    className="w-full"
                    title={isPending ? "..." : t("form.submit")}
                    disabled={isPending}
                    icon={<ArrowRight weight="bold" className="h-4 w-4" />}
                    iconVisible
                    iconSide="right"
                  />
                </form>
              </>
            )}

            {step === "token" && (
              <>
                <h1 className="font-display text-xl font-semibold leading-tight tracking-[0.01em] text-foreground">
                  {t("reset.title")}
                </h1>
                <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                  {t("reset.description")} <strong>{email}</strong>
                </p>

                {error && (
                  <div className="mt-4">
                    <AuthFormAlert message={error} />
                  </div>
                )}

                <form onSubmit={handlePasswordReset} className="mt-6 space-y-4">
                  <ElevatedInput
                    type="text"
                    label={t("reset.form.token")}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    icon={<Lock className="h-4 w-4" />}
                    required
                    maxLength={6}
                    inputMode="numeric"
                  />

                  <ElevatedInput
                    type="password"
                    label={t("reset.form.newPassword")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    icon={<Lock className="h-4 w-4" />}
                    required
                  />

                  <ElevatedInput
                    type="password"
                    label={t("reset.form.confirmPassword")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    icon={<Lock className="h-4 w-4" />}
                    required
                  />

                  <Button
                    variant="primary"
                    size="lg"
                    type="submit"
                    className="w-full"
                    title={isPending ? "..." : t("reset.form.submit")}
                    disabled={isPending}
                    icon={<ArrowRight weight="bold" className="h-4 w-4" />}
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
                  className="mt-4 w-full rounded-[--radius] text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("reset.backToEmail")}
                </button>
              </>
            )}

            {step === "success" && (
              <div className="py-4 text-center">
                <div className="tile-healthy mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full">
                  <CheckCircle weight="fill" className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">
                  {t("success.title")}
                </h2>
                <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                  {t("success.description")}
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => router.push("/login")}
                  className="mt-6 w-full"
                  title={t("success.button")}
                  icon={<ArrowRight weight="bold" className="h-4 w-4" />}
                  iconVisible
                  iconSide="right"
                />
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 text-center">
          <Link
            href="/terms-of-service"
            className="legend rounded-[--radius] transition-colors hover:!text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("termsLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}
