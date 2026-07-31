"use client";

import {
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  Eye,
  InstagramLogo,
  MagnifyingGlass,
  Plus,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { useRouter, useSearchParams } from "next/navigation";

import {
  disconnectInstagramAccountAction,
  listInstagramAccountsAction,
} from "@/app/actions/instagram";
import type { InstagramAccount, InstagramAccountStatus } from "@/lib/instagram/types";
import {
  type InstagramConnectResult,
  useInstagramConnect,
} from "@/hooks/use-instagram-connect";

import Button from "@/components/elevated-design/button";
import { InstagramAvatar } from "@/components/instagram/instagram-avatar";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { translateAccountType } from "@/lib/instagram/account-type";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const ITEMS_PER_PAGE = 15;

/**
 * Solid status pills, matching the WhatsApp business phones table.
 *
 * MESSAGING_OFF is not an Instagram account status — it is a derived state for an
 * account whose OAuth is healthy but whose "Allow access to messages" toggle is
 * off inside the Instagram app. It gets its own pill because the remedy differs
 * from a reconnect.
 */
const STATUS_COLORS: Record<InstagramAccountStatus | "MESSAGING_OFF", string> = {
  PENDING: "bg-amber-500 text-white",
  CONNECTED: "bg-emerald-500 text-white",
  TOKEN_EXPIRED: "bg-red-600 text-white",
  REVOKED: "bg-slate-500 text-white",
  SUSPENDED: "bg-orange-500 text-white",
  MESSAGING_OFF: "bg-amber-500 text-white",
};

export default function InstagramAccountsPage() {
  const t = useTranslations("instagram");
  const { can } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const canCreate = can("instagram_accounts", "create");
  const canDelete = can("instagram_accounts", "delete");

  const fetchAccounts = useCallback(async (nextPage = 1, term = "") => {
    setLoading(true);
    const result = await listInstagramAccountsAction(nextPage, ITEMS_PER_PAGE, term || undefined);
    if (result.error) {
      setError(result.error);
    } else {
      setError(null);
      setAccounts(result.accounts);
      setPage(result.meta.page);
      setTotalPages(result.meta.totalPages);
      setTotalItems(result.meta.totalItems);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAccounts(1, "");
  }, [fetchAccounts]);

  /** Turns an onboarding outcome into a toast, whichever transport delivered it. */
  const reportResult = useCallback(
    (result: InstagramConnectResult) => {
      if (result.status === "cancelled") return;

      if (result.status === "error") {
        toast({
          title: t("connect.errorTitle"),
          description: t(`connectError.${result.reason ?? "connect_failed"}`),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("connect.successTitle"),
        description: result.username
          ? t(result.status === "reconnected" ? "notice.reconnected" : "notice.connected", {
              username: result.username,
            })
          : t("notice.connectedGeneric"),
      });
      void fetchAccounts(1, "");
    },
    [toast, t, fetchAccounts],
  );

  const { connect, isConnecting } = useInstagramConnect(reportResult);

  /**
   * The popup reports back via postMessage; a blocked popup falls back to a
   * full-page redirect that returns the outcome in the query string. Both paths are
   * handled so the user always gets feedback.
   */
  useEffect(() => {
    const status = searchParams.get("instagram");
    if (!status) return;

    reportResult({
      status: status as InstagramConnectResult["status"],
      username: searchParams.get("username") ?? undefined,
      reason: searchParams.get("reason") ?? undefined,
    });
    router.replace("/dashboard/instagram-accounts");
  }, [searchParams, router, reportResult]);

  const handleDisconnect = useCallback(
    async (account: InstagramAccount) => {
      setDisconnectingId(account.id);
      const result = await disconnectInstagramAccountAction(account.id);
      setDisconnectingId(null);

      if (result.error) {
        toast({ title: t("card.disconnect"), description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: t("card.disconnect"),
        description: t("notice.disconnected", { username: account.username }),
      });
      void fetchAccounts(page, search);
    },
    [toast, t, fetchAccounts, page, search],
  );

  const statusKeyFor = (row: InstagramAccount): InstagramAccountStatus | "MESSAGING_OFF" =>
    row.status === "CONNECTED" && !row.messagingHealthy ? "MESSAGING_OFF" : row.status;

  // Counted over the current page, the same way the phones list does it — these are
  // an at-a-glance read of what is on screen, not workspace-wide totals.
  const connectedCount = accounts.filter(
    (a) => a.status === "CONNECTED" && a.messagingHealthy,
  ).length;
  // Both failure modes land here: an expired token and a healthy token whose
  // messaging toggle is off. They need different remedies but the same attention.
  const attentionCount = accounts.filter(
    (a) => a.needsReconnect || (a.status === "CONNECTED" && !a.messagingHealthy),
  ).length;

  const columns = useMemo<DashboardTableColumn<InstagramAccount>[]>(
    () => [
      {
        key: "account",
        header: t("table.account"),
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <InstagramAvatar
              accountId={row.id}
              username={row.username}
              className="size-7"
              textClassName="text-[11px]"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">@{row.username}</span>
              {row.name && <span className="text-xs text-muted-foreground">{row.name}</span>}
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: t("table.status"),
        render: (row) => {
          const key = statusKeyFor(row);
          return (
            <div className="flex flex-col gap-1">
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  STATUS_COLORS[key] ?? "bg-slate-500 text-white",
                )}
              >
                {key === "MESSAGING_OFF"
                  ? t("status.messagingOff")
                  : t(`status.${row.status.toLowerCase()}`)}
              </span>

              {/* The messaging toggle is an invisible failure: OAuth succeeds but no
                  DM ever arrives, so it is called out inline rather than left as a
                  green-looking row. */}
              {key === "MESSAGING_OFF" && (
                <span
                  className="flex max-w-[280px] items-start gap-1 text-xs text-amber-700 dark:text-amber-400"
                  title={t("card.messagingDisabled")}
                >
                  <Warning weight="fill" className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span className="line-clamp-2">{t("card.messagingDisabled")}</span>
                </span>
              )}

              {row.needsReconnect && row.statusReason && (
                <span
                  className="flex max-w-[280px] items-start gap-1 text-xs text-red-700 dark:text-red-400"
                  title={row.statusReason}
                >
                  <Warning weight="fill" className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span className="line-clamp-2">{row.statusReason}</span>
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "type",
        header: t("table.type"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {translateAccountType(t, row.accountType)}
          </span>
        ),
      },
      {
        key: "posts",
        header: t("card.posts"),
        render: (row) => <span className="text-sm text-foreground">{row.mediaCount}</span>,
      },
      {
        key: "followers",
        header: t("card.followers"),
        render: (row) => <span className="text-sm text-foreground">{row.followersCount}</span>,
      },
    ],
    [t],
  );

  const renderRowActions = useCallback(
    (row: InstagramAccount) => (
      <div className="flex items-center gap-1">
        {row.needsReconnect && canCreate && (
          <button
            type="button"
            disabled={isConnecting}
            onClick={(e) => {
              e.stopPropagation();
              connect("/dashboard/instagram-accounts");
            }}
            title={t("card.reconnect")}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <ArrowClockwise
              className={cn("h-3.5 w-3.5", isConnecting && "animate-spin")}
              weight="bold"
            />
            {t("card.reconnect")}
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/instagram-accounts/${row.id}`);
          }}
          title={t("card.viewProfile")}
          className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Eye className="h-4 w-4" />
        </button>

        {canDelete && (
          <button
            type="button"
            disabled={disconnectingId === row.id}
            onClick={(e) => {
              e.stopPropagation();
              void handleDisconnect(row);
            }}
            title={t("card.disconnect")}
            className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
    [canCreate, canDelete, connect, disconnectingId, handleDisconnect, isConnecting, router, t],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-6"
    >
      <DashboardPageHeader
        badge={t("page.title")}
        description={t("page.description")}
        icon={<InstagramLogo className="h-6 w-6" weight="fill" />}
        colorClass="text-fuchsia-600"
        actions={
          canCreate ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/dashboard/instagram-accounts/connect">
                <Button
                  variant="primary"
                  title={t("page.connect")}
                  icon={<Plus weight="bold" className="h-4 w-4" />}
                  iconVisible
                  iconSide="left"
                />
              </Link>
            </div>
          ) : undefined
        }
      />

      {/* Search + stats bar, same shape as the business phones list. */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 shadow-sm">
        <div className="relative w-full max-w-xs">
          <ElevatedInput
            type="text"
            label={t("page.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void fetchAccounts(1, search);
            }}
            icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
            controlSize="sm"
            className="w-full"
          />
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-4">
          <Stat label={t("stats.total")} value={loading ? "…" : totalItems} />
          <Stat label={t("stats.connected")} value={loading ? "…" : connectedCount} />
          <Stat label={t("stats.attention")} value={loading ? "…" : attentionCount} />
        </div>

        <Button
          variant="ghost"
          title=""
          icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", loading && "animate-spin")} />}
          iconVisible
          iconSide="left"
          onClick={() => void fetchAccounts(page, search)}
          disabled={loading}
        />

        {!loading && (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {t("pagination.total", { total: totalItems })}
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <Warning className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <DashboardTable<InstagramAccount>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          loading
        />
      ) : accounts.length === 0 ? (
        <DashboardTable<InstagramAccount>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          emptyState={{
            icon: <InstagramLogo className="h-7 w-7 text-muted-foreground/40" weight="duotone" />,
            title: t("page.emptyTitle"),
            description: t("page.emptyDescription"),
            action: canCreate ? (
              <div className="mt-2 flex items-center gap-3">
                <Link href="/dashboard/instagram-accounts/connect">
                  <Button
                    variant="primary"
                    title={t("page.connect")}
                    icon={<Plus weight="bold" className="h-4 w-4" />}
                    iconVisible
                    iconSide="left"
                  />
                </Link>
              </div>
            ) : undefined,
          }}
        />
      ) : (
        <div className="space-y-4">
          <ElevatedContainer className="overflow-hidden border border-border/70 !p-0">
            <DashboardTable<InstagramAccount>
              data={accounts}
              columns={columns}
              rowKey={(row) => row.id}
              onRowClick={(row) => router.push(`/dashboard/instagram-accounts/${row.id}`)}
              renderRowActions={renderRowActions}
              className="rounded-none border-0 shadow-none"
            />
          </ElevatedContainer>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 px-1">
              <span className="text-xs text-muted-foreground">
                {t("pagination.pageOf", { page, totalPages })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => void fetchAccounts(page - 1, search)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CaretLeft className="h-3.5 w-3.5" weight="bold" />
                  {t("pagination.previous")}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => void fetchAccounts(page + 1, search)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("pagination.next")}
                  <CaretRight className="h-3.5 w-3.5" weight="bold" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

/** One inline stat in the toolbar, matching the business phones list. */
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
