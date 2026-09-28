"use client";

import { ArrowClockwise, CheckCircle, Warning } from "@/components/icons";

import type { InstagramAccount } from "@/lib/instagram/types";
import { StatusBadge } from "@/components/elevated-design/listing-card";
import { CapabilityChip, ProfileNotice, ProfileStat } from "@/components/channels/channel-profile-parts";

import { InstagramAvatar } from "@/components/instagram/instagram-avatar";

import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { cn } from "@/lib/utils";
import { translateAccountType } from "@/lib/instagram/account-type";
import { useInstagramConnect } from "@/hooks/use-instagram-connect";
import { useTranslations } from "next-intl";

export function InstagramProfileHeader({ account }: { account: InstagramAccount }) {
  const t = useTranslations("instagram");
  const { connect, isConnecting } = useInstagramConnect();

  const messagingBroken = !account.needsReconnect && !account.messagingHealthy;

  return (
    <ElevatedContainer className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {
}
        <InstagramAvatar
          accountId={account.id}
          username={account.username}
          className="size-20 ring-2 ring-border sm:size-24"
          textClassName="text-3xl sm:text-4xl"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 className="truncate font-display text-lg font-semibold tracking-[0.01em] text-foreground">@{account.username}</h2>

            {account.needsReconnect ? (
              <StatusBadge
                label={t("status.token_expired")}
                color="rose"
                icon={<Warning weight="fill" />}
              />
            ) : messagingBroken ? (
              <StatusBadge label={t("status.messagingOff")} color="amber" pulse />
            ) : (
              <StatusBadge
                label={t("status.connected")}
                color="emerald"
                icon={<CheckCircle weight="fill" />}
              />
            )}

            {account.accountType && (
              <StatusBadge label={translateAccountType(t, account.accountType)} color="slate" />
            )}
          </div>

          {account.name && (
            <p className="-mt-2 truncate text-sm text-muted-foreground">{account.name}</p>
          )}

          {}
          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <ProfileStat value={account.mediaCount} label={t("card.posts")} />
            <ProfileStat value={account.followersCount} label={t("card.followers")} />
            <ProfileStat value={account.followsCount} label={t("card.following")} />
          </dl>

          {
}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <CapabilityChip enabled={account.canSendMessages} label={t("capability.messages")} />
            <CapabilityChip enabled={account.canManageComments} label={t("capability.comments")} />
            <CapabilityChip enabled={account.canPublish} label={t("capability.publish")} />
          </div>
        </div>
      </div>

      {messagingBroken && (
        <ProfileNotice color="amber" icon={<Warning className="h-4 w-4" />}>
          <p className="font-medium">{t("profile.messagingDisabledTitle")}</p>
          <p className="mt-1 opacity-80">{t("profile.messagingDisabledHelp")}</p>
        </ProfileNotice>
      )}

      {account.needsReconnect && (
        <ProfileNotice color="rose" icon={<Warning className="h-4 w-4" />}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("profile.reconnectRequired")}</span>
            <button
              type="button"
              disabled={isConnecting}
              onClick={() => connect(`/dashboard/instagram-accounts/${account.id}`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <ArrowClockwise className={cn("h-3.5 w-3.5", isConnecting && "animate-spin")} />
              {t("card.reconnect")}
            </button>
          </div>
        </ProfileNotice>
      )}
    </ElevatedContainer>
  );
}
