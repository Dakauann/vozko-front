"use client";

import { ArrowClockwise } from "@/components/icons";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";
import { refuseUnhandled } from "@/lib/exhaustive";
import { accountNotices, type MercadoLivreAccountNotice } from "@/lib/mercadolivre/account";
import type { MercadoLivreAccount } from "@/lib/mercadolivre/types";
import { cn } from "@/lib/utils";

import { usePurgeDate } from "@/components/channels/use-purge-date";

interface ReconnectControl {
  canReconnect: boolean;
  reconnecting: boolean;
  onReconnect: () => void;
}

function ReconnectAction({ control }: { control: ReconnectControl }) {
  const t = useTranslations("mercadolivre.notice");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant="secondary"
        title={t("reconnectAction")}
        icon={<ArrowClockwise className={cn("h-3.5 w-3.5", control.reconnecting && "animate-spin")} weight="bold" />}
        iconVisible
        iconSide="left"
        disabled={!control.canReconnect || control.reconnecting}
        onClick={control.onReconnect}
      />
      {control.canReconnect ? null : <span className="text-muted-foreground">{t("noConnectPermission")}</span>}
    </div>
  );
}

function NoticeView({
  notice,
  control,
  offersReconnect,
}: {
  notice: MercadoLivreAccountNotice;
  control: ReconnectControl;
  offersReconnect: boolean;
}) {
  const t = useTranslations("mercadolivre.notice");
  const purgeDate = usePurgeDate();
  switch (notice.kind) {
    case "reconnect":
      return (
        <Notice tone="fault" title={t("reconnectTitle")}>
          <p>{t("reconnectBody")}</p>
          <ReconnectAction control={control} />
        </Notice>
      );
    case "purge":
      return (
        <Notice tone="warning" title={t("purgeTitle")}>
          <p>{t("purgeBody", { date: purgeDate(notice.purgeAfter) })}</p>
          {offersReconnect ? <ReconnectAction control={control} /> : null}
        </Notice>
      );
    case "disconnected":
      return (
        <Notice tone="neutral" title={t("purgeTitle")}>
          <p>{t("disconnectedBody")}</p>
          {offersReconnect ? <ReconnectAction control={control} /> : null}
        </Notice>
      );
    default:
      return refuseUnhandled(notice, null);
  }
}

export function MercadoLivreAccountNotices({
  account,
  ...control
}: { account: MercadoLivreAccount } & ReconnectControl) {
  const notices = accountNotices(account);
  if (notices.length === 0) return null;
  return (
    <div className="space-y-3">
      {notices.map((notice) => (
        <NoticeView key={notice.kind} notice={notice} control={control} offersReconnect={!account.needsReconnect} />
      ))}
    </div>
  );
}
