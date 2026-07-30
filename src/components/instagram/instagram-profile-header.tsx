"use client";

import { ArrowClockwise, CheckCircle, InstagramLogo, Warning } from "@phosphor-icons/react";

import type { InstagramAccount } from "@/lib/instagram/types";
import { IconBox, StatusBadge, accentColorMap } from "@/components/elevated-design/listing-card";

import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { cn } from "@/lib/utils";
import { useInstagramConnect } from "@/hooks/use-instagram-connect";
import { useTranslations } from "next-intl";

/**
 * The Instagram-style profile header: avatar, handle, stat row, capability chips.
 *
 * Mirrors Instagram's own layout (avatar left, posts/followers/following row) so an
 * operator immediately recognises which account they are working in — the thing
 * that matters most when a workspace has several connected.
 *
 * All colour comes from the shared accent palette (tinted background + matching
 * text) rather than raw Tailwind literals, so this page reads like the rest of the
 * dashboard.
 */
export function InstagramProfileHeader({ account }: { account: InstagramAccount }) {
  const t = useTranslations("instagram");
  const { connect, isConnecting } = useInstagramConnect();

  // Reconnecting cannot fix a disabled messaging toggle, so the two states are
  // reported separately with different remedies.
  const messagingBroken = !account.needsReconnect && !account.messagingHealthy;

  return (
    <ElevatedContainer className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {account.profilePictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.profilePictureUrl}
            alt={account.username}
            className="size-20 shrink-0 rounded-2xl object-cover ring-2 ring-border sm:size-24"
          />
        ) : (
          <IconBox color="purple" size="lg">
            <InstagramLogo weight="duotone" />
          </IconBox>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-foreground">@{account.username}</h1>

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

            {account.accountType && <StatusBadge label={account.accountType} color="slate" />}
          </div>

          {/* Instagram's own stat order: posts, followers, following. */}
          <dl className="flex flex-wrap gap-6">
            <Stat value={account.mediaCount} label={t("card.posts")} />
            <Stat value={account.followersCount} label={t("card.followers")} />
            <Stat value={account.followsCount} label={t("card.following")} />
          </dl>

          {account.name && <p className="text-sm text-muted-foreground">{account.name}</p>}

          {/* Capability chips reflect the scopes the user ACTUALLY granted —
              individual permissions can be declined at consent time. */}
          <div className="flex flex-wrap gap-1.5">
            <CapabilityChip enabled={account.canSendMessages} label={t("capability.messages")} />
            <CapabilityChip enabled={account.canManageComments} label={t("capability.comments")} />
            <CapabilityChip enabled={account.canPublish} label={t("capability.publish")} />
          </div>
        </div>
      </div>

      {messagingBroken && (
        <Notice color="amber" icon={<Warning className="h-4 w-4" />}>
          <p className="font-medium">{t("profile.messagingDisabledTitle")}</p>
          <p className="mt-1 opacity-80">{t("profile.messagingDisabledHelp")}</p>
        </Notice>
      )}

      {account.needsReconnect && (
        <Notice color="rose" icon={<Warning className="h-4 w-4" />}>
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
        </Notice>
      )}
    </ElevatedContainer>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className="text-base font-semibold text-foreground">{value}</dd>
      <dt className="text-sm text-muted-foreground">{label}</dt>
    </div>
  );
}

function CapabilityChip({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px]",
        enabled
          ? "bg-muted text-muted-foreground"
          : "bg-muted/50 text-muted-foreground/50 line-through",
      )}
    >
      {label}
    </span>
  );
}

/** Inline notice using the shared accent palette rather than raw colour literals. */
function Notice({
  color,
  icon,
  children,
}: {
  color: "amber" | "rose";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const accent = accentColorMap[color];
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border p-3 text-xs leading-relaxed",
        accent.light,
        accent.border,
        accent.text,
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
