"use client";

import { ArrowLeft, ArrowSquareOut, Lock } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

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
import { InstagramLogoColor } from "@/components/icons/channel-logos";
import { useInstagramConnect } from "@/hooks/use-instagram-connect";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * Connecting an Instagram account: a handoff flow.
 *
 * The operator does exactly two things here. They confirm the account
 * qualifies, which is real work that may send them into the Instagram app, and
 * they launch. Everything after that happens inside Meta's window.
 *
 * The previous version described it as three steps and then placed the connect
 * button ABOVE them, in the hero, so the only control on the page came before
 * the sentence explaining that the account has to be a professional one first.
 * That ordering is the single biggest source of "connected but no messages
 * arrive": the prerequisite was readable only after the decision was made.
 */
export default function ConnectInstagramPage() {
  const t = useTranslations("instagram");
  const tc = useTranslations("channels.connect");
  const router = useRouter();
  const { toast } = useToast();
  const { can } = useWorkspace();

  const [result, setResult] = useState<{
    status: string;
    username?: string;
    reason?: string;
  } | null>(null);

  const { connect, isConnecting } = useInstagramConnect((outcome) => {
    if (outcome.status === "cancelled") {
      setResult(null);
      return;
    }
    setResult(outcome);

    if (outcome.status === "error") {
      toast({
        title: t("connect.errorTitle"),
        description: t(`connectError.${outcome.reason ?? "connect_failed"}`),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: t("connect.successTitle"),
      description: outcome.username
        ? t(
            outcome.status === "reconnected"
              ? "notice.reconnected"
              : "notice.connected",
            { username: outcome.username },
          )
        : t("notice.connectedGeneric"),
    });
  });

  // Permission is enforced server-side too; this just avoids showing a flow the
  // user cannot finish.
  useEffect(() => {
    if (!can("instagram_accounts", "create")) {
      router.replace("/dashboard/instagram-accounts");
    }
  }, [can, router]);

  if (!can("instagram_accounts", "create")) {
    return null;
  }

  const isSuccess =
    result?.status === "connected" || result?.status === "reconnected";
  const isError = result?.status === "error";

  const facts = [
    {
      term: t("connect.features.messages.title"),
      detail: t("connect.features.messages.description"),
    },
    {
      term: t("connect.features.posts.title"),
      detail: t("connect.features.posts.description"),
    },
    {
      term: t("connect.features.secure.title"),
      detail: t("connect.features.secure.description"),
    },
  ];

  return (
    <ConnectShell>
      <ConnectBlock>
        <Button
          variant="ghost"
          title={t("profile.back")}
          icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push("/dashboard/instagram-accounts")}
        />
      </ConnectBlock>

      <ConnectIdentity
        logo={<InstagramLogoColor className="h-7 w-7" />}
        title={t("connect.title")}
        lead={t("connect.description")}
      />

      {isSuccess ? (
        <ConnectResult
          status="success"
          title={t("connect.successTitle")}
          body={t("connect.resultBody")}
          details={
            result?.username
              ? [{ label: t("connect.detailAccount"), value: `@${result.username}` }]
              : undefined
          }
          actions={
            <>
              <Button
                variant="primary"
                title={tc("goToInbox")}
                onClick={() => router.push("/dashboard/live-chat")}
              />
              <Button
                variant="outline-subtle"
                title={t("connect.viewAccounts")}
                onClick={() => router.push("/dashboard/instagram-accounts")}
              />
            </>
          }
        />
      ) : isError ? (
        <ConnectResult
          status="error"
          title={t("connect.errorTitle")}
          body={t(`connectError.${result?.reason ?? "connect_failed"}`)}
          actions={
            <Button
              variant="primary"
              title={tc("tryAgain")}
              onClick={() => setResult(null)}
            />
          }
        />
      ) : (
        <ConnectPanel>
          <ConnectTrack>
            {/* First, because it is the one thing that can send the operator
                away before they are able to finish. */}
            <ConnectTrackStep
              index={1}
              title={t("connect.prerequisite.title")}
              text={t("connect.prerequisite.description")}
            />

            <ConnectTrackStep
              index={2}
              isAction
              isLast
              title={t("connect.actionTitle")}
            >
              <div className="space-y-4">
                <ConnectNotice tone="info">{tc("opensWindow")}</ConnectNotice>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    size="lg"
                    title={
                      isConnecting
                        ? t("connect.cta.redirecting")
                        : t("connect.cta.button")
                    }
                    icon={<ArrowSquareOut weight="bold" className="h-4 w-4" />}
                    iconVisible
                    iconSide="right"
                    disabled={isConnecting}
                    onClick={() => connect("/dashboard/instagram-accounts")}
                    className="w-full sm:w-auto sm:px-10"
                  />
                  <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                    <Lock weight="bold" className="size-3" />
                    OAuth 2.0
                  </span>
                </div>

                {/* What the window will ask for, so the operator recognises the
                    screens instead of guessing whether they are on the right
                    one. */}
                <ul className="max-w-prose space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  <li>{t("connect.steps.step1")}</li>
                  <li>{t("connect.steps.step2")}</li>
                  <li>{t("connect.steps.step3")}</li>
                </ul>
              </div>
            </ConnectTrackStep>
          </ConnectTrack>
        </ConnectPanel>
      )}

      {!isSuccess && !isError && (
        <ConnectSupporting>
          <ConnectFacts title={t("connect.features.title")} items={facts} />
        </ConnectSupporting>
      )}
    </ConnectShell>
  );
}
