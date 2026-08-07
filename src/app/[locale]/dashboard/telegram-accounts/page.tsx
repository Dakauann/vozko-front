"use client";

import { TelegramLogoColor } from "@/components/icons/channel-logos";
import {
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  Eye,
  MagnifyingGlass,
  Plus,
  Trash,
  Warning,
} from "@/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { useRouter } from "next/navigation";

import {
  disconnectTelegramAccountAction,
  listTelegramAccountsAction,
  reregisterTelegramWebhookAction,
} from "@/app/actions/telegram";
import {
  telegramAccountIssue,
  type TelegramAccount,
  type TelegramAccountStatus,
} from "@/lib/telegram/types";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const ITEMS_PER_PAGE = 15;

const STATUS_COLORS: Record<TelegramAccountStatus, string> = {
  PENDING: "bg-warning text-warning-foreground",
  ACTIVE: "bg-healthy text-healthy-foreground",
  TOKEN_INVALID: "bg-destructive text-destructive-foreground",
  WEBHOOK_FAILING: "bg-warning text-warning-foreground",
  REVOKED: "bg-muted text-muted-foreground",
};

export default function TelegramAccountsPage() {
  const t = useTranslations("telegram");
  const { can } = useWorkspace();
  const router = useRouter();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<TelegramAccount[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canCreate = can("telegram_accounts", "create");
  const canUpdate = can("telegram_accounts", "update");
  const canDelete = can("telegram_accounts", "delete");

  const fetchAccounts = useCallback(async (nextPage = 1, term = "") => {
    setLoading(true);
    const result = await listTelegramAccountsAction(nextPage, ITEMS_PER_PAGE, term || undefined);
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

  const handleDisconnect = useCallback(
    async (account: TelegramAccount) => {
      setBusyId(account.id);
      const result = await disconnectTelegramAccountAction(account.id);
      setBusyId(null);

      if (result.error) {
        toast({ title: t("card.disconnect"), description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: t("card.disconnect"),
        description: t("notice.disconnected", { username: account.displayName }),
      });
      void fetchAccounts(page, search);
    },
    [toast, t, fetchAccounts, page, search],
  );

  /**
   * Re-points Telegram at our webhook.
   *
   * This is the one-button repair for the channel's worst failure. Telegram
   * discards undelivered updates after 24 hours and has no history API, so a
   * failing webhook is losing messages for as long as it stays broken.
   */
  const handleReregister = useCallback(
    async (account: TelegramAccount) => {
      setBusyId(account.id);
      const result = await reregisterTelegramWebhookAction(account.id);
      setBusyId(null);

      if (result.error) {
        toast({
          title: t("card.reregister"),
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: t("card.reregister"), description: t("notice.webhookFixed") });
      void fetchAccounts(page, search);
    },
    [toast, t, fetchAccounts, page, search],
  );

  // Counted over the current page, an at-a-glance read of what is on screen,
  // not a workspace-wide total.
  const activeCount = accounts.filter(
    (a) => a.status === "ACTIVE" && a.webhookHealthy,
  ).length;
  const attentionCount = accounts.filter((a) => telegramAccountIssue(a) !== null).length;

  const columns = useMemo<DashboardTableColumn<TelegramAccount>[]>(
    () => [
      {
        key: "account",
        header: t("table.account"),
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <TelegramLogoColor className="size-7 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{row.displayName}</span>
              {row.botName && (
                <span className="text-xs text-muted-foreground">{row.botName}</span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: t("table.status"),
        render: (row) => {
          const issue = telegramAccountIssue(row);
          return (
            <div className="flex flex-col gap-1">
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
                  STATUS_COLORS[row.status] ?? "bg-muted text-muted-foreground",
                )}
              >
                {t(`status.${row.status.toLowerCase()}`)}
              </span>

              {/* The two failure modes need different remedies, so they get
                  different copy rather than one generic "unhealthy" line. A dead
                  token needs a new token from BotFather; a failing webhook needs
                  one button, and is losing messages until it is pressed. */}
              {issue === "webhook" && (
                <span
                  className="flex max-w-[320px] items-start gap-1 text-xs text-warning-ink dark:text-warning-ink"
                  title={row.webhookLastError || t("card.webhookFailing")}
                >
                  <Warning weight="fill" className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span className="line-clamp-2">
                    {row.webhookPendingCount > 0
                      ? t("card.webhookBacklog", { count: row.webhookPendingCount })
                      : t("card.webhookFailing")}
                  </span>
                </span>
              )}

              {issue === "token" && (
                <span
                  className="flex max-w-[320px] items-start gap-1 text-xs text-destructive-ink"
                  title={row.statusReason}
                >
                  <Warning weight="fill" className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span className="line-clamp-2">{t("card.tokenInvalid")}</span>
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "mode",
        header: t("table.mode"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {t(`mode.${row.mode.toLowerCase()}`)}
          </span>
        ),
      },
      {
        key: "automation",
        header: t("table.automation"),
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.enableAgentResponses && <Chip label={t("automation.agent")} tone="emerald" />}
            {row.enableWorkflow && <Chip label={t("automation.workflow")} tone="sky" />}
            {!row.enableAgentResponses && !row.enableWorkflow && (
              <span className="text-xs text-muted-foreground">{t("automation.none")}</span>
            )}
          </div>
        ),
      },
      {
        key: "webhook",
        header: t("table.webhook"),
        render: (row) => (
          <div className="flex flex-col">
            <span
              className={cn(
                "text-sm",
                row.webhookHealthy ? "text-healthy-ink" : "text-warning-ink",
              )}
            >
              {row.webhookHealthy ? t("webhook.healthy") : t("webhook.failing")}
            </span>
            {/* Pending updates are a countdown, not a statistic: Telegram
                discards undelivered updates after 24 hours and has no history
                API, so the number is shown as soon as it is non-zero. */}
            {row.webhookPendingCount > 0 && (
              <span className="text-xs text-warning-ink dark:text-warning-ink tabular-nums">
                {t("webhook.pending", { count: row.webhookPendingCount })}
              </span>
            )}
          </div>
        ),
      },
    ],
    [t],
  );

  const renderRowActions = useCallback(
    (row: TelegramAccount) => {
      const issue = telegramAccountIssue(row);
      return (
        <div className="flex items-center gap-1">
          {issue === "webhook" && canUpdate && (
            <button
              type="button"
              disabled={busyId === row.id}
              onClick={(e) => {
                e.stopPropagation();
                void handleReregister(row);
              }}
              title={t("card.reregister")}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-warning-ink transition-colors hover:bg-muted disabled:opacity-50 dark:text-warning-ink dark:hover:bg-muted"
            >
              <ArrowClockwise
                className={cn("h-3.5 w-3.5", busyId === row.id && "animate-spin")}
                weight="bold"
              />
              {t("card.reregister")}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/telegram-accounts/${row.id}`);
            }}
            title={t("card.viewProfile")}
            className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Eye className="h-4 w-4" />
          </button>

          {canDelete && (
            <button
              type="button"
              disabled={busyId === row.id}
              onClick={(e) => {
                e.stopPropagation();
                void handleDisconnect(row);
              }}
              title={t("card.disconnect")}
              className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink disabled:opacity-50"
            >
              <Trash className="h-4 w-4" />
            </button>
          )}
        </div>
      );
    },
    [busyId, canDelete, canUpdate, handleDisconnect, handleReregister, router, t],
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
        icon={<TelegramLogoColor className="h-6 w-6" />}
        colorClass="text-info-ink"
        actions={
          canCreate ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/dashboard/telegram-accounts/connect">
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

      <div className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-card px-5 py-3 shadow-sm">
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
          <Stat label={t("stats.active")} value={loading ? "…" : activeCount} />
          <Stat label={t("stats.attention")} value={loading ? "…" : attentionCount} />
        </div>

        <Button
          variant="ghost"
          title=""
          icon={
            <ArrowClockwise weight="bold" className={cn("h-4 w-4", loading && "animate-spin")} />
          }
          iconVisible
          iconSide="left"
          onClick={() => void fetchAccounts(page, search)}
          disabled={loading}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <DashboardTable<TelegramAccount>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          loading
        />
      ) : accounts.length === 0 ? (
        <DashboardTable<TelegramAccount>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          emptyState={{
            // The brand mark reads as "nothing here yet" without being greyed
            // into illegibility; opacity keeps the empty state quiet.
            icon: <TelegramLogoColor className="h-7 w-7 opacity-40" />,
            title: t("page.emptyTitle"),
            description: t("page.emptyDescription"),
            action: canCreate ? (
              <div className="mt-2 flex items-center gap-3">
                <Link href="/dashboard/telegram-accounts/connect">
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
          <ElevatedContainer className="rounded-lg overflow-hidden border border-border !p-0">
            <DashboardTable<TelegramAccount>
              data={accounts}
              columns={columns}
              rowKey={(row) => row.id}
              onRowClick={(row) => router.push(`/dashboard/telegram-accounts/${row.id}`)}
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: "emerald" | "sky" }) {
  const tones = {
    // Solid tone, white ink, the CardPill rule. A tinted fill under same-hue
    // ink washes out, and these chips sit on both card and muted surfaces.
    emerald: "bg-healthy text-healthy-foreground",
    sky: "bg-muted text-muted-foreground",
  } as const;
  return (
    <span className={cn("rounded-[--radius] px-2 py-0.5 text-[11px] font-medium", tones[tone])}>
      {label}
    </span>
  );
}
