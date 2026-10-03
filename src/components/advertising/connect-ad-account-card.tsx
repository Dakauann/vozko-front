"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Plugs } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useMetaAdsConnect } from "@/hooks/use-meta-ads-connect";
import { ADVERTISING_PATH } from "@/lib/advertising/connect";

import { useConnectResultMessage, type ConnectMessage } from "./use-connect-result";

export function ConnectAdAccountCard() {
  const t = useTranslations("adsManager");
  const { can, permissionsLoading } = useWorkspace();
  const canConnect = !permissionsLoading && can("ads", "create");
  const connectMessage = useConnectResultMessage();
  const [message, setMessage] = useState<ConnectMessage | null>(null);
  const { connect, isConnecting } = useMetaAdsConnect((result) => setMessage(connectMessage(result)));

  return (
    <section className="space-y-2 rounded-lg border border-border bg-card p-3.5 shadow-sm">
      <p className="text-sm font-semibold text-foreground">{t("header.connect")}</p>
      <p className="text-xs text-muted-foreground">{canConnect ? t("empty.noAccountBody") : t("empty.noAccountBodyNoPermission")}</p>
      {canConnect ? (
        <Button
          variant="primary"
          size="sm"
          title={t("connectCard.button")}
          icon={<Plugs className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          disabled={isConnecting}
          onClick={() => connect(ADVERTISING_PATH)}
        />
      ) : null}
      {message ? (
        <p className={message.failed ? "text-xs text-destructive-ink" : "text-xs text-healthy-ink"} role="status">
          {message.title}
          {message.description ? `: ${message.description}` : null}
        </p>
      ) : null}
    </section>
  );
}
