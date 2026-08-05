"use client";

import { ArrowLeft, ArrowSquareOut, Lock } from "@/components/icons";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
} from "@/components/channels/connect-layout";
import { WhatsAppLogoColor } from "@/components/icons/channel-logos";
import WhatsAppCapacityCard from "@/components/dashboard/addons/WhatsAppCapacityCard";
import { useWhatsAppCapacity } from "@/hooks/use-whatsapp-capacity";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * Connecting a WhatsApp business phone: a handoff flow with a quota in front of
 * it.
 *
 * Capacity is the reason this page has a numbered rail at all. An operator with
 * no free slot cannot finish no matter how well the rest is explained, so
 * remaining capacity is stop one, ahead of the control it governs. The previous
 * version showed the same card but placed it above a hero that itself sat above
 * the steps, so the gate, the explanation and the action were three unrelated
 * blocks scrolling past each other.
 */
export default function ConnectWhatsAppPage() {
  const t = useTranslations("whatsappBusinessPhones");
  const tc = useTranslations("channels.connect");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentWorkspace, can } = useWorkspace();
  const capacity = useWhatsAppCapacity();
  // Blocked = we know for certain there is no free slot. Loading stays permissive
  // (the button is disabled meanwhile) so we never flash a false gate.
  const capacityBlocked = capacity.ready && !capacity.canAdd;
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [popupConnected, setPopupConnected] = useState(false);
  const badgeSrc =
    resolvedTheme === "dark"
      ? "/images/partners/meta-business-partner-two-line-dark.svg"
      : "/images/partners/meta-business-partner-two-line-light.svg";

  useEffect(() => {
    if (user && !can("business_phones", "create")) {
      router.replace("/dashboard/whatsapp-business-phones");
    }
  }, [user, can, router]);

  const status = searchParams.get("status");
  const phoneId = searchParams.get("phone_id");
  const wabaId = searchParams.get("waba_id");

  const isSuccess = popupConnected || Boolean(status === "success" && phoneId && wabaId);
  const isError = status === "error";

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: t("connect.success.toastTitle"),
        description: t("connect.success.toastDescription"),
      });
    } else if (isError) {
      toast({
        title: t("connect.error.toastTitle"),
        description: t("connect.error.toastDescription"),
        variant: "destructive",
      });
    }
  }, [isSuccess, isError, toast, t]);

  const apiBaseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
  }, []);

  const handleConnect = () => {
    // Capacity gate: never launch Embedded Signup when there is no free slot. The
    // UI already shows the buy CTA; this guards a stale click.
    if (capacityBlocked) {
      return;
    }
    if (!currentWorkspace?.id) {
      toast({
        title: t("connect.error.toastTitle"),
        description: t("connect.noWorkspace"),
        variant: "destructive",
      });
      return;
    }

    const currentUrl = window.location.origin + window.location.pathname;
    const signupUrl = `${apiBaseUrl}/oauth/meta/embedded?workspace_id=${encodeURIComponent(currentWorkspace.id)}&redirect_url=${encodeURIComponent(currentUrl)}`;

    // Open the Embedded Signup in a centered popup so the dashboard stays put.
    // The popup posts its result back and closes; if it's blocked we fall back
    // to a full-page redirect.
    const w = 520;
    const h = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(
      signupUrl,
      "wa-embedded",
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );

    if (!popup) {
      setIsRedirecting(true);
      window.location.href = signupUrl;
      return;
    }

    setIsRedirecting(true);

    let apiOrigin = "";
    try {
      apiOrigin = new URL(apiBaseUrl).origin;
    } catch {
      apiOrigin = "";
    }

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(closeTimer);
      setIsRedirecting(false);
    };

    const onMessage = (event: MessageEvent) => {
      if (apiOrigin && event.origin !== apiOrigin) return;
      const data = event.data as { source?: string; status?: string };
      if (!data || data.source !== "wa-embedded") return;
      cleanup();
      try {
        popup.close();
      } catch {
        /* popup may already be closed */
      }
      if (data.status === "success") {
        toast({
          title: t("connect.success.toastTitle"),
          description: t("connect.success.toastDescription"),
        });
        // Land on the completion screen rather than the list. The popup posts
        // only a status, so the identifiers are omitted here; the ?status=
        // fallback path still carries them.
        setPopupConnected(true);
      }
    };

    // Detect the user closing the popup without finishing.
    const closeTimer = window.setInterval(() => {
      if (popup.closed) cleanup();
    }, 600);

    window.addEventListener("message", onMessage);
  };

  if (user && !can("business_phones", "create")) {
    return null;
  }

  const facts = [
    {
      term: t("connect.features.quick.title"),
      detail: t("connect.features.quick.description"),
    },
    {
      term: t("connect.features.secure.title"),
      detail: t("connect.features.secure.description"),
    },
    {
      term: t("connect.features.automatic.title"),
      detail: t("connect.features.automatic.description"),
    },
  ];

  return (
    <ConnectShell>
      <ConnectBlock>
        <Button
          variant="ghost"
          title={t("button.back")}
          icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          onClick={() => router.push("/dashboard/whatsapp-business-phones")}
        />
      </ConnectBlock>

      <ConnectIdentity
        logo={<WhatsAppLogoColor className="h-7 w-7" />}
        title={t("connect.title")}
        lead={t("connect.description")}
        meta={
          <Image
            src={badgeSrc}
            alt={t("connect.partnerBadge")}
            width={132}
            height={40}
            className="h-auto w-[112px] object-contain"
            unoptimized
          />
        }
      />

      {isSuccess ? (
        <ConnectResult
          status="success"
          title={t("connect.success.title")}
          body={t("connect.success.description")}
          details={
            phoneId && wabaId
              ? [
                  { label: t("connect.detailPhoneId"), value: phoneId },
                  { label: t("connect.detailWabaId"), value: wabaId },
                ]
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
                title={t("connect.success.viewPhones")}
                onClick={() => router.push("/dashboard/whatsapp-business-phones")}
              />
            </>
          }
        />
      ) : isError ? (
        <ConnectResult
          status="error"
          title={t("connect.error.title")}
          body={t("connect.error.description")}
          actions={
            <Button
              variant="primary"
              title={tc("tryAgain")}
              onClick={() => router.replace(window.location.pathname)}
            />
          }
        />
      ) : (
        <ConnectPanel className="space-y-6">
          {/* A readout, ahead of the control it governs, but not a step: there
              is nothing here for the operator to do. `bare` because a card
              inside a panel is two frames saying the same thing. */}
          <div className="rounded-lg border border-border bg-muted p-4">
            <WhatsAppCapacityCard capacity={capacity} variant="bare" />
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold leading-6 text-foreground">
              {t("connect.actionTitle")}
            </h2>
              <div className="space-y-4">
                <ConnectNotice tone="info">{tc("opensWindow")}</ConnectNotice>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    size="lg"
                    title={
                      isRedirecting
                        ? t("connect.cta.redirecting")
                        : t("connect.cta.button")
                    }
                    icon={<ArrowSquareOut weight="bold" className="h-4 w-4" />}
                    iconVisible
                    iconSide="right"
                    disabled={isRedirecting || capacityBlocked || !capacity.ready}
                    onClick={handleConnect}
                    className="w-full sm:w-auto sm:px-10"
                  />
                  <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                    <Lock weight="bold" className="size-3" />
                    OAuth 2.0
                  </span>
                </div>

                {/* What the Meta window will ask for, so the operator recognises
                    the screens rather than guessing. */}
                <ul className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  <li>{t("connect.steps.step1")}</li>
                  <li>{t("connect.steps.step2")}</li>
                  <li>{t("connect.steps.step3")}</li>
                </ul>
              </div>
          </div>
        </ConnectPanel>
      )}

      {!isSuccess && !isError && (
        <ConnectSupporting>
          <ConnectBlock>
            <ConnectNotice tone="info">
              <p className="font-medium">{t("connect.infoBox.title")}</p>
              <p className="text-foreground/80">
                {t("connect.infoBox.description")}
              </p>
            </ConnectNotice>
          </ConnectBlock>

          <ConnectFacts title={t("connect.featuresTitle")} items={facts} />
        </ConnectSupporting>
      )}
    </ConnectShell>
  );
}
