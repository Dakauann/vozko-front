"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ClockCounterClockwise, DotsThree, Plugs, SquaresFour, TestTube, Trash } from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { Link } from "@/i18n/routing";
import { overviewHref } from "@/lib/advertising/connect";
import type { AdAccount, AdLevel } from "@/lib/advertising/types";

import { AccountPicker } from "../account-picker";
import { SyncFreshness } from "./sync-freshness";

export interface TopBarMenu {
  canConnect: boolean;
  connecting: boolean;
  onConnect: () => void;
  canDisconnect: boolean;
  onDisconnect: () => void;
  onJobs: () => void;
  onTests: (() => void) | null;
}

export interface TopBarDrafts {
  count: number | null;
  blocker: string | null;
  onDiscard: () => void;
  onReview: () => void;
}

export function ManagerTopBar({
  level,
  accounts,
  account,
  onSelectAccount,
  synced,
  syncing,
  onSync,
  drafts,
  menu,
}: {
  level: AdLevel;
  accounts: AdAccount[];
  account: AdAccount | null;
  onSelectAccount: (id: string) => void;
  synced: string | null;
  syncing: boolean;
  onSync: (() => void) | null;
  drafts: TopBarDrafts | null;
  menu: TopBarMenu;
}) {
  const t = useTranslations("adsManager.topBar");
  const count = drafts?.count ?? null;
  const draftBlocker = drafts ? (drafts.blocker ?? (count === null ? t("draftsUnknown") : count === 0 ? t("noDrafts") : null)) : null;

  const withReason = (node: ReactNode) => (
    <TooltipWrapper content={draftBlocker ?? ""} enabled={!!draftBlocker}>
      {node}
    </TooltipWrapper>
  );

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-semibold text-foreground">{t(`title.${level}`)}</h1>
        {account ? <AccountPicker accounts={accounts} value={account.id} onChange={onSelectAccount} className="w-64" /> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onSync ? <SyncFreshness synced={synced} syncing={syncing} onSync={onSync} /> : null}
        {drafts
          ? withReason(
              <Button variant="ghost" size="sm" title={t("discard")} onClick={drafts.onDiscard} disabled={!!draftBlocker} />,
            )
          : null}
        {drafts
          ? withReason(
              <Button
                variant="primary"
                size="sm"
                title={t("review", { count: count ?? 0 })}
                onClick={drafts.onReview}
                disabled={!!draftBlocker}
              />,
            )
          : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("more")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[--radius] border border-control-edge bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <DotsThree className="h-4 w-4" weight="bold" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {account ? (
              <DropdownMenuItem asChild>
                <Link href={overviewHref(account.id)}>
                  <SquaresFour className="mr-2 h-4 w-4" aria-hidden />
                  {t("overview")}
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={menu.onJobs}>
              <ClockCounterClockwise className="mr-2 h-4 w-4" aria-hidden />
              {t("jobs")}
            </DropdownMenuItem>
            {menu.onTests ? (
              <DropdownMenuItem onSelect={menu.onTests}>
                <TestTube className="mr-2 h-4 w-4" aria-hidden />
                {t("tests")}
              </DropdownMenuItem>
            ) : null}
            {menu.canConnect || (menu.canDisconnect && account) ? <DropdownMenuSeparator /> : null}
            {menu.canConnect ? (
              <DropdownMenuItem onSelect={menu.onConnect} disabled={menu.connecting}>
                <Plugs className="mr-2 h-4 w-4" aria-hidden />
                {t("connect")}
              </DropdownMenuItem>
            ) : null}
            {menu.canDisconnect && account ? (
              <DropdownMenuItem onSelect={menu.onDisconnect} className="text-destructive-ink focus:text-destructive-ink">
                <Trash className="mr-2 h-4 w-4" aria-hidden />
                {t("disconnect")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
