"use client";

import { WarningCircle } from "@/components/icons";
import { logout as logoutRequest } from "@/lib/auth/auth-api";
import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Shown by the dashboard layout when resolveServerSession() returns a
 * serverError (transient 5xx / network failure). Redirecting to /login
 * in that state risks a bounce back if the proxy still sees valid cookies,
 * so this is the deliberate off-ramp: it stops the loop and gives the user
 * an explicit retry, plus a logout escape that clears cookies so they can
 * re-authenticate.
 */
export default function SessionUnavailable() {
  const t = useTranslations("sessionUnavailable");
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[--radius] bg-warning/10 ring-1 ring-warning/20">
        <WarningCircle className="h-7 w-7 text-warning" weight="fill" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-[--radius] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          {t("retry")}
        </button>
        <button
          type="button"
          disabled={loggingOut}
          onClick={async () => {
            setLoggingOut(true);
            try {
              await logoutRequest();
            } catch {
              /* best-effort: navigate to login regardless */
            }
            window.location.href = "/login";
          }}
          className="rounded-[--radius] border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
        >
          {t("logout")}
        </button>
      </div>
    </div>
  );
}
