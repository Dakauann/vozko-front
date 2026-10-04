"use client";

import { useTranslations } from "next-intl";

import { Info, WarningCircle } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@/i18n/routing";
import { overviewHref } from "@/lib/advertising/connect";
import { fundsNotice, type FundsNotice } from "@/lib/advertising/funds";
import type { AdAccount, AdFunds } from "@/lib/advertising/types";

import { RecheckButton } from "./requirement-steps";
import type { AdReadinessState } from "./use-ad-readiness";
import { useAdsFormat } from "./use-ads-format";
import { ExternalLink } from "./wizard/choice-row";

function useNoticeBody(notice: FundsNotice, funds: AdFunds, currency: string): string {
  const t = useTranslations("adsFunds.notices");
  const fmt = useAdsFormat();
  const room = fmt.minor(funds.room, currency);
  if (notice.reason === "funds_low" && funds.daysLeft !== null) {
    return t("funds_low.bodyWithDays", { room, days: Math.max(1, Math.round(funds.daysLeft)) });
  }
  return t(`${notice.reason}.body`, { room });
}

function FundsAction({ notice, account, state }: { notice: FundsNotice; account: AdAccount; state: AdReadinessState }) {
  const t = useTranslations("adsFunds.actions");
  if (notice.action === "adjustLimit") {
    return (
      <Link href={overviewHref(account.id)} className="text-xs font-semibold text-primary-ink hover:underline">
        {t("adjustLimit")}
      </Link>
    );
  }
  return (
    <>
      <ExternalLink href={account.funds?.portalUrl ?? ""} onOpen={state.openPortal}>
        {t(notice.action)}
      </ExternalLink>
      <RecheckButton checking={state.checking} onRecheck={state.recheck} />
    </>
  );
}

export function FundsBanner({ account, state }: { account: AdAccount; state: AdReadinessState }) {
  const t = useTranslations("adsFunds.notices");
  const notice = fundsNotice(account);
  if (!notice || !account.funds) return null;
  return <FundsAlert notice={notice} funds={account.funds} account={account} state={state} title={t(`${notice.reason}.title`)} />;
}

function FundsAlert({
  notice,
  funds,
  account,
  state,
  title,
}: {
  notice: FundsNotice;
  funds: AdFunds;
  account: AdAccount;
  state: AdReadinessState;
  title: string;
}) {
  const body = useNoticeBody(notice, funds, account.currency);
  const Icon = notice.tone === "info" ? Info : WarningCircle;
  return (
    <Alert variant={notice.tone}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{body}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <FundsAction notice={notice} account={account} state={state} />
        </div>
      </AlertDescription>
    </Alert>
  );
}
