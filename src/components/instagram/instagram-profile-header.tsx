"use client";

import { ArrowClockwise, CheckCircle, Warning } from "@/components/icons";

import type { InstagramAccount } from "@/lib/instagram/types";
import { StatusBadge, accentColorMap } from "@/components/elevated-design/listing-card";

import { InstagramAvatar } from "@/components/instagram/instagram-avatar";

import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { cn } from "@/lib/utils";
import { translateAccountType } from "@/lib/instagram/account-type";
import { useInstagramConnect } from "@/hooks/use-instagram-connect";
import { useTranslations } from "next-intl";

/**
 * The Instagram-style profile header: avatar, handle, stat row, capability chips.
 *
 * Mirrors Instagram's own layout (avatar left, posts/followers/following row) so an
 * operator immediately recognises which account they are working in, the thing
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
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Circular, as Instagram renders it, a square avatar here immediately
            reads as "not the same account you see in the app". */}
        <InstagramAvatar
          accountId={account.id}
          username={account.username}
          className="size-20 ring-2 ring-border sm:size-24"
          textClassName="text-3xl sm:text-4xl"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 className="truncate text-lg font-semibold text-foreground">@{account.username}</h2>

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

          {/* Instagram's own stat order: posts, followers, following. */}
          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <Stat value={account.mediaCount} label={t("card.posts")} />
            <Stat value={account.followersCount} label={t("card.followers")} />
            <Stat value={account.followsCount} label={t("card.following")} />
          </dl>

          {/* Capability chips reflect the scopes the user ACTUALLY granted,
              individual permissions can be declined at consent time, so this is
              the honest answer to "why can't I reply from here". */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
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
      <dd className="text-base font-semibold tabular-nums text-foreground">
        {value.toLocaleString()}
      </dd>
      <dt className="text-sm text-muted-foreground">{label}</dt>
    </div>
  );
}

/**
 * A granted/declined capability.
 *
 * A leading dot carries the state rather than a strikethrough: struck-through text
 * reads as "removed" when the accurate meaning is "never granted", and it stays
 * legible at this size where a line through 11px text does not.
 */
function CapabilityChip({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[--radius] border px-2 py-0.5 text-[11px]",
        enabled
          ? "border-border bg-muted text-muted-foreground"
          : "border-dashed border-border bg-transparent text-muted-foreground/60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          enabled ? "bg-healthy" : "bg-muted-foreground/40",
        )}
      />
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
