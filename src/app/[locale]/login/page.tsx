"use client";

import { Envelope, Lock } from "@/components/icons";
import { Link } from "@/i18n/routing";
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";

import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { CircuitTraces, DotMatrix } from "@/components/brand/circuit";
import { LightPool } from "@/components/brand/light-pool";
import { BrandLogo } from "@/components/brand-logo";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { authErrorTranslationKey } from "@/lib/auth/error-codes";
import { getBrand } from "@/config/brand";
import { locales } from "@/i18n/config";
import { login as loginRequest } from "@/lib/auth/auth-api";
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
  const { refreshUser, isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

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
    /*
      The access plate.
      
      This was a floating rounded card on the left and a near-black marketing
      slab on the right — two visual worlds on one screen, and the slab sold a
      product to someone who has already bought it. There is no marketing site
      behind it either: `/` redirects straight here.
      
      So login is one plate cut into the panel. The brand sits at its head, the
      credentials in a recessed well, one lamp key commits. Nothing enters, moves
      or fades: an operator opening this at the start of a shift should find the
      email field already under the cursor, not wait for a card to settle.
    */
    <main className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden bg-background px-4 py-10 sm:py-16">
      <LightPool />
      {/* The brand's trace lines at the plate's edges — identity surface.
          Token-coloured for both themes; the slow pulse removes itself under
          prefers-reduced-motion. */}
      <CircuitTraces className="pointer-events-none absolute -right-12 -top-12 hidden h-80 w-80 sm:block lg:-right-16 lg:-top-16 lg:h-[30rem] lg:w-[30rem]" />
      <DotMatrix className="pointer-events-none absolute bottom-10 left-8 hidden h-24 w-36 sm:block" />
      <div className="relative w-full max-w-[400px]">
        <div className="well overflow-hidden">
          <div className="rule-engraved flex items-center gap-2.5 px-5 py-3.5">
            <BrandLogo size="sm" />
          </div>

          <div className="px-5 py-6 sm:px-6">
            <h1 className="font-display text-xl font-semibold leading-tight tracking-[0.01em] text-foreground">
              {t("header.title")}
            </h1>
            <p className="mt-1.5 max-w-[46ch] text-sm leading-snug text-muted-foreground">
              {t("header.description")}
            </p>

            {error && (
              <div className="mt-4">
                <AuthFormAlert message={error} />
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-7 space-y-6">
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

              <ElevatedInput
                type="password"
                label={t("form.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="h-4 w-4" />}
                autoComplete="current-password"
                required
                disabled={isPending}
              />

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) =>
                      setRememberMe(checked as boolean)
                    }
                  />
                  <label
                    htmlFor="remember"
                    className="cursor-pointer select-none text-sm text-muted-foreground"
                  >
                    {t("form.rememberMe")}
                  </label>
                </div>
                <Link
                  href="/forgot-password"
                  className="rounded-[--radius] text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("form.forgotPassword")}
                </Link>
              </div>

              {/*
                One commit control, always armed.

                The slide-to-unlock gate that stood here cost the three things
                a daily login owes an operator: Enter in the password field
                submitting the form, focus continuity for keyboard users, and
                autofill from a password manager (which fills without the
                change events the gate armed on). The fields are `required`,
                so native validation guards the empty submit the gate was
                protecting against.
              */}
              <Button
                variant="primary"
                size="lg"
                type="submit"
                className="w-full"
                title={isPending ? t("form.submitting") : t("form.submit")}
                disabled={isPending}
              />
            </form>
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