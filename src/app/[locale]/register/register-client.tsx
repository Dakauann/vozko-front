"use client";

import {
  ArrowRight,
  Buildings,
  Check,
  Envelope,
  IdentificationCard,
  Lock,
  LockIcon,
  User,
  X,
} from "@/components/icons";
import {
  register as registerRequest,
  sendEmailVerification,
} from "@/lib/auth/auth-api";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Link } from "@/i18n/routing";
import { authErrorTranslationKey } from "@/lib/auth/error-codes";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useTranslations } from "next-intl";

type AccountType = "company" | "individual";

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const formatCPF = (value: string) => {
  const digits = digitsOnly(value).slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);

  if (digits.length <= 3) return part1;
  if (digits.length <= 6) return `${part1}.${part2}`;
  if (digits.length <= 9) return `${part1}.${part2}.${part3}`;
  return `${part1}.${part2}.${part3}-${part4}`;
};

const formatCNPJ = (value: string) => {
  const digits = digitsOnly(value).slice(0, 14);
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 12);
  const part5 = digits.slice(12, 14);

  if (digits.length <= 2) return part1;
  if (digits.length <= 5) return `${part1}.${part2}`;
  if (digits.length <= 8) return `${part1}.${part2}.${part3}`;
  if (digits.length <= 12) return `${part1}.${part2}.${part3}/${part4}`;
  return `${part1}.${part2}.${part3}/${part4}-${part5}`;
};

const isRepeatedSequence = (digits: string) => /^([0-9])\1*$/.test(digits);

const validateCPF = (value: string) => {
  const digits = digitsOnly(value);
  if (digits.length !== 11 || isRepeatedSequence(digits)) {
    return false;
  }

  const calculateCheckDigit = (length: number) => {
    const sum = digits
      .slice(0, length)
      .split("")
      .reduce(
        (acc, digit, index) => acc + Number(digit) * (length + 1 - index),
        0,
      );
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const firstDigit = calculateCheckDigit(9);
  const secondDigit = calculateCheckDigit(10);

  return firstDigit === Number(digits[9]) && secondDigit === Number(digits[10]);
};

const validateCNPJ = (value: string) => {
  const digits = digitsOnly(value);
  if (digits.length !== 14 || isRepeatedSequence(digits)) {
    return false;
  }

  const calculateCheckDigit = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const sum = digits
      .slice(0, length)
      .split("")
      .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);

    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateCheckDigit(12);
  const secondDigit = calculateCheckDigit(13);

  return (
    firstDigit === Number(digits[12]) && secondDigit === Number(digits[13])
  );
};

const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

type PasswordRules = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  allValid: boolean;
};

const evaluatePasswordRules = (password: string): PasswordRules => {
  const length = password.length >= 8;
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  const digit = /\d/.test(password);
  return {
    length,
    upper,
    lower,
    digit,
    allValid: length && upper && lower && digit,
  };
};

export default function RegisterClient() {
  const t = useTranslations("register");
  const tRoot = useTranslations();
  const { refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [lastSentVerificationTime, setLastSentVerificationTime] =
    useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const passwordRules = evaluatePasswordRules(password);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setTimeout(() => setError(errorParam), 0);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!lastSentVerificationTime) {
      return;
    }

    const updateCountdown = () => {
      const elapsed = Math.floor(
        (new Date().getTime() - lastSentVerificationTime.getTime()) / 1000,
      );
      const remaining = Math.max(0, 60 - elapsed);
      setCountdown(remaining);

      if (remaining === 0) {
        setLastSentVerificationTime(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [lastSentVerificationTime]);

  const handleAccountTypeChange = (next: string) => {
    if (next !== "company" && next !== "individual") {
      return;
    }

    setAccountType(next);
    setError("");

    if (next === "company") {
      setCpf("");
    } else {
      setCnpj("");
    }
  };

  const buildPostAuthDestination = useCallback(() => {
    if (typeof window === "undefined") {
      return { relative: "/", absolute: "/" };
    }

    const origin = window.location.origin;
    const redirectParam = searchParams.get("redirect");
    let targetUrl: URL;

    if (redirectParam) {
      try {
        const candidate = new URL(redirectParam, origin);
        if (candidate.origin === origin) {
          targetUrl = candidate;
        } else {
          targetUrl = new URL("/", origin);
        }
      } catch {
        targetUrl = new URL("/", origin);
      }
    } else {
      targetUrl = new URL("/", origin);
    }

    const finalUrl = new URL(
      targetUrl.pathname + targetUrl.search + targetUrl.hash,
      origin,
    );

    const extraParams = new URLSearchParams(searchParams.toString());
    extraParams.delete("redirect");
    extraParams.forEach((value, key) => {
      if (!finalUrl.searchParams.has(key)) {
        finalUrl.searchParams.append(key, value);
      }
    });

    const relative = `${finalUrl.pathname}${finalUrl.search}${finalUrl.hash}`;
    return { relative, absolute: finalUrl.toString() };
  }, [searchParams]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPasswordError("");
    setConfirmPasswordError("");

    if (!accountType) {
      setError(t("errors.selectAccountType"));
      return;
    }
    if (!passwordRules.allValid) {
      const weakMsg = tRoot("auth.errors.weak_password");
      setPasswordError(weakMsg);
      setError(weakMsg);
      setShowPasswordRules(true);
      return;
    }
    if (password !== confirmPassword) {
      const mismatchMsg = t("errors.passwordMismatch");
      setConfirmPasswordError(mismatchMsg);
      setError(mismatchMsg);
      return;
    }
    if (!acceptTerms) {
      setError(t("errors.acceptTerms"));
      return;
    }

    const rawDocument =
      accountType === "company"
        ? cnpj
        : accountType === "individual"
          ? cpf
          : "";
    const sanitizedDocument = digitsOnly(rawDocument);

    if (accountType === "company") {
      if (!sanitizedDocument) {
        setError(t("errors.cnpjRequired"));
        return;
      }
      if (!validateCNPJ(sanitizedDocument)) {
        setError(t("errors.cnpjInvalid"));
        return;
      }
    } else if (accountType === "individual") {
      if (!sanitizedDocument) {
        setError(t("errors.cpfRequired"));
        return;
      }
      if (!validateCPF(sanitizedDocument)) {
        setError(t("errors.cpfInvalid"));
        return;
      }
    }

    const payload =
      accountType === "company"
        ? {
            name,
            email,
            verificationToken,
            password,
            customerType: "company" as const,
            cnpj: sanitizedDocument,
          }
        : {
            name,
            email,
            password,
            customerType: "individual" as const,
            verificationToken,
            cpf: sanitizedDocument,
          };

    startTransition(async () => {
      const result = await registerRequest(payload);

      if (result.error) {
        if (result.code) {
          const localized = tRoot(authErrorTranslationKey(result.code));
          setError(localized);
          if (result.code === "AUTH_WEAK_PASSWORD") {
            setPasswordError(localized);
            setShowPasswordRules(true);
          } else if (result.code === "AUTH_EMAIL_ALREADY_EXISTS") {
            // No field-level slot for email yet, top alert is enough.
          }
        } else {
          switch (result.statusCode) {
            case 400:
              setError(result.error || tRoot("auth.errors.validation_failed"));
              break;
            case 409:
              setError(tRoot("auth.errors.email_exists"));
              break;
            case 422:
              setError(tRoot("auth.errors.invalid_document"));
              break;
            default:
              setError(result.error || tRoot("auth.errors.generic"));
          }
        }
      } else {
        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setCpf("");
        setCnpj("");
        setError("");

        await new Promise((resolve) => setTimeout(resolve, 100));
        await refreshUser(true);
        const destination = buildPostAuthDestination();
        router.push(destination.relative);
        router.refresh();
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
            <div className="mb-6 text-center">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center rounded-[--radius] bg-muted border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground mb-4"
              >
                {t("header.badge")}
              </motion.div>
              <h1 className="text-3xl font-semibold text-foreground tracking-tight">
                {t("header.title")}
              </h1>
              <p className="mt-3 text-muted-foreground text-base">
                {t("header.description")}
              </p>
            </div>

            {error && <AuthFormAlert message={error} />}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">
                  {t("form.accountType.label")}{" "}
                  <span className="text-destructive-ink">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleAccountTypeChange("individual")}
                    className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-[--radius] border transition-all duration-200 ${
                      accountType === "individual"
                        ? "border-slate-900 border border-border bg-muted text-foreground shadow-lg"
                        : "border-border bg-transparent text-muted-foreground hover:border-foreground/20 hover:bg-muted"
                    }`}
                  >
                    <User
                      weight={accountType === "individual" ? "fill" : "regular"}
                      className={`w-6 h-6 ${
                        accountType === "individual"
                          ? "text-white"
                          : "text-muted-foreground"
                      }`}
                    />
                    <span className="text-sm font-semibold">
                      {t("form.accountType.individual.label")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAccountTypeChange("company")}
                    className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-[--radius] border transition-all duration-200 ${
                      accountType === "company"
                        ? "border-slate-900 border border-border bg-muted text-foreground shadow-lg"
                        : "border-border bg-transparent text-muted-foreground hover:border-foreground/20 hover:bg-muted"
                    }`}
                  >
                    <Buildings
                      weight={accountType === "company" ? "fill" : "regular"}
                      className={`w-6 h-6 ${
                        accountType === "company"
                          ? "text-white"
                          : "text-muted-foreground"
                      }`}
                    />
                    <span className="text-sm font-semibold">
                      {t("form.accountType.company.label")}
                    </span>
                  </button>
                </div>
              </div>

              <ElevatedInput
                type="text"
                label={t("form.name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                icon={<User weight="fill" className="w-5 h-5" />}
                required
              />

              <ElevatedInput
                type="email"
                label={t("form.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Envelope weight="fill" className="w-5 h-5" />}
                required
              />

              <ElevatedInput
                type="text"
                label={t("form.verificationToken")}
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value)}
                icon={<LockIcon weight="fill" className="w-5 h-5" />}
                required
                className={`${validateEmail(email) ? "block" : "hidden"}`}
              />
              <Button
                variant="outline-subtle"
                size="sm"
                onClick={async () => {
                  const response = await sendEmailVerification(email);

                  if (response.error) {
                    if (response.code) {
                      setError(tRoot(authErrorTranslationKey(response.code)));
                    } else {
                      setError(t("errors.sendVerificationFailed"));
                    }
                  } else {
                    setLastSentVerificationTime(new Date());
                  }
                }}
                disabled={countdown > 0}
                title={
                  countdown > 0
                    ? t("form.resendVerificationToken.wait", {
                        seconds: countdown,
                      })
                    : t("form.resendVerificationToken.label")
                }
                className={`${
                  validateEmail(email) ? "inline-flex" : "hidden"
                } mt-2`}
              />

              {accountType === "individual" ? (
                <ElevatedInput
                  type="text"
                  label={t("form.cpf")}
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  icon={
                    <IdentificationCard weight="fill" className="w-5 h-5" />
                  }
                  inputMode="numeric"
                  maxLength={14}
                  required
                />
              ) : null}

              {accountType === "company" ? (
                <ElevatedInput
                  type="text"
                  label={t("form.cnpj")}
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                  icon={
                    <IdentificationCard weight="fill" className="w-5 h-5" />
                  }
                  inputMode="numeric"
                  maxLength={18}
                  required
                />
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ElevatedInput
                  type="password"
                  label={t("form.password")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  onFocus={() => setShowPasswordRules(true)}
                  icon={<Lock weight="fill" className="w-5 h-5" />}
                  error={passwordError || undefined}
                  required
                />

                <ElevatedInput
                  type="password"
                  label={t("form.confirmPassword")}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError("");
                  }}
                  icon={<Lock weight="fill" className="w-5 h-5" />}
                  error={confirmPasswordError || undefined}
                  required
                />
              </div>

              {/*
                Live password requirements checklist. Shown as soon as the
                user focuses the password field (or after a failed submit)
                so the rules backend will enforce are NEVER a surprise.
                Each rule flips green with a check / red with an x as the
                user types. Keeps the design rules: solid-color icon
                wrapper + white icon, no same-hue-on-tinted-bg.
              */}
              {(showPasswordRules || password.length > 0) && (
                <ul
                  aria-label={tRoot("auth.password.requirementsLabel")}
                  className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 text-xs"
                >
                  {(
                    [
                      ["length", "auth.password.rules.length"],
                      ["upper", "auth.password.rules.upper"],
                      ["lower", "auth.password.rules.lower"],
                      ["digit", "auth.password.rules.digit"],
                    ] as const
                  ).map(([rule, key]) => {
                    const ok = passwordRules[rule];
                    return (
                      <li
                        key={rule}
                        className={`flex items-center gap-2 ${
                          ok
                            ? "text-healthy-ink"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-white ${
                            ok
                              ? "bg-muted"
                              : "bg-muted"
                          }`}
                        >
                          {ok ? (
                            <Check weight="bold" className="h-2.5 w-2.5" />
                          ) : (
                            <X weight="bold" className="h-2.5 w-2.5" />
                          )}
                        </span>
                        <span>{tRoot(key)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex items-start gap-3 p-3 bg-muted rounded-[--radius] border border-border">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) =>
                    setAcceptTerms(checked as boolean)
                  }
                  className="mt-0.5 shrink-0"
                />
                <label
                  htmlFor="terms"
                  className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                >
                  {t("form.terms.prefix")}{" "}
                  <Link
                    href="/terms-of-service"
                    className="text-foreground font-semibold hover:text-warning-ink transition-colors"
                  >
                    {t("form.terms.termsLink")}
                  </Link>{" "}
                  {t("form.terms.middle")}{" "}
                  <Link
                    href="/privacy-policy"
                    className="text-foreground font-semibold hover:text-warning-ink transition-colors"
                  >
                    {t("form.terms.privacyLink")}
                  </Link>
                </label>
              </div>

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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-4 text-sm text-muted-foreground font-medium">
                  {t("login.text")}
                </span>
              </div>
            </div>

            <Button
              variant="outline-subtle"
              size="lg"
              link={
                searchParams.toString()
                  ? `/login?${searchParams.toString()}`
                  : "/login"
              }
              newTab={false}
              title={t("login.link")}
              icon={<ArrowRight weight="bold" className="w-4 h-4" />}
              iconVisible
              iconSide="right"
              className="w-full"
            />
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
