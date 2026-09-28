"use client";

import { ArrowLeft, ArrowSquareOut, Lock } from "@/components/icons";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
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
import { FacebookLogoColor } from "@/components/icons/channel-logos";
import { useWorkspace } from "@/contexts/workspace-context";
import { useFacebookConnect } from "@/hooks/use-facebook-connect";
import { FACEBOOK_PAGES_PATH } from "@/lib/facebook/connect";
import type { FacebookConnectResult, FacebookPageConnectOutcome } from "@/lib/facebook/types";

export default function ConnectFacebookPage() {
  const t = useTranslations("facebook");
  const tc = useTranslations("channels.connect");
  const router = useRouter();
  const { can } = useWorkspace();
  const allowed = can("facebook_pages", "create");

  const [result, setResult] = useState<FacebookConnectResult | null>(null);
  const { connect, isConnecting } = useFacebookConnect((outcome) => {
    setResult(outcome.status === "cancelled" ? null : outcome);
  });

  useEffect(() => {
    if (!allowed) router.replace(FACEBOOK_PAGES_PATH);
  }, [allowed, router]);

  if (!allowed) return null;

  const outcomeText = (page: FacebookPageConnectOutcome) => {
    const parts = [t(`connect.outcome.${page.outcome}`)];
    if (page.missing.length > 0) parts.push(t("connect.outcome.missing", { items: page.missing.join(", ") }));
    if (page.warning) parts.push(t("connect.outcome.warning"));
    return parts.join(". ");
  };

  const isError = result?.status === "error";
  const isDone = result?.status === "connected" || result?.status === "partial";

  const facts = [
    { term: t("connect.features.messages.title"), detail: t("connect.features.messages.description") },
    { term: t("connect.features.posts.title"), detail: t("connect.features.posts.description") },
    { term: t("connect.features.secure.title"), detail: t("connect.features.secure.description") },
  ];

  return (
    <ConnectShell>
      <ConnectBlock>
        <Button
          variant="ghost"
          title={t("page.back")}
          icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push(FACEBOOK_PAGES_PATH)}
        />
      </ConnectBlock>

      <ConnectIdentity
        logo={<FacebookLogoColor className="h-7 w-7" />}
        title={t("connect.title")}
        lead={t("connect.description")}
      />

      {isDone ? (
        <ConnectResult
          status={result.status === "connected" ? "success" : "error"}
          title={result.status === "connected" ? t("connect.successTitle") : t("connect.partialTitle")}
          body={t("connect.resultBody")}
          details={(result.pages ?? []).map((page) => ({
            label: page.name || page.fbPageId,
            value: outcomeText(page),
          }))}
          actions={
            <>
              <Button variant="primary" title={tc("goToInbox")} onClick={() => router.push("/dashboard/live-chat")} />
              <Button variant="outline-subtle" title={t("connect.viewPages")} onClick={() => router.push(FACEBOOK_PAGES_PATH)} />
              {result.status === "partial" ? (
                <Button variant="outline-subtle" title={tc("tryAgain")} onClick={() => setResult(null)} />
              ) : null}
            </>
          }
        />
      ) : isError ? (
        <ConnectResult
          status="error"
          title={t("connect.errorTitle")}
          body={t(`connectError.${result?.reason ?? "connect_failed"}`)}
          actions={<Button variant="primary" title={tc("tryAgain")} onClick={() => setResult(null)} />}
        />
      ) : (
        <ConnectPanel>
          <ConnectTrack>
            <ConnectTrackStep index={1} title={t("connect.portfolio.title")} text={t("connect.portfolio.description")} />
            <ConnectTrackStep index={2} title={t("connect.pagesOnly.title")} text={t("connect.pagesOnly.description")} />
            <ConnectTrackStep index={3} isAction title={t("connect.actionTitle")}>
              <div className="space-y-4">
                <ConnectNotice tone="info">{tc("opensWindow")}</ConnectNotice>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    size="lg"
                    title={isConnecting ? t("connect.cta.redirecting") : t("connect.cta.button")}
                    icon={<ArrowSquareOut weight="bold" className="h-4 w-4" />}
                    iconVisible
                    iconSide="right"
                    disabled={isConnecting}
                    onClick={() => connect(FACEBOOK_PAGES_PATH)}
                    className="w-full sm:w-auto sm:px-10"
                  />
                  <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                    <Lock weight="bold" className="size-3" />
                    OAuth 2.0
                  </span>
                </div>
                <ul className="max-w-prose space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  <li>{t("connect.steps.step1")}</li>
                  <li>{t("connect.steps.step2")}</li>
                  <li>{t("connect.steps.step3")}</li>
                </ul>
              </div>
            </ConnectTrackStep>
            <ConnectTrackStep index={4} isLast title={t("connect.defaultApp.title")}>
              <ConnectNotice tone="warn">{t("connect.defaultApp.description")}</ConnectNotice>
              <p className="mt-2 text-sm text-muted-foreground">{t("connect.profileTip")}</p>
            </ConnectTrackStep>
          </ConnectTrack>
        </ConnectPanel>
      )}

      {!isDone && !isError && (
        <ConnectSupporting>
          <ConnectFacts title={t("connect.features.title")} items={facts} />
        </ConnectSupporting>
      )}
    </ConnectShell>
  );
}
