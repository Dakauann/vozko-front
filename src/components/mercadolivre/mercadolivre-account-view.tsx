"use client";

import { Trash } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { getMercadoLivreAccountAction } from "@/app/actions/mercadolivre";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { MercadoLivreLogoColor } from "@/components/icons/channel-logos";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { useMercadoLivreConnect } from "@/hooks/use-mercadolivre-connect";
import { MERCADOLIVRE_ACCOUNTS_PATH, mercadoLivreAccountPath } from "@/lib/mercadolivre/connect";
import type { MercadoLivreAccount, MercadoLivreConnectResult } from "@/lib/mercadolivre/types";

import { MercadoLivreAccountHeader } from "./mercadolivre-account-header";
import { MercadoLivreAccountNotices } from "./mercadolivre-account-notices";
import { MercadoLivreAccountTabs } from "./mercadolivre-account-tabs";
import { MercadoLivreDisconnectDialog } from "./mercadolivre-disconnect-dialog";
import { useConnectRedirectResult } from "./use-connect-redirect-result";
import { useMercadoLivreError } from "./use-mercadolivre-error";

type LoadState = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; account: MercadoLivreAccount };

export function MercadoLivreAccountView({ accountId }: { accountId: string }) {
  const t = useTranslations("mercadolivre");
  const router = useRouter();
  const describeError = useMercadoLivreError();
  const { can } = useWorkspace();
  const canUpdate = can("mercadolivre_accounts", "update");
  const canCreate = can("mercadolivre_accounts", "create");
  const canDelete = can("mercadolivre_accounts", "delete");
  const accountPath = mercadoLivreAccountPath(accountId);

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getMercadoLivreAccountAction(accountId).then((result) => {
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
    (result: MercadoLivreConnectResult) => {
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

  const { connect, isConnecting } = useMercadoLivreConnect(handleConnectResult);
  useConnectRedirectResult(accountPath, handleConnectResult);

  const account = state.status === "ready" ? state.account : null;
  const setAccount = (next: MercadoLivreAccount) => setState({ status: "ready", account: next });
  const canDisconnect = canDelete && account !== null && account.status !== "DISCONNECTED";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <DashboardPageHeader
        icon={<MercadoLivreLogoColor className="h-5 w-5" />}
        badge={t("screens.account.title")}
        title={account?.nickname ?? t("screens.account.title")}
        description={t("screens.account.description")}
        back={{ onClick: () => router.push(MERCADOLIVRE_ACCOUNTS_PATH), label: t("account.back") }}
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
          <MercadoLivreAccountHeader account={account} canCheckHealth={canUpdate} onUpdated={setAccount} />
          <MercadoLivreAccountNotices
            account={account}
            canReconnect={canCreate}
            reconnecting={isConnecting}
            onReconnect={() => connect(accountPath)}
          />
          {connectError ? <Notice tone="fault">{connectError}</Notice> : null}
          <MercadoLivreAccountTabs account={account} canUpdate={canUpdate} onUpdated={setAccount} />
          <MercadoLivreDisconnectDialog
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
