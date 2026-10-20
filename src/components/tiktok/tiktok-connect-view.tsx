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
import { useWorkspace } from "@/contexts/workspace-context";
import { useTiktokConnect } from "@/hooks/use-tiktok-connect";
import { TIKTOK_RESOURCE } from "@/lib/tiktok/channel";
import { TIKTOK_ACCOUNTS_PATH, TIKTOK_CONNECT_FACTS, TIKTOK_CONNECT_PATH, tiktokAccountPath } from "@/lib/tiktok/connect";
import type { TiktokConnectResult } from "@/lib/tiktok/types";

import { TiktokLogoColor } from "./tiktok-logo";
import { useTiktokRedirectResult } from "./use-tiktok-redirect-result";

export function TiktokConnectView() {
  const t = useTranslations("tiktok.connect");
  const tError = useTranslations("tiktok.connectError");
  const tc = useTranslations("channels.connect");
  const router = useRouter();
  const { can } = useWorkspace();
  const allowed = can(TIKTOK_RESOURCE, "create");

  const [result, setResult] = useState<TiktokConnectResult | null>(null);
  const handleResult = useCallback((outcome: TiktokConnectResult) => {
    setResult(outcome.status === "cancelled" ? null : outcome);
  }, []);
  const { connect, isConnecting } = useTiktokConnect(handleResult);
  useTiktokRedirectResult(TIKTOK_CONNECT_PATH, handleResult);

  useEffect(() => {
    if (!allowed) router.replace(TIKTOK_ACCOUNTS_PATH);
  }, [allowed, router]);

  if (!allowed) return null;

  const done = result?.status === "connected" || result?.status === "reconnected";
  const failed = result?.status === "error";

  const facts = TIKTOK_CONNECT_FACTS.map((fact) => ({ term: t(`facts.${fact}.term`), detail: t(`facts.${fact}.detail`) }));

  return (
    <ConnectShell>
      <ConnectBlock>
        <Button
          variant="ghost"
          title={t("back")}
          icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push(TIKTOK_ACCOUNTS_PATH)}
        />
      </ConnectBlock>

      <ConnectIdentity logo={<TiktokLogoColor className="h-7 w-7" />} title={t("title")} lead={t("lead")} />

      {done && result ? (
        <ConnectResult
          status="success"
          title={result.status === "reconnected" ? t("reconnectedTitle") : t("successTitle")}
          body={result.username ? t("resultBody", { name: result.username }) : t("resultBodyUnnamed")}
          details={result.username ? [{ label: t("account"), value: `@${result.username}` }] : undefined}
          actions={
            <>
              <Button variant="primary" title={tc("goToInbox")} onClick={() => router.push("/dashboard/live-chat")} />
              {result.accountId ? (
                <Button variant="outline-subtle" title={t("viewAccount")} onClick={() => router.push(tiktokAccountPath(result.accountId ?? ""))} />
              ) : null}
              <Button variant="outline-subtle" title={t("viewAccounts")} onClick={() => router.push(TIKTOK_ACCOUNTS_PATH)} />
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
            <ConnectTrackStep index={1} title={t("eligibilityTitle")} text={t("eligibilityText")} />
            <ConnectTrackStep index={2} title={t("prepareTitle")} text={t("prepareText")}>
              <div className="space-y-3">
                <ConnectNotice tone="warn">
                  <p className="font-medium">{t("openMessagesTitle")}</p>
                  <p className="text-muted-foreground">{t("openMessagesText")}</p>
                </ConnectNotice>
                <ConnectNotice tone="warn">
                  <p className="font-medium">{t("keywordRepliesTitle")}</p>
                  <p className="text-muted-foreground">{t("keywordRepliesText")}</p>
                </ConnectNotice>
              </div>
            </ConnectTrackStep>
            <ConnectTrackStep index={3} isAction isLast title={t("actionTitle")}>
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
                    onClick={() => connect(TIKTOK_CONNECT_PATH)}
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
