"use client";

import { ArrowRight, Envelope, Lock } from "@phosphor-icons/react";
import { Link, useRouter } from "@/i18n/routing";
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";

import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { BrandLogo } from "@/components/brand-logo";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { authErrorTranslationKey } from "@/lib/auth/error-codes";
import { getBrand } from "@/config/brand";
import { locales } from "@/i18n/config";
import { login as loginRequest } from "@/lib/auth/auth-api";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const localePrefixPattern = new RegExp(`^/(?:${locales.join("|")})(?=/|$)`);

function normalizeInternalPath(pathname: string) {
  const normalizedPath = pathname.replace(localePrefixPattern, "");
  return normalizedPath === "" ? "/" : normalizedPath;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const t = useTranslations("login");
  const tRoot = useTranslations();
  const tCommon = useTranslations("common");
  const tFooter = useTranslations("footerMain");
  const brand = getBrand();
  const { refreshUser, isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isRateLimitError = (message?: string | null) =>
    message?.toLowerCase().includes("rate limit") ?? false;

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        session_expired: t("errors.session_expired"),
        unauthorized: t("errors.unauthorized"),
      };
      const message = errorMessages[errorParam] || errorParam;
      setTimeout(() => setError(message), 0);
    }
  }, [searchParams, t]);

  const buildPostAuthDestination = useCallback(() => {
    if (typeof window === "undefined") {
      return {
        relative: "/dashboard",
        absolute: "/dashboard",
        isExternal: false,
      };
    }

    const origin = window.location.origin;
    const redirectParam = searchParams.get("redirect");
    let targetUrl: URL;
    let isExternalRedirect = false;

    if (redirectParam) {
      try {
        const candidate = new URL(redirectParam, origin);

        // Cross-subdomain redirects are allowed only within the active brand's
        // apex domain (from brand config, not hardcoded). Suffix-match on the
        // hostname, never substring: "brand.com.evil.com" must not pass.
        const brandHost = new URL(getBrand().siteUrl).hostname;
        const isBrandHost = (host: string) =>
          host === brandHost || host.endsWith("." + brandHost);
        const isSameDomain =
          candidate.origin === origin ||
          (isBrandHost(window.location.hostname) &&
            isBrandHost(candidate.hostname));

        if (isSameDomain) {
          if (candidate.origin !== origin) {
            isExternalRedirect = true;
            return {
              relative: candidate.toString(),
              absolute: candidate.toString(),
              isExternal: true,
            };
          }
          targetUrl = candidate;
        } else {
          targetUrl = new URL("/dashboard", origin);
        }
      } catch {
        targetUrl = new URL("/dashboard", origin);
      }
    } else {
      targetUrl = new URL("/dashboard", origin);
    }

    const normalizedPath = normalizeInternalPath(targetUrl.pathname);
    const finalUrl = new URL(
      normalizedPath + targetUrl.search + targetUrl.hash,
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
    return {
      relative,
      absolute: finalUrl.toString(),
      isExternal: isExternalRedirect,
    };
  }, [searchParams]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const destination = buildPostAuthDestination();
    if (destination.isExternal) {
      window.location.href = destination.absolute;
    } else {
      window.location.assign(destination.relative);
    }
  }, [isLoading, isAuthenticated, buildPostAuthDestination]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await loginRequest(email, password);

      if (result.error) {
        if (result.statusCode === 429 || isRateLimitError(result.error)) {
          setError(tCommon("rateLimit"));
          return;
        }

        if (result.code) {
          setError(tRoot(authErrorTranslationKey(result.code)));
          return;
        }

        switch (result.statusCode) {
          case 400:
            setError(t("errors.invalid_request"));
            break;
          case 401:
            setError(t("errors.invalid_credentials"));
            break;
          case 403:
            setError(t("errors.account_inactive"));
            break;
          case 409:
            setError(t("errors.email_exists"));
            break;
          default:
            setError(tRoot("auth.errors.generic"));
        }
      } else if (result.success) {
        setEmail("");
        setPassword("");
        setError("");

        await refreshUser(true);
        const destination = buildPostAuthDestination();

        if (destination.isExternal) {
          window.location.href = destination.absolute;
        } else {
          window.location.assign(destination.relative);
        }
      }
    });
  };

  return (
    <div className="min-h-screen overflow-x-hidden pt-16 sm:pt-20 bg-background">
      <div className="flex min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)]">
        {/* Left: Login form, centered */}
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-[440px] relative z-10"
          >
            <div
              className="rounded-2xl sm:rounded-[28px] bg-card p-6 sm:p-8 border border-border"
              style={{
                boxShadow:
                  "0 4px 40px -12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.02)",
              }}
            >
              <div className="mb-8 text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center rounded-full bg-muted border border-border px-4 py-1.5 text-xs font-semibold uppercase text-muted-foreground mb-4"
                >
                  {t("header.badge")}
                </motion.div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">
                  {t("header.title")}
                </h1>
                <p className="mt-3 text-muted-foreground text-[15px]">
                  {t("header.description")}
                </p>
              </div>

              {error && <AuthFormAlert message={error} />}

              <form onSubmit={handleLogin} className="space-y-5">
                <ElevatedInput
                  type="email"
                  label={t("form.email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Envelope weight="fill" className="w-5 h-5" />}
                  required
                  disabled={isPending}
                />

                <ElevatedInput
                  type="password"
                  label={t("form.password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock weight="fill" className="w-5 h-5" />}
                  required
                  disabled={isPending}
                />

                <div className="flex items-center justify-between text-sm pt-1">
                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) =>
                        setRememberMe(checked as boolean)
                      }
                    />
                    <label
                      htmlFor="remember"
                      className="text-muted-foreground cursor-pointer select-none font-medium"
                    >
                      {t("form.rememberMe")}
                    </label>
                  </div>
                  <Link
                    href="/forgot-password"
                    className="text-foreground hover:text-primary font-semibold transition-colors"
                  >
                    {t("form.forgotPassword")}
                  </Link>
                </div>

                <div className="pt-2">
                  <Button
                    variant="main-cta"
                    size="lg"
                    type="submit"
                    className="w-full"
                    title={isPending ? t("form.submitting") : t("form.submit")}
                    disabled={isPending}
                    icon={<ArrowRight weight="bold" className="w-5 h-5" />}
                    iconVisible
                    iconSide="right"
                  />
                </div>
              </form>
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

        {/* Right: distinctive brand panel (replaces the recognizable CRM showcase) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[#0b0d12] px-10 py-14 lg:flex xl:w-[50%] xl:px-16 xl:py-16"
        >
          {/* quiet geometric accents (neutral outlines) */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-28 -top-24 h-80 w-80 rounded-full border border-white/[0.06]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-16 bottom-24 h-44 w-44 rounded-full border border-white/[0.06]"
          />

          <div className="relative">
            <BrandLogo useWhite size="lg" />
          </div>

          <div className="relative max-w-md">
            <p className="text-2xl font-semibold leading-snug text-white xl:text-[28px]">
              {tFooter("description")}
            </p>
          </div>

          <p className="relative text-xs text-white/35">
            © {new Date().getFullYear()} {brand.legalName}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
