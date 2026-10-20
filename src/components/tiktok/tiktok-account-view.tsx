"use client";

import { Trash } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { getTiktokAccountAction } from "@/app/actions/tiktok";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { useTiktokConnect } from "@/hooks/use-tiktok-connect";
import { TIKTOK_RESOURCE } from "@/lib/tiktok/channel";
import { TIKTOK_ACCOUNTS_PATH, tiktokAccountPath } from "@/lib/tiktok/connect";
import type { TiktokAccount, TiktokConnectResult } from "@/lib/tiktok/types";

import { TiktokAccountHeader } from "./tiktok-account-header";
import { TiktokAccountNotices } from "./tiktok-account-notices";
import { TiktokAccountTabs } from "./tiktok-account-tabs";
import { TiktokDisconnectDialog } from "./tiktok-disconnect-dialog";
import { TiktokLogoColor } from "./tiktok-logo";
import { useTiktokError } from "./use-tiktok-error";
import { useTiktokRedirectResult } from "./use-tiktok-redirect-result";

type LoadState = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; account: TiktokAccount };

export function TiktokAccountView({ accountId }: { accountId: string }) {
  const t = useTranslations("tiktok");
  const router = useRouter();
  const describeError = useTiktokError();
  const { can } = useWorkspace();
  const canUpdate = can(TIKTOK_RESOURCE, "update");
  const canCreate = can(TIKTOK_RESOURCE, "create");
  const canDelete = can(TIKTOK_RESOURCE, "delete");
  const accountPath = tiktokAccountPath(accountId);

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getTiktokAccountAction(accountId).then((result) => {
      if (cancelled) return;
      if ("error" in result) setState({ status: "failed", message: describeError(result) });
      else setState({ status: "ready", account: result.account });
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, reloadKey, describeError]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const handleConnectResult = useCallback(
    (result: TiktokConnectResult) => {
      if (result.status === "cancelled") return;
      if (result.status === "error") {
        setConnectError(t(`connectError.${result.reason ?? "connect_failed"}`));
        return;
      }
      setConnectError(null);
      reload();
    },
    [reload, t],
  );

  const { connect, isConnecting } = useTiktokConnect(handleConnectResult);
  useTiktokRedirectResult(accountPath, handleConnectResult);

  const account = state.status === "ready" ? state.account : null;
  const setAccount = (next: TiktokAccount) => setState({ status: "ready", account: next });
  const canDisconnect = canDelete && account !== null && account.status !== "DISCONNECTED";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <DashboardPageHeader
        icon={<TiktokLogoColor className="h-5 w-5" />}
        badge={t("screens.account.title")}
        title={account ? `@${account.username}` : t("screens.account.title")}
        description={t("screens.account.description")}
        back={{ onClick: () => router.push(TIKTOK_ACCOUNTS_PATH), label: t("account.back") }}
        actions={
          canDisconnect ? (
            <Button
              variant="outline-subtle"
              title={t("disconnect.action")}
              icon={<Trash className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              onClick={() => setDisconnecting(true)}
            />
          ) : undefined
        }
      />

      {state.status === "failed" && (
        <Notice tone="fault">
          <p>{state.message}</p>
          <Button
            size="sm"
            variant="secondary"
            title={t("account.retry")}
            onClick={() => {
              setState({ status: "loading" });
              reload();
            }}
          />
        </Notice>
      )}

      {state.status === "loading" && <div className="h-40 animate-pulse rounded-[--radius] bg-muted" />}

      {account && (
        <>
          <TiktokAccountHeader account={account} canCheckHealth={canUpdate} onUpdated={setAccount} />
          <TiktokAccountNotices
            account={account}
            canReconnect={canCreate}
            reconnecting={isConnecting}
            onReconnect={() => connect(accountPath)}
          />
          {connectError ? <Notice tone="fault">{connectError}</Notice> : null}
          <TiktokAccountTabs account={account} canUpdate={canUpdate} onUpdated={setAccount} />
          <TiktokDisconnectDialog
            account={account}
            open={disconnecting}
            onOpenChange={setDisconnecting}
            onDisconnected={() => {
              setDisconnecting(false);
              reload();
            }}
          />
        </>
      )}
    </div>
  );
}
