"use client";

import { ArrowLeft, ArrowSquareOut, Lock } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  ConnectBlock,
  ConnectFacts,
  ConnectIdentity,
  ConnectNotice,
  ConnectPanel,
  ConnectResult,
  ConnectShell,
  ConnectSupporting,
  ConnectTrack,
  ConnectTrackStep,
} from "@/components/channels/connect-layout";
import Button from "@/components/elevated-design/button";
import { MercadoLivreLogoColor } from "@/components/icons/channel-logos";
import { useWorkspace } from "@/contexts/workspace-context";
import { useMercadoLivreConnect } from "@/hooks/use-mercadolivre-connect";
import {
  MERCADOLIVRE_ACCOUNTS_PATH,
  MERCADOLIVRE_CONNECT_FACTS,
  MERCADOLIVRE_CONNECT_PATH,
  mercadoLivreAccountPath,
} from "@/lib/mercadolivre/connect";
import type { MercadoLivreConnectResult } from "@/lib/mercadolivre/types";

import { useConnectRedirectResult } from "./use-connect-redirect-result";

export function MercadoLivreConnectView() {
  const t = useTranslations("mercadolivre.connect");
  const tError = useTranslations("mercadolivre.connectError");
  const tc = useTranslations("channels.connect");
  const router = useRouter();
  const { can } = useWorkspace();
  const allowed = can("mercadolivre_accounts", "create");

  const [result, setResult] = useState<MercadoLivreConnectResult | null>(null);
  const handleResult = useCallback((outcome: MercadoLivreConnectResult) => {
    setResult(outcome.status === "cancelled" ? null : outcome);
  }, []);
  const { connect, isConnecting } = useMercadoLivreConnect(handleResult);
  useConnectRedirectResult(MERCADOLIVRE_CONNECT_PATH, handleResult);

  useEffect(() => {
    if (!allowed) router.replace(MERCADOLIVRE_ACCOUNTS_PATH);
  }, [allowed, router]);

  if (!allowed) return null;

  const done = result?.status === "connected" || result?.status === "reconnected";
  const failed = result?.status === "error";

  const facts = MERCADOLIVRE_CONNECT_FACTS.map((fact) => ({ term: t(`facts.${fact}.term`), detail: t(`facts.${fact}.detail`) }));

  return (
    <ConnectShell>
      <ConnectBlock>
        <Button
          variant="ghost"
          title={t("back")}
          icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push(MERCADOLIVRE_ACCOUNTS_PATH)}
        />
      </ConnectBlock>

      <ConnectIdentity logo={<MercadoLivreLogoColor className="h-7 w-7" />} title={t("title")} lead={t("lead")} />

      {done && result ? (
        <ConnectResult
          status="success"
          title={result.status === "reconnected" ? t("reconnectedTitle") : t("successTitle")}
          body={result.nickname ? t("resultBody", { name: result.nickname }) : t("resultBodyUnnamed")}
          details={result.nickname ? [{ label: t("account"), value: result.nickname }] : undefined}
          actions={
            <>
              <Button variant="primary" title={tc("goToInbox")} onClick={() => router.push("/dashboard/live-chat")} />
              {result.accountId ? (
                <Button variant="outline-subtle" title={t("viewAccount")} onClick={() => router.push(mercadoLivreAccountPath(result.accountId ?? ""))} />
              ) : null}
              <Button variant="outline-subtle" title={t("viewAccounts")} onClick={() => router.push(MERCADOLIVRE_ACCOUNTS_PATH)} />
            </>
          }
        />
      ) : failed && result ? (
        <ConnectResult
          status="error"
          title={t("errorTitle")}
          body={tError(result.reason ?? "connect_failed")}
          actions={<Button variant="primary" title={tc("tryAgain")} onClick={() => setResult(null)} />}
        />
      ) : (
        <ConnectPanel>
          <ConnectTrack>
            <ConnectTrackStep index={1} title={t("adminTitle")} text={t("adminText")} />
            <ConnectTrackStep index={2} isAction isLast title={t("actionTitle")}>
              <div className="space-y-4">
                <ConnectNotice tone="info">{tc("opensWindow")}</ConnectNotice>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    size="lg"
                    title={isConnecting ? t("redirecting") : t("cta")}
                    icon={<ArrowSquareOut weight="bold" className="h-4 w-4" />}
                    iconVisible
                    iconSide="right"
                    disabled={isConnecting}
                    onClick={() => connect(MERCADOLIVRE_CONNECT_PATH)}
                    className="w-full sm:w-auto sm:px-10"
                  />
                  <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                    <Lock weight="bold" className="size-3" />
                    OAuth 2.0
                  </span>
                </div>
              </div>
            </ConnectTrackStep>
          </ConnectTrack>
        </ConnectPanel>
      )}

      {!done && !failed ? (
        <ConnectSupporting>
          <ConnectFacts title={t("factsTitle")} items={facts} />
        </ConnectSupporting>
      ) : null}
    </ConnectShell>
  );
}
