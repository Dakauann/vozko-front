"use client";

import { ArrowClockwise } from "@/components/icons";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { usePurgeDate } from "@/components/channels/use-purge-date";
import { Notice } from "@/components/ui/notice";
import { refuseUnhandled } from "@/lib/exhaustive";
import { accountNotices, type TiktokAccountNotice } from "@/lib/tiktok/account";
import type { TiktokAccount } from "@/lib/tiktok/types";
import { cn } from "@/lib/utils";

export interface ReconnectControl {
  canReconnect: boolean;
  reconnecting: boolean;
  onReconnect: () => void;
}

function ReconnectAction({ control }: { control: ReconnectControl }) {
  const t = useTranslations("tiktok.notice");
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

function NoticeView({ notice, control }: { notice: TiktokAccountNotice; control: ReconnectControl }) {
  const t = useTranslations("tiktok.notice");
  const date = usePurgeDate();
  switch (notice.kind) {
    case "reconnect":
      return (
        <Notice tone="fault" title={t("reconnectTitle")}>
          <p>{notice.purgeAfter ? t("reconnectPurgeBody", { date: date(notice.purgeAfter) }) : t("reconnectBody")}</p>
          <ReconnectAction control={control} />
        </Notice>
      );
    case "disconnected":
      return (
        <Notice tone="neutral" title={t("disconnectedTitle")}>
          <p>{notice.purgeAfter ? t("disconnectedPurgeBody", { date: date(notice.purgeAfter) }) : t("disconnectedBody")}</p>
          <ReconnectAction control={control} />
        </Notice>
      );
    case "reconnectSoon":
      return (
        <Notice tone="warning" title={t("reconnectSoonTitle")}>
          <p>{notice.reconnectBy ? t("reconnectSoonBody", { date: date(notice.reconnectBy) }) : t("reconnectSoonBodyUndated")}</p>
          <ReconnectAction control={control} />
        </Notice>
      );
    case "webhooks":
      return (
        <Notice tone="warning" title={t("webhooksTitle")}>
          <p>{t("webhooksBody")}</p>
        </Notice>
      );
    case "messaging":
      return (
        <Notice tone="info" title={t("messagingTitle")}>
          <p>{notice.refused ? t("messagingRefusedBody") : t("messagingMissingBody")}</p>
          {notice.refused ? null : <ReconnectAction control={control} />}
        </Notice>
      );
    default:
      return refuseUnhandled(notice, null);
  }
}

export function TiktokAccountNotices({ account, ...control }: { account: TiktokAccount } & ReconnectControl) {
  const notices = accountNotices(account);
  if (notices.length === 0) return null;
  return (
    <div className="space-y-3">
      {notices.map((notice) => (
        <NoticeView key={notice.kind} notice={notice} control={control} />
      ))}
    </div>
  );
}
