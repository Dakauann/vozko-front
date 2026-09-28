"use client";

import { ArrowClockwise, ShieldWarning, Warning } from "@/components/icons";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getFacebookThreadStateAction, takeFacebookThreadControlAction } from "@/app/actions/facebook";
import { facebookErrorKey } from "@/lib/facebook/errors";
import type { FacebookThreadState } from "@/lib/facebook/types";
import { cn } from "@/lib/utils";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; thread: FacebookThreadState }
  | { status: "failed"; message: string };

export function FacebookThreadBanner({ entryId, canSend }: { entryId: string; canSend: boolean }) {
  const t = useTranslations("facebook.thread");
  const tf = useTranslations("facebook");
  const [loaded, setLoaded] = useState<{ entryId: string; state: LoadState } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [taking, setTaking] = useState(false);
  const [takeError, setTakeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getFacebookThreadStateAction(entryId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        const key = facebookErrorKey(result.code);
        setLoaded({ entryId, state: { status: "failed", message: key ? tf(key) : result.error } });
        return;
      }
      if (!result.thread) {
        setLoaded({ entryId, state: { status: "failed", message: t("unknown") } });
        return;
      }
      setLoaded({ entryId, state: { status: "ready", thread: result.thread } });
    });
    return () => {
      cancelled = true;
    };
  }, [entryId, reloadKey, t, tf]);

  const state: LoadState = loaded?.entryId === entryId ? loaded.state : { status: "loading" };

  if (state.status === "loading") return null;

  if (state.status === "failed") {
    return (
      <Banner tone="muted">
        <span className="min-w-0 flex-1 truncate">{t("loadFailed", { error: state.message })}</span>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-foreground hover:bg-muted"
        >
          <ArrowClockwise className="h-3 w-3" />
          {t("retry")}
        </button>
      </Banner>
    );
  }

  if (state.thread.holder === "vozko") return null;

  const takeOver = async () => {
    setTaking(true);
    setTakeError(null);
    const result = await takeFacebookThreadControlAction(entryId);
    setTaking(false);
    if ("error" in result) {
      const key = facebookErrorKey(result.code);
      setTakeError(key ? tf(key) : result.error);
      return;
    }
    setReloadKey((k) => k + 1);
  };

  return (
    <Banner tone="warn">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">
          {state.thread.holder === "meta_business_suite" ? t("heldByBusinessSuite") : t("heldByOtherApp")}
        </p>
        <p className="text-muted-foreground">{canSend ? t("takeOverHint") : t("noPermission")}</p>
        {takeError ? <p className="mt-0.5 text-destructive-ink">{takeError}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => void takeOver()}
        disabled={!canSend || taking}
        className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        {taking ? t("takingOver") : t("takeOver")}
      </button>
    </Banner>
  );
}

function Banner({ tone, children }: { tone: "warn" | "muted"; children: React.ReactNode }) {
  const Icon = tone === "warn" ? ShieldWarning : Warning;
  return (
    <div className="flex justify-center px-4 pt-2">
      <div className="flex w-full max-w-[92%] items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-2 text-2xs shadow-md">
        <Icon
          weight="fill"
          className={cn("h-4 w-4 flex-shrink-0", tone === "warn" ? "text-warning-ink" : "text-muted-foreground")}
        />
        {children}
      </div>
    </div>
  );
}
