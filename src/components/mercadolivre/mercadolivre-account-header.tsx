"use client";

import { ArrowClockwise } from "@/components/icons";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { checkMercadoLivreAccountHealthAction } from "@/app/actions/mercadolivre";
import { CapabilityChip } from "@/components/channels/channel-profile-parts";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { MercadoLivreLogoColor } from "@/components/icons/channel-logos";
import { Notice } from "@/components/ui/notice";
import { accountStatusKey, accountStatusTone } from "@/lib/mercadolivre/account";
import { MERCADOLIVRE_CAPABILITIES, type MercadoLivreAccount } from "@/lib/mercadolivre/types";
import { cn } from "@/lib/utils";

import { useCheckedDate } from "@/components/channels/use-purge-date";
import { useMercadoLivreError } from "./use-mercadolivre-error";

export function MercadoLivreAccountHeader({
  account,
  canCheckHealth,
  onUpdated,
}: {
  account: MercadoLivreAccount;
  canCheckHealth: boolean;
  onUpdated: (account: MercadoLivreAccount) => void;
}) {
  const t = useTranslations("mercadolivre");
  const describeError = useMercadoLivreError();
  const checkedDate = useCheckedDate();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setChecking(true);
    setError(null);
    const result = await checkMercadoLivreAccountHealthAction(account.id);
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
        <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
          <MercadoLivreLogoColor className="h-9 w-9" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 className="truncate font-display text-lg font-semibold tracking-[0.01em] text-foreground">{account.nickname}</h2>
            <StatusChip tone={accountStatusTone(account.status)} label={t(accountStatusKey(account.status))} />
          </div>

          <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            <span>{t("account.sellerId", { id: account.mlUserId })}</span>
            <span>{t("account.site", { site: account.siteId })}</span>
          </p>

          <div className="flex flex-wrap gap-1.5">
            {MERCADOLIVRE_CAPABILITIES.map((capability) => (
              <CapabilityChip
                key={capability}
                enabled={account[capability]}
                label={t(`capability.${capability}`)}
                title={account[capability] ? undefined : t("capability.missingHint")}
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
