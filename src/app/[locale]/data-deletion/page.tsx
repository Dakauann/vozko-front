"use client";

import { CheckCircle, CircleNotch, Clock, WarningCircle, XCircle } from "@/components/icons";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { getDataDeletionStatusAction } from "@/app/actions/meta-platform";
import type { DataDeletionRequest } from "@/lib/facebook/types";

type LoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "failed"; message: string }
  | { status: "ready"; request: DataDeletionRequest };

export default function DataDeletionPage() {
  return (
    <Suspense fallback={<Shell><Loading /></Shell>}>
      <DataDeletionStatus />
    </Suspense>
  );
}

function DataDeletionStatus() {
  const t = useTranslations("facebook.dataDeletion");
  const code = useSearchParams().get("code") ?? "";
  const [loaded, setLoaded] = useState<{ code: string; state: LoadState } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getDataDeletionStatusAction(code).then((result) => {
      if (cancelled) return;
      if ("request" in result) setLoaded({ code, state: { status: "ready", request: result.request } });
      else if ("notFound" in result) setLoaded({ code, state: { status: "notFound" } });
      else setLoaded({ code, state: { status: "failed", message: result.error } });
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const state: LoadState = loaded?.code === code ? loaded.state : { status: "loading" };

  return (
    <Shell>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("description")}</p>

      <div className="mt-8 rounded-[--radius] border border-border bg-card p-6 shadow-sm">
        {state.status === "loading" ? (
          <Loading />
        ) : state.status === "notFound" ? (
          <Row icon={<WarningCircle weight="fill" className="h-6 w-6 text-warning-ink" />} title={t("notFoundTitle")} body={t("notFoundBody")} />
        ) : state.status === "failed" ? (
          <Row
            icon={<XCircle weight="fill" className="h-6 w-6 text-destructive-ink" />}
            title={t("errorTitle")}
            body={t("errorBody", { error: state.message })}
          />
        ) : (
          <RequestStatus request={state.request} />
        )}
      </div>
    </Shell>
  );
}

function RequestStatus({ request }: { request: DataDeletionRequest }) {
  const t = useTranslations("facebook.dataDeletion");
  const icon =
    request.status === "COMPLETED" ? (
      <CheckCircle weight="fill" className="h-6 w-6 text-healthy-ink" />
    ) : request.status === "FAILED" ? (
      <XCircle weight="fill" className="h-6 w-6 text-destructive-ink" />
    ) : (
      <Clock weight="fill" className="h-6 w-6 text-warning-ink" />
    );

  return (
    <div className="space-y-5">
      <Row icon={icon} title={t(`status.${request.status}`)} body={t(`statusBody.${request.status}`)} />
      <dl className="grid gap-3 rounded-[--radius] bg-muted px-4 py-3 text-sm sm:grid-cols-3">
        <Detail label={t("code")} value={request.code} mono />
        <Detail label={t("requestedAt")} value={new Date(request.requestedAt).toLocaleString()} />
        {request.completedAt ? <Detail label={t("completedAt")} value={new Date(request.completedAt).toLocaleString()} /> : null}
      </dl>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[70vh] bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-xl">{children}</div>
    </main>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-6 text-muted-foreground">
      <CircleNotch className="h-6 w-6 animate-spin" />
    </div>
  );
}

function Row({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-0.5 break-all font-mono text-xs text-foreground" : "mt-0.5 text-foreground"}>{value}</dd>
    </div>
  );
}
