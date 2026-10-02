"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { DashboardTable } from "@/components/elevated-design/table/dashboard-table";
import { Megaphone, Plugs, Warning } from "@/components/icons";
import type { AdAccountsState } from "@/hooks/use-ad-accounts";
import { ADVERTISING_PATH } from "@/lib/advertising/connect";
import type { AdAccount } from "@/lib/advertising/types";

export function AccountGate({
  header,
  accounts,
  permissionsLoading,
  canRead,
  canConnect,
  children,
}: {
  header: ReactNode;
  accounts: AdAccountsState;
  permissionsLoading: boolean;
  canRead: boolean;
  canConnect: boolean;
  children: (account: AdAccount) => ReactNode;
}) {
  const t = useTranslations("adsManager");

  if (permissionsLoading || (canRead && accounts.loading)) {
    return (
      <div className="w-full space-y-6">
        {header}
        <DashboardTable data={[]} columns={[]} rowKey={() => ""} loading />
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="w-full space-y-6">
        {header}
        <p className="text-sm text-muted-foreground">{t("noAccess")}</p>
      </div>
    );
  }

  if (accounts.error) {
    return (
      <div className="w-full space-y-6">
        {header}
        <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" aria-hidden />
          {accounts.error}
          <button
            type="button"
            onClick={() => void accounts.reload()}
            className="ml-auto font-semibold text-primary-ink hover:underline"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!accounts.selected) {
    return (
      <div className="w-full space-y-6">
        {header}
        <DashboardTable
          data={[]}
          columns={[]}
          rowKey={() => ""}
          emptyState={{
            icon: <Megaphone className="h-7 w-7 text-muted-foreground" />,
            title: t("empty.noAccountTitle"),
            description: canConnect ? t("empty.noAccountBody") : t("empty.noAccountBodyNoPermission"),
            action: canConnect ? (
              <div className="mt-2">
                <Button
                  variant="secondary"
                  title={t("header.connect")}
                  icon={<Plugs className="h-4 w-4" />}
                  iconVisible
                  iconSide="left"
                  link={ADVERTISING_PATH}
                />
              </div>
            ) : undefined,
          }}
        />
      </div>
    );
  }

  return <>{children(accounts.selected)}</>;
}
