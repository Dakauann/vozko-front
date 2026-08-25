"use client";

import {
  Buildings,
  CheckCircle,
  SignIn,
  WarningCircle,
  XCircle,
} from "@/components/icons";
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";
import { acceptInviteAction } from "@/app/actions/workspace";
import { CircuitTraces } from "@/components/brand/circuit";
import { useAuth } from "@/contexts/auth-context";
import { useTranslations } from "next-intl";

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}

type InviteState =
  | "checking"
  | "not-authenticated"
  | "no-token"
  | "accepting"
  | "accepted"
  | "error";

function InviteContent() {
  const t = useTranslations("invitePage");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<InviteState>("checking");
  const [error, setError] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [isPending, startTransition] = useTransition();

  const token = searchParams.get("token");

  const currentPath =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : `/invite?token=${token ?? ""}`;

  const handleAccept = useCallback(async () => {
    if (!token) return;
    setState("accepting");
    setError("");

    const result = await acceptInviteAction(token);
    if (result.error) {
      setError(result.error);
      setState("error");
      return;
    }

    setState("accepted");
    setTimeout(() => {
      startTransition(() => {
        router.push("/dashboard");
        router.refresh();
      });
    }, 2000);
  }, [token, router, startTransition]);

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setState("no-token");
      return;
    }

    if (!isAuthenticated) {
      setState("not-authenticated");
      return;
    }

    handleAccept();
  }, [authLoading, isAuthenticated, token, handleAccept]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted px-4">
      <CircuitTraces className="pointer-events-none absolute -right-12 -top-10 hidden h-80 w-80 sm:block xl:h-96 xl:w-96" />
      <div
        className="relative w-full max-w-md"
      >
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          {/* Logo/Brand */}
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow-sm">
              <Buildings className="h-8 w-8" weight="fill" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold tracking-[0.01em] text-foreground">
              {t("title")}
            </h1>
          </div>

          {/* Checking / Loading */}
          {(state === "checking" || authLoading) && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-8 w-8 animate-spin rounded-full border border-border-strong border-t-transparent" />
              <p className="text-sm text-muted-foreground">{t("checking")}</p>
            </div>
          )}

          {/* No token provided */}
          {state === "no-token" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning text-warning-foreground">
                <WarningCircle className="h-6 w-6" weight="fill" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{t("noToken")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("noTokenDescription")}
                </p>
              </div>
              <Link
                href="/dashboard/workspace/invites"
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {t("viewInvites")}
              </Link>
            </div>
          )}

          {/* Not authenticated */}
          {state === "not-authenticated" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <SignIn className="h-6 w-6" weight="fill" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">
                  {t("loginRequired")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("loginRequiredDescription")}
                </p>
              </div>
              <div className="mt-2 flex w-full flex-col gap-2">
                <Link
                  href={`/login?redirect=${encodeURIComponent(currentPath)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <SignIn className="h-4 w-4" weight="bold" />
                  {t("login")}
                </Link>
                <Link
                  href={`/register?redirect=${encodeURIComponent(currentPath)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {t("createAccount")}
                </Link>
              </div>
            </div>
          )}

          {/* Accepting */}
          {state === "accepting" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-8 w-8 animate-spin rounded-full border border-border-strong border-t-transparent" />
              <p className="text-sm text-muted-foreground">{t("accepting")}</p>
            </div>
          )}

          {/* Accepted */}
          {state === "accepted" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-healthy text-healthy-foreground">
                <CheckCircle className="h-6 w-6" weight="fill" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{t("accepted")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("redirecting")}
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                <XCircle className="h-6 w-6" weight="fill" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{t("error")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleAccept}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {t("tryAgain")}
                </button>
                <Link
                  href="/dashboard/workspace/invites"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {t("viewInvites")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
