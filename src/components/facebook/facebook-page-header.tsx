"use client";

import { ArrowClockwise, ArrowSquareOut, CheckCircle, InstagramLogo, Warning } from "@/components/icons";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { checkFacebookPageHealthAction } from "@/app/actions/facebook";
import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import { CapabilityChip, ProfileNotice, ProfileStat } from "@/components/channels/channel-profile-parts";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { StatusBadge } from "@/components/elevated-design/listing-card";
import { RoutingHealthBanner } from "@/components/facebook/routing-health-banner";
import { useFacebookError } from "@/components/facebook/use-facebook-error";
import { useFacebookConnect } from "@/hooks/use-facebook-connect";
import { displayStatus, pageNotices } from "@/lib/facebook/page";
import type { FacebookCapability, FacebookPage } from "@/lib/facebook/types";
import { cn } from "@/lib/utils";

const CAPABILITIES: FacebookCapability[] = ["messaging", "readPosts", "publish", "moderate", "comment", "subscribe"];

export function FacebookPageHeader({
  page,
  canReconnect,
  canCheckHealth,
  onUpdated,
  onReconnected,
}: {
  page: FacebookPage;
  canReconnect: boolean;
  canCheckHealth: boolean;
  onUpdated: (page: FacebookPage) => void;
  onReconnected: () => void;
}) {
  const t = useTranslations("facebook");
  const describeError = useFacebookError();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { connect, isConnecting } = useFacebookConnect((result) => {
    if (result.status === "connected" || result.status === "partial") onReconnected();
    else if (result.status === "error") setError(t(`connectError.${result.reason ?? "connect_failed"}`));
  });

  const status = displayStatus(page);
  const notices = pageNotices(page);

  const checkHealth = async () => {
    setChecking(true);
    setError(null);
    const result = await checkFacebookPageHealthAction(page.id);
    setChecking(false);
    if ("error" in result) {
      setError(describeError(result));
      return;
    }
    if (result.page) onUpdated(result.page);
  };

  return (
    <ElevatedContainer className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <ChannelAvatarImage
          url={page.pictureUrl}
          name={page.name}
          seed={page.id}
          className="size-20 ring-2 ring-border sm:size-24"
          textClassName="text-3xl sm:text-4xl"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 className="truncate font-display text-lg font-semibold tracking-[0.01em] text-foreground">{page.name}</h2>
            <StatusBadge
              label={t(`status.${status.toLowerCase()}`)}
              color={status === "CONNECTED" ? "emerald" : status === "ROUTING_OFF" || status === "PENDING" ? "amber" : "rose"}
              icon={status === "CONNECTED" ? <CheckCircle weight="fill" /> : <Warning weight="fill" />}
            />
            {page.category ? <StatusBadge label={page.category} color="slate" /> : null}
          </div>

          {page.username ? <p className="-mt-2 truncate text-sm text-muted-foreground">@{page.username}</p> : null}

          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <ProfileStat value={page.followersCount} label={t("card.followers")} />
          </dl>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {CAPABILITIES.map((capability) => (
              <CapabilityChip
                key={capability}
                enabled={page.capabilities[capability]}
                label={t(`capability.${capability}`)}
                title={page.capabilities[capability] ? undefined : t("capability.missingHint")}
              />
            ))}
            <CapabilityChip
              enabled={page.humanAgentAvailable}
              label={t("capability.humanAgent")}
              title={page.humanAgentAvailable ? undefined : t("capability.humanAgentHint")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {page.link ? (
              <a
                href={page.link}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary-ink hover:underline"
              >
                <ArrowSquareOut className="h-3.5 w-3.5" />
                {t("page.openOnFacebook")}
              </a>
            ) : null}
            {page.linkedInstagramUserId ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <InstagramLogo className="h-3.5 w-3.5" />
                {t("page.linkedInstagram")}
              </span>
            ) : null}
            {canCheckHealth ? (
              <button
                type="button"
                onClick={() => void checkHealth()}
                disabled={checking}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <ArrowClockwise className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
                {checking ? t("page.checking") : t("page.checkHealth")}
              </button>
            ) : null}
            {page.healthCheckedAt ? (
              <span className="text-muted-foreground">
                {t("page.checkedAt", { date: new Date(page.healthCheckedAt).toLocaleString() })}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <ProfileNotice color="rose" icon={<Warning className="h-4 w-4" />}>
          {error}
        </ProfileNotice>
      ) : null}

      {notices.includes("reconnect") && (
        <ProfileNotice color="rose" icon={<Warning className="h-4 w-4" />}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {page.status === "NEEDS_ROLE" ? t("notice.needsRole") : t("notice.reconnect")}
              {page.statusReason ? ` ${page.statusReason}` : ""}
            </span>
            <button
              type="button"
              disabled={isConnecting || !canReconnect}
              title={canReconnect ? undefined : t("notice.noConnectPermission")}
              onClick={() => connect(`/dashboard/facebook-pages/${page.id}`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <ArrowClockwise className={cn("h-3.5 w-3.5", isConnecting && "animate-spin")} />
              {t("card.reconnect")}
            </button>
          </div>
        </ProfileNotice>
      )}

      {notices.includes("restricted") && (
        <ProfileNotice color="rose" icon={<Warning className="h-4 w-4" />}>
          <p className="font-medium">{t("notice.restrictedTitle")}</p>
          <p className="mt-1 opacity-80">
            {page.policy.reason ? t("notice.restrictedReason", { reason: page.policy.reason }) : t("notice.restrictedBody")}
          </p>
        </ProfileNotice>
      )}

      {notices.includes("webhook") && (
        <ProfileNotice color="amber" icon={<Warning className="h-4 w-4" />}>
          <p className="font-medium">{t("notice.webhookTitle")}</p>
          <p className="mt-1 opacity-80">{t("notice.webhookBody")}</p>
        </ProfileNotice>
      )}

      {notices.includes("messagingOff") && (
        <ProfileNotice color="amber" icon={<Warning className="h-4 w-4" />}>
          <p className="font-medium">{t("notice.messagingOffTitle")}</p>
          <p className="mt-1 opacity-80">{t("notice.messagingOffBody")}</p>
        </ProfileNotice>
      )}

      {page.status === "CONNECTED" ? <RoutingHealthBanner routing={page.routing} /> : null}
    </ElevatedContainer>
  );
}
