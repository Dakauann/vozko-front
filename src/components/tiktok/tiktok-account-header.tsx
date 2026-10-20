"use client";

import { ArrowClockwise } from "@/components/icons";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { checkTiktokAccountHealthAction } from "@/app/actions/tiktok";
import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import { CapabilityChip } from "@/components/channels/channel-profile-parts";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { useCheckedDate } from "@/components/channels/use-purge-date";
import { Notice } from "@/components/ui/notice";
import { accountStatusKey, accountStatusTone } from "@/lib/tiktok/account";
import { TIKTOK_CAPABILITIES, type TiktokAccount } from "@/lib/tiktok/types";
import { cn } from "@/lib/utils";

import { useTiktokError } from "./use-tiktok-error";

export function TiktokAccountHeader({
  account,
  canCheckHealth,
  onUpdated,
}: {
  account: TiktokAccount;
  canCheckHealth: boolean;
  onUpdated: (account: TiktokAccount) => void;
}) {
  const t = useTranslations("tiktok");
  const describeError = useTiktokError();
  const checkedDate = useCheckedDate();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setChecking(true);
    setError(null);
    const result = await checkTiktokAccountHealthAction(account.id);
    setChecking(false);
    if ("error" in result) {
      setError(describeError(result));
      return;
    }
    onUpdated(result.account);
    toast(t("account.checked"));
  };

  return (
    <ElevatedContainer className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ChannelAvatarImage
          url={account.avatarUrl}
          name={account.displayName || account.username}
          seed={account.username || account.id}
          className="size-16"
          textClassName="text-xl"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 className="truncate font-display text-lg font-semibold tracking-[0.01em] text-foreground">
              {account.displayName || `@${account.username}`}
            </h2>
            <StatusChip tone={accountStatusTone(account.status)} label={t(accountStatusKey(account.status))} />
          </div>

          <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            <span>@{account.username}</span>
            {account.isBusinessAccount ? <span>{t("account.businessAccount")}</span> : null}
            {account.hasAdvancedAccess ? <span>{t("account.advancedAccess")}</span> : null}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {TIKTOK_CAPABILITIES.map((capability) => (
              <CapabilityChip
                key={capability}
                enabled={account.capabilities[capability]}
                label={t(`capability.${capability}`)}
                title={account.capabilities[capability] ? undefined : t("capability.missingHint")}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {canCheckHealth ? (
              <button
                type="button"
                onClick={() => void checkHealth()}
                disabled={checking}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <ArrowClockwise className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
                {checking ? t("account.checking") : t("account.checkHealth")}
              </button>
            ) : null}
            <span className="text-muted-foreground">
              {account.lastHealthCheckAt
                ? t("account.checkedAt", { date: checkedDate(account.lastHealthCheckAt) })
                : t("account.neverChecked")}
            </span>
          </div>
        </div>
      </div>

      {error ? <Notice tone="fault">{error}</Notice> : null}
    </ElevatedContainer>
  );
}
