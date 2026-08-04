"use client";

import { motion } from "framer-motion";
import {
  ArrowClockwise,
  Buildings,
  CaretLeft,
  CaretRight,
  CheckCircle,
  CircleNotch,
  Eye,
  Info,
  MagnifyingGlass,
  Phone,
  Plus,
  PuzzlePiece,
  Warning,
  WhatsappLogo,
} from "@/components/icons";
import type {
  BusinessPhoneStatus,
  QualityRating,
  WhatsAppBusinessPhone,
} from "@/lib/whatsapp-business-phones/types";
import {
  assignPhoneOwnerAction,
  listBusinessPhonesAction,
  listBusinessPhonesAdminAction,
  retryDialog360OnboardingAction,
} from "@/app/actions/whatsapp-business-phones";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import WhatsAppCapacityCard from "@/components/dashboard/addons/WhatsAppCapacityCard";
import { useWhatsAppCapacity } from "@/hooks/use-whatsapp-capacity";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import Link from "next/link";

import { fetchWorkspace, fetchWorkspaces } from "@/lib/workspace/client";
import type { Workspace } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const STATUS_COLORS: Record<BusinessPhoneStatus, string> = {
  PENDING: "bg-warning text-warning-foreground",
  VERIFYING: "bg-muted text-muted-foreground",
  CONNECTED: "bg-healthy text-healthy-foreground",
  DISCONNECTED: "bg-muted text-muted-foreground",
  BANNED: "bg-destructive text-destructive-foreground",
  FLAGGED: "bg-orange-500 text-white",
  RESTRICTED: "bg-yellow-500 text-white",
  RATE_LIMITED: "bg-muted text-muted-foreground",
  UNVERIFIED: "bg-orange-500 text-white",
  ONBOARDING_FAILED: "bg-destructive text-destructive-foreground",
  DELETED: "bg-muted text-muted-foreground",
};

const QUALITY_COLORS: Record<QualityRating, string> = {
  GREEN: "bg-healthy text-healthy-foreground",
  YELLOW: "bg-warning text-warning-foreground",
  RED: "bg-destructive text-destructive-foreground",
  UNKNOWN: "bg-muted text-muted-foreground",
  NA: "bg-muted text-muted-foreground",
};


const PAGE_SIZE = 25;

interface PageMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

interface BusinessPhonesOverviewResponse {
  phones: WhatsAppBusinessPhone[];
  meta: PageMeta | null;
  error?: string | null;
}

interface AssignPhoneOwnerResponse {
  data: WhatsAppBusinessPhone | null;
  error?: string | null;
}

async function fetchWhatsAppBusinessPhonesOverview(
  adminAllMode: boolean,
  params?: {
    page?: number;
    search?: string;
    status?: string;
    quality?: string;
  },
): Promise<BusinessPhonesOverviewResponse> {
  const listPhones = adminAllMode
    ? listBusinessPhonesAdminAction
    : listBusinessPhonesAction;

  const result = await listPhones({
    page: params?.page ?? 1,
    pageSize: PAGE_SIZE,
    search: params?.search,
    status:
      params?.status && params.status !== "all"
        ? (params.status as BusinessPhoneStatus)
        : undefined,
    qualityRating:
      params?.quality && params.quality !== "all"
        ? (params.quality as QualityRating)
        : undefined,
  });

  return {
    phones: result.error ? [] : result.phones,
    meta: result.error ? null : result.meta,
    error: result.error ?? null,
  };
}

async function assignBusinessPhoneOwner(
  phoneId: string,
  workspaceId: string,
): Promise<AssignPhoneOwnerResponse> {
  return assignPhoneOwnerAction(phoneId, workspaceId);
}

interface BusinessPhonesPageProps {
  adminAllMode?: boolean;
}

export default function WhatsAppBusinessPhonesPage({
  adminAllMode = false,
}: BusinessPhonesPageProps = {}) {
  const t = useTranslations("whatsappBusinessPhones");
  const { toast } = useToast();
  const router = useRouter();
  const { can } = useWorkspace();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canManagePhones = can("business_phones", "create");
  const [searchQuery, setSearchQuery] = useState("");
  const [phones, setPhones] = useState<WhatsAppBusinessPhone[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PageMeta | null>(null);

  // Capacity: with server-side pagination the page is not the full list, so the hook
  // fetches the workspace's active number count itself (same path the connect page uses).
  const capacity = useWhatsAppCapacity();
  // Route past the connect flow only once we know there is no free slot (at limit
  // or no allowance at all). While capacity is still loading we stay optimistic.
  const gateToAddons = capacity.ready && !capacity.canAdd;
  const addNumberHref = gateToAddons
    ? "/dashboard/addons"
    : "/dashboard/whatsapp-business-phones/connect";
  const [loading, setLoading] = useState(true);

  const [isRefreshing, startRefresh] = useTransition();
  // Debounced search term actually sent to the server (searchQuery is the raw input).
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Server-side filters ("all" = unset). The backend is the source of truth; nothing
  // is filtered client-side.
  const [statusFilter, setStatusFilter] = useState("all");
  const [qualityFilter, setQualityFilter] = useState("all");

  const [ownerWorkspaces, setOwnerWorkspaces] = useState<
    Record<string, Workspace>
  >({});
  const [assigningOwner, setAssigningOwner] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchWhatsAppBusinessPhonesOverview(adminAllMode, {
        page,
        search: debouncedSearch || undefined,
        status: statusFilter,
        quality: qualityFilter,
      });

      if (result.error) {
        toast({
          title: t("error.title"),
          description: result.error,
          variant: "destructive",
        });
      }

      setPhones(result.phones ?? []);
      setMeta(result.meta ?? null);
    } catch {
      toast({
        title: t("error.title"),
        description: t("error.default"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [t, toast, adminAllMode, page, debouncedSearch, statusFilter, qualityFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Debounce the search box, and reset to page 1 whenever the term changes.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Any filter change starts back at page 1.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, qualityFilter]);

  useEffect(() => {
    if (!isAdmin) return;

    const ownerIds = Array.from(
      new Set(
        phones
          .map((phone) => phone.ownerWorkspaceId)
          .filter((workspaceId): workspaceId is string => Boolean(workspaceId)),
      ),
    );
    const missingIds = ownerIds.filter(
      (workspaceId) => !ownerWorkspaces[workspaceId],
    );
    if (missingIds.length === 0) {
      return;
    }

    Promise.all(
      missingIds.map((workspaceId) => fetchWorkspace(workspaceId)),
    ).then((results) => {
      const next: Record<string, Workspace> = {};
      results.forEach((result) => {
        if (result.workspace) {
          next[result.workspace.id] = result.workspace;
        }
      });
      if (Object.keys(next).length > 0) {
        setOwnerWorkspaces((prev) => ({ ...prev, ...next }));
      }
    });
  }, [isAdmin, phones, ownerWorkspaces]);

  const handleAssignOwner = async (phoneId: string, workspaceId: string) => {
    setAssigningOwner(true);
    const result = await assignBusinessPhoneOwner(phoneId, workspaceId);
    setAssigningOwner(false);

    if (result.error) {
      toast({
        title: t("ownership.assignError"),
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: t("ownership.assignSuccess"),
        description: t("ownership.assignSuccessDesc"),
      });
      setPhones((prev) =>
        prev.map((p) =>
          p.id === phoneId ? { ...p, ownerWorkspaceId: workspaceId } : p,
        ),
      );
    }
  };

  const workspaceMap = useMemo(() => {
    const map = new Map<string, Workspace>();
    Object.values(ownerWorkspaces).forEach((workspace) => {
      map.set(workspace.id, workspace);
    });
    return map;
  }, [ownerWorkspaces]);

  const workspaceSelect = usePaginatedSelect<Workspace>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await fetchWorkspaces({
        page,
        pageSize: 20,
        search: search || undefined,
      });
      return { items: result.workspaces, totalPages: result.totalPages ?? 1 };
    }, []),
    mapOption: useCallback(
      (workspace: Workspace) => {
        const ownerDisplay =
          workspace.ownerName ??
          workspace.ownerEmail ??
          workspace.ownerId.slice(0, 8) + "...";
        return {
          label: workspace.name,
          value: workspace.id,
          description: `${t("access.owner")}: ${ownerDisplay}${workspace.isDefault ? " · default" : ""}`,
          icon: <Buildings className="h-4 w-4" weight="fill" />,
        };
      },
      [t],
    ),
    enabled: isAdmin,
  });

  const handleRefresh = () => {
    startRefresh(async () => {
      await fetchData();
    });
  };

  const totalItems = meta?.totalItems ?? phones.length;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);


  const connectedCount = phones.filter((p) => p.status === "CONNECTED").length;
  const pendingCount = phones.filter(
    (p) => p.status === "PENDING" || p.status === "VERIFYING",
  ).length;
  const greenQualityCount = phones.filter(
    (p) => p.qualityRating === "GREEN",
  ).length;

  const getStatusLabel = (status: BusinessPhoneStatus) => {
    const key = status.toLowerCase().replace("_", "");
    return t(`status.${key}`);
  };

  const getQualityLabel = (quality: QualityRating) => {
    const key = quality ? quality.toLowerCase() : "unknown";
    return t(`qualityRating.${key}`);
  };

  const columns = useMemo<DashboardTableColumn<WhatsAppBusinessPhone>[]>(() => {
    const baseColumns: DashboardTableColumn<WhatsAppBusinessPhone>[] = [
      {
        key: "phone",
        header: t("card.phoneNumber"),
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-healthy/10">
              <WhatsappLogo
                weight="fill"
                className="h-3.5 w-3.5 text-healthy"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {row.displayPhoneNumber}
              </span>
              {row.verifiedName && (
                <span className="text-xs text-muted-foreground">
                  {row.verifiedName}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: t("card.status"),
        render: (row) =>
          row.status === "PENDING" && row.provider === "dialog360" ? (
            // Provisioning is async at 360dialog (~30-60s after redirect): show a clear
            // "connecting" state instead of an empty-looking pending row.
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-warning px-2.5 py-0.5 text-xs font-medium text-white">
              <CircleNotch className="h-3 w-3 animate-spin" weight="bold" />
              {t("status.connecting")}
            </span>
          ) : (
          <div className="flex flex-col gap-1">
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
                STATUS_COLORS[row.status] ?? "bg-muted text-muted-foreground",
              )}
            >
              {getStatusLabel(row.status)}
            </span>
            {row.status === "ONBOARDING_FAILED" && row.onboardingError && (
              <span
                className="flex max-w-[240px] items-start gap-1 text-xs text-destructive"
                title={row.onboardingError}
              >
                <Warning
                  weight="fill"
                  className="mt-0.5 h-3 w-3 flex-shrink-0"
                />
                <span className="line-clamp-2">{row.onboardingError}</span>
              </span>
            )}
          </div>
          ),
      },
      {
        key: "business",
        header: t("card.business"),
        render: (row) => (
          <span
            className="block max-w-[200px] truncate text-sm text-foreground"
            title={row.wabaName || undefined}
          >
            {row.wabaName || t("waba.unknownAccount")}
          </span>
        ),
      },
      {
        key: "quality",
        header: t("card.quality"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
              QUALITY_COLORS[row.qualityRating] ?? "bg-muted text-muted-foreground",
            )}
          >
            {getQualityLabel(row.qualityRating)}
          </span>
        ),
      },
      {
        key: "official",
        header: t("card.official"),
        render: (row) =>
          row.isOfficialBusiness ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-healthy">
              <CheckCircle weight="fill" className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">,</span>
          ),
      },
      {
        key: "createdAt",
        header: t("card.createdAt"),
        render: (row) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {new Date(row.createdAt).toLocaleDateString()}
          </span>
        ),
      },
    ];

    if (isAdmin) {
      baseColumns.splice(4, 0, {
        key: "owner",
        header: t("ownership.label"),
        render: (row) => {
          const ws = row.ownerWorkspaceId
            ? workspaceMap.get(row.ownerWorkspaceId)
            : null;
          const selectedWorkspaceOption = ws
            ? {
                label: ws.name,
                value: ws.id,
                description: `${t("access.owner")}: ${ws.ownerName ?? ws.ownerEmail ?? ws.ownerId.slice(0, 8) + "..."}${ws.isDefault ? " · default" : ""}`,
                icon: <Buildings className="h-4 w-4" weight="fill" />,
              }
            : null;
          const commandOptions =
            selectedWorkspaceOption &&
            !workspaceSelect.options.some(
              (option) => option.value === selectedWorkspaceOption.value,
            )
              ? [selectedWorkspaceOption, ...workspaceSelect.options]
              : workspaceSelect.options;

          return (
            <div className="min-w-[180px]" onClick={(e) => e.stopPropagation()}>
              <ElevatedCommandSelect
                label={t("ownership.selectWorkspace")}
                value={row.ownerWorkspaceId ?? null}
                searchPlaceholder={t("ownership.searchWorkspaces")}
                emptyMessage={t("access.noWorkspacesFound")}
                disabled={assigningOwner}
                fullWidth
                onValueChange={(val) => handleAssignOwner(row.id, val)}
                options={commandOptions}
                onSearch={workspaceSelect.onSearch}
                onScrollEnd={workspaceSelect.onScrollEnd}
                onOpenChange={workspaceSelect.onOpenChange}
                isLoading={workspaceSelect.isLoading}
              />
            </div>
          );
        },
      });
    }

    return baseColumns;
  }, [t, isAdmin, workspaceMap, assigningOwner, workspaceSelect]);

  const handleRetryOnboarding = useCallback(
    async (phoneId: string, workspaceId: string | null | undefined) => {
      if (!workspaceId) {
        toast({
          title: t("onboarding.retryErrorTitle"),
          description: t("onboarding.retryErrorTitle"),
          variant: "destructive",
        });
        return;
      }
      setRetryingId(phoneId);
      try {
        const result = await retryDialog360OnboardingAction(phoneId, workspaceId);
        if (result.error) {
          toast({
            title: t("onboarding.retryErrorTitle"),
            description: result.error,
            variant: "destructive",
          });
          return;
        }
        toast({
          title: t("onboarding.retrySuccessTitle"),
          description: t("onboarding.retrySuccessDescription"),
        });
        await fetchData();
      } finally {
        setRetryingId(null);
      }
    },
    [t, toast, fetchData],
  );

  const renderRowActions = useCallback(
    (row: WhatsAppBusinessPhone) => {
      if (adminAllMode) {
        return null;
      }

      const isFailed = row.status === "ONBOARDING_FAILED";

      return (
        <div className="flex items-center gap-1">
          {isFailed && (
            <button
              type="button"
              disabled={retryingId === row.id}
              onClick={(e) => {
                e.stopPropagation();
                void handleRetryOnboarding(row.id, row.ownerWorkspaceId);
              }}
              title={row.onboardingError || t("onboarding.retry")}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <ArrowClockwise
                className={cn(
                  "h-3.5 w-3.5",
                  retryingId === row.id && "animate-spin",
                )}
                weight="bold"
              />
              {t("onboarding.retry")}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/whatsapp-business-phones/${row.id}`);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Eye className="h-3.5 w-3.5" weight="bold" />
            {t("card.view")}
          </button>
        </div>
      );
    },
    [adminAllMode, router, t, retryingId, handleRetryOnboarding],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-6"
    >
      <DashboardPageHeader
        icon={<Phone className="h-6 w-6" weight="fill" />}
        badge={
          adminAllMode && t.has("header.adminBadge")
            ? t("header.adminBadge")
            : t("header.badge")
        }
        description={
          adminAllMode
            ? t.has("header.adminDescription")
              ? t("header.adminDescription")
              : t("header.description")
            : canManagePhones
              ? t("header.description")
              : t("header.descriptionUser")
        }
        colorClass="text-healthy"
        actions={
          canManagePhones && !adminAllMode ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link href={addNumberHref}>
                <Button
                  variant="primary"
                  title={
                    gateToAddons ? t("capacity.buyMore") : t("button.howToAdd")
                  }
                  icon={
                    gateToAddons ? (
                      <PuzzlePiece weight="bold" className="h-4 w-4" />
                    ) : (
                      <Plus weight="bold" className="h-4 w-4" />
                    )
                  }
                  iconVisible
                  iconSide="left"
                />
              </Link>
            </div>
          ) : undefined
        }
      />

      {!adminAllMode && <WhatsAppCapacityCard capacity={capacity} />}

      {adminAllMode && (
        <ElevatedContainer className="border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <Info
              weight="fill"
              className="h-5 w-5 flex-shrink-0 text-warning"
            />
            <p className="text-sm text-amber-900">
              {t.has("header.adminNotice")
                ? t("header.adminNotice")
                : t("header.description")}
            </p>
          </div>
        </ElevatedContainer>
      )}

      {/* User Info Box - Non-admin only */}
      {!canManagePhones && !adminAllMode && (
        <ElevatedContainer className="p-4 bg-muted border-blue-100">
          <div className="flex items-center gap-3">
            <Info
              weight="fill"
              className="h-5 w-5 text-lamp-ink flex-shrink-0"
            />
            <p className="text-sm text-blue-800">{t("userAccess.info")}</p>
          </div>
        </ElevatedContainer>
      )}

      {/* Search + Stats bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-card px-5 py-3 shadow-sm">
        <div className="relative w-full max-w-xs">
          <ElevatedInput
            type="text"
            label={t("search.placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
            controlSize="sm"
            className="w-full"
          />
        </div>
        <ElevatedSelect
          value={statusFilter}
          onValueChange={setStatusFilter}
          className="w-44"
        >
          <ElevatedSelectItem value="all">
            {t("filters.allStatus")}
          </ElevatedSelectItem>
          {(
            [
              "CONNECTED",
              "PENDING",
              "DISCONNECTED",
              "ONBOARDING_FAILED",
              "SUSPENDED",
            ] as BusinessPhoneStatus[]
          ).map((s) => (
            <ElevatedSelectItem key={s} value={s}>
              {getStatusLabel(s)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedSelect
          value={qualityFilter}
          onValueChange={setQualityFilter}
          className="w-40"
        >
          <ElevatedSelectItem value="all">
            {t("filters.allQuality")}
          </ElevatedSelectItem>
          {(["GREEN", "YELLOW", "RED"] as QualityRating[]).map((q) => (
            <ElevatedSelectItem key={q} value={q}>
              {getQualityLabel(q)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {t("stats.total")}
            </span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {loading ? "…" : totalItems}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {t("stats.connected")}
            </span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {loading ? "…" : connectedCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {t("stats.pending")}
            </span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {loading ? "…" : pendingCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {t("stats.quality")}
            </span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {loading ? "…" : `${greenQualityCount}/${phones.length}`}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          title=""
          icon={
            <ArrowClockwise
              weight="bold"
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
          }
          iconVisible
          iconSide="left"
          onClick={handleRefresh}
          disabled={isRefreshing}
        />
        {!loading && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {t("pagination.total", { total: totalItems })}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <DashboardTable<WhatsAppBusinessPhone>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          loading
        />
      ) : phones.length === 0 ? (
        <DashboardTable<WhatsAppBusinessPhone>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          emptyState={{
            icon: (
              <Phone
                className="h-7 w-7 text-muted-foreground/40"
                weight="duotone"
              />
            ),
            title: t("empty.title"),
            description: t("empty.description"),
            action:
              canManagePhones && !adminAllMode ? (
                <div className="flex items-center gap-3 mt-2">
                  <Link href={addNumberHref}>
                    <Button
                      variant="primary"
                      title={
                        gateToAddons
                          ? t("capacity.buyMore")
                          : t("empty.registerButton")
                      }
                      icon={
                        gateToAddons ? (
                          <PuzzlePiece weight="bold" className="h-4 w-4" />
                        ) : (
                          <Plus weight="bold" className="h-4 w-4" />
                        )
                      }
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
          <ElevatedContainer className="overflow-hidden border border-border !p-0">
            <DashboardTable<WhatsAppBusinessPhone>
              data={phones}
              columns={columns}
              rowKey={(row) => row.id}
              onRowClick={
                adminAllMode
                  ? undefined
                  : (row) =>
                      router.push(
                        `/dashboard/whatsapp-business-phones/${row.id}`,
                      )
              }
              renderRowActions={renderRowActions}
              className="border-0 shadow-none rounded-none"
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CaretLeft className="h-3.5 w-3.5" weight="bold" />
                  {t("pagination.previous")}
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
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
