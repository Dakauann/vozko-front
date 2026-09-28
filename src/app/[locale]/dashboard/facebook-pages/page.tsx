"use client";

import { ArrowClockwise, Eye, FacebookLogo, MagnifyingGlass, Plus, Trash, Warning } from "@/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { disconnectFacebookPageAction, listFacebookPagesAction } from "@/app/actions/facebook";
import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import { CapabilityChip } from "@/components/channels/channel-profile-parts";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ChannelListPagination, ChannelListStat } from "@/components/channels/channel-list-parts";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { useFacebookError } from "@/components/facebook/use-facebook-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useWorkspace } from "@/contexts/workspace-context";
import { useFacebookConnect } from "@/hooks/use-facebook-connect";
import { useToast } from "@/hooks/use-toast";
import { FACEBOOK_PAGES_PATH, connectResultFromQuery, isConnectedOutcome } from "@/lib/facebook/connect";
import { displayStatus, pageNotices, type FacebookDisplayStatus } from "@/lib/facebook/page";
import type { FacebookCapability, FacebookConnectResult, FacebookPage } from "@/lib/facebook/types";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 15;
const LISTED_CAPABILITIES: FacebookCapability[] = ["messaging", "publish", "moderate"];

const STATUS_COLORS: Record<FacebookDisplayStatus, string> = {
  PENDING: "bg-warning text-warning-foreground",
  CONNECTED: "bg-healthy text-healthy-foreground",
  TOKEN_REVOKED: "bg-destructive text-destructive-foreground",
  NEEDS_ROLE: "bg-destructive text-destructive-foreground",
  RESTRICTED: "bg-destructive text-destructive-foreground",
  DISCONNECTED: "bg-muted text-muted-foreground",
  ROUTING_OFF: "bg-warning text-warning-foreground",
};

export default function FacebookPagesPage() {
  const t = useTranslations("facebook");
  const { can } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const describeError = useFacebookError();

  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<FacebookPage | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canCreate = can("facebook_pages", "create");
  const canDelete = can("facebook_pages", "delete");

  const load = useCallback(
    (nextPage: number, term: string) =>
      listFacebookPagesAction(nextPage, ITEMS_PER_PAGE, term || undefined).then((result) => {
        if ("error" in result && result.error) {
          setError(result.error);
        } else {
          setError(null);
          setPages(result.pages);
          setPage(result.meta.page);
          setTotalPages(result.meta.totalPages);
          setTotalItems(result.meta.totalItems);
        }
        setLoading(false);
      }),
    [],
  );

  const fetchPages = useCallback(
    (nextPage = 1, term = "") => {
      setLoading(true);
      return load(nextPage, term);
    },
    [load],
  );

  useEffect(() => {
    void load(1, "");
  }, [load]);

  const reportResult = useCallback(
    (result: FacebookConnectResult) => {
      if (result.status === "cancelled") return;
      if (result.status === "error") {
        toast({
          title: t("connect.errorTitle"),
          description: t(`connectError.${result.reason ?? "connect_failed"}`),
          variant: "destructive",
        });
        return;
      }
      const connected = result.pages
        ? result.pages.filter((p) => isConnectedOutcome(p.outcome)).length
        : (result.connected ?? 0);
      const skipped = result.pages ? result.pages.length - connected : (result.skipped ?? 0);
      toast({
        title: result.status === "partial" ? t("connect.partialTitle") : t("connect.successTitle"),
        description: t("notice.connectedCount", { connected, skipped }),
        variant: result.status === "partial" ? "destructive" : undefined,
      });
      void load(1, "");
    },
    [toast, t, load],
  );

  const { connect, isConnecting } = useFacebookConnect(reportResult);

  useEffect(() => {
    const result = connectResultFromQuery(new URLSearchParams(searchParams.toString()));
    if (!result) return;
    reportResult(result);
    router.replace(FACEBOOK_PAGES_PATH);
  }, [searchParams, router, reportResult]);

  const confirmDisconnect = useCallback(async () => {
    if (!disconnecting) return;
    const target = disconnecting;
    setDisconnecting(null);
    setBusyId(target.id);
    const result = await disconnectFacebookPageAction(target.id);
    setBusyId(null);
    if ("error" in result) {
      toast({ title: t("card.disconnect"), description: describeError(result), variant: "destructive" });
      return;
    }
    toast({
      title: t("card.disconnect"),
      description: result.warning
        ? t("notice.disconnectedWithWarning", { name: target.name })
        : t("notice.disconnected", { name: target.name }),
      variant: result.warning ? "destructive" : undefined,
    });
    void fetchPages(page, search);
  }, [disconnecting, toast, t, describeError, fetchPages, page, search]);

  const connectedCount = pages.filter((p) => p.status === "CONNECTED").length;
  const attentionCount = pages.filter((p) => pageNotices(p).some((n) => n !== "routingUnknown")).length;

  const columns = useMemo<DashboardTableColumn<FacebookPage>[]>(
    () => [
      {
        key: "page",
        header: t("table.page"),
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <ChannelAvatarImage url={row.pictureUrl} name={row.name} seed={row.id} className="size-7" textClassName="text-2xs" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
              {row.category ? <span className="text-xs text-muted-foreground">{row.category}</span> : null}
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: t("table.status"),
        render: (row) => {
          const status = displayStatus(row);
          return (
            <div className="flex flex-col gap-1">
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
                  STATUS_COLORS[status],
                )}
              >
                {t(`status.${status.toLowerCase()}`)}
              </span>
              {row.needsReconnect && row.statusReason ? (
                <span className="flex max-w-[280px] items-start gap-1 text-xs text-destructive-ink" title={row.statusReason}>
                  <Warning weight="fill" className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span className="line-clamp-2">{row.statusReason}</span>
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "capabilities",
        header: t("table.capabilities"),
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            {LISTED_CAPABILITIES.map((capability) => (
              <CapabilityChip key={capability} enabled={row.capabilities[capability]} label={t(`capability.${capability}`)} />
            ))}
          </div>
        ),
      },
      {
        key: "followers",
        header: t("card.followers"),
        render: (row) => <span className="text-sm text-foreground">{row.followersCount.toLocaleString()}</span>,
      },
    ],
    [t],
  );

  const renderRowActions = useCallback(
    (row: FacebookPage) => (
      <div className="flex items-center gap-1">
        {row.needsReconnect && canCreate && (
          <button
            type="button"
            disabled={isConnecting}
            onClick={(e) => {
              e.stopPropagation();
              connect(FACEBOOK_PAGES_PATH);
            }}
            title={t("card.reconnect")}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-destructive-ink transition-colors hover:bg-muted disabled:opacity-50"
          >
            <ArrowClockwise className={cn("h-3.5 w-3.5", isConnecting && "animate-spin")} weight="bold" />
            {t("card.reconnect")}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`${FACEBOOK_PAGES_PATH}/${row.id}`);
          }}
          title={t("card.view")}
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
              setDisconnecting(row);
            }}
            title={t("card.disconnect")}
            className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink disabled:opacity-50"
          >
            <Trash className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
    [canCreate, canDelete, connect, busyId, isConnecting, router, t],
  );

  const connectButton = canCreate ? (
    <Link href={`${FACEBOOK_PAGES_PATH}/connect`}>
      <Button
        variant="primary"
        title={t("page.connect")}
        icon={<Plus weight="bold" className="h-4 w-4" />}
        iconVisible
        iconSide="left"
      />
    </Link>
  ) : undefined;

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader
        badge={t("page.title")}
        description={t("page.description")}
        icon={<FacebookLogo className="h-6 w-6" weight="fill" />}
        colorClass="text-chart-2"
        actions={connectButton}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-card px-5 py-3 shadow-sm">
        <div className="relative w-full max-w-xs">
          <ElevatedInput
            type="text"
            label={t("page.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void fetchPages(1, search);
            }}
            icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
            controlSize="sm"
            className="w-full"
          />
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <ChannelListStat label={t("stats.total")} value={loading ? "…" : totalItems} />
          <ChannelListStat label={t("stats.connected")} value={loading ? "…" : connectedCount} />
          <ChannelListStat label={t("stats.attention")} value={loading ? "…" : attentionCount} />
        </div>
        <Button
          variant="ghost"
          title=""
          icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", loading && "animate-spin")} />}
          iconVisible
          iconSide="left"
          onClick={() => void fetchPages(page, search)}
          disabled={loading}
        />
        {!loading && (
          <span className="whitespace-nowrap text-xs text-muted-foreground">{t("pagination.total", { total: totalItems })}</span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <DashboardTable<FacebookPage> data={[]} columns={columns} rowKey={(row) => row.id} loading />
      ) : pages.length === 0 ? (
        <DashboardTable<FacebookPage>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          emptyState={{
            icon: <FacebookLogo className="h-7 w-7 text-muted-foreground" weight="duotone" />,
            title: t("page.emptyTitle"),
            description: t("page.emptyDescription"),
            action: connectButton ? <div className="mt-2 flex items-center gap-3">{connectButton}</div> : undefined,
          }}
        />
      ) : (
        <div className="space-y-4">
          <ElevatedContainer className="overflow-hidden rounded-lg border border-border !p-0">
            <DashboardTable<FacebookPage>
              data={pages}
              columns={columns}
              rowKey={(row) => row.id}
              onRowClick={(row) => router.push(`${FACEBOOK_PAGES_PATH}/${row.id}`)}
              renderRowActions={renderRowActions}
              className="rounded-none border-0 shadow-none"
            />
          </ElevatedContainer>

          <ChannelListPagination
            page={page}
            totalPages={totalPages}
            loading={loading}
            labels={{
              pageOf: t("pagination.pageOf", { page, totalPages }),
              previous: t("pagination.previous"),
              next: t("pagination.next"),
            }}
            onPage={(next) => void fetchPages(next, search)}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!disconnecting}
        onOpenChange={(open) => !open && setDisconnecting(null)}
        title={t("card.disconnectTitle")}
        description={t("card.disconnectBody", { name: disconnecting?.name ?? "" })}
        confirmLabel={t("card.disconnect")}
        onConfirm={() => void confirmDisconnect()}
      />
    </div>
  );
}
