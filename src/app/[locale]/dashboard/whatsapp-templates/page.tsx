"use client";

import { motion } from "framer-motion";
import {
  ArrowClockwise,
  Buildings,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Shield,
  WhatsappLogo,
} from "@phosphor-icons/react";
import type {
  TemplateCategory,
  TemplateStatus,
  WhatsAppTemplate,
} from "@/lib/whatsapp-templates/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  listBusinessPhonesAction,
  listBusinessPhonesAdminAction,
} from "@/app/actions/whatsapp-business-phones";
import {
  listWhatsAppTemplatesAction,
  listWhatsAppTemplatesAdminAction,
  syncAllWhatsAppTemplatesAction,
} from "@/app/actions/whatsapp-templates";

const STATUS_COLORS: Record<TemplateStatus, string> = {
  APPROVED: "bg-emerald-500 text-white",
  PENDING: "bg-amber-500 text-white",
  REJECTED: "bg-rose-500 text-white",
  PAUSED: "bg-slate-500 text-white",
  DISABLED: "bg-slate-500 text-white",
};

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  MARKETING: "bg-purple-500 text-white",
  UTILITY: "bg-blue-500 text-white",
  AUTHENTICATION: "bg-orange-500 text-white",
};


const PAGE_SIZE = 25;

interface PageMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

interface WhatsAppTemplatesOverviewResponse {
  businessPhones: WhatsAppBusinessPhone[];
  templates: WhatsAppTemplate[];
  meta: PageMeta | null;
  error?: string | null;
}

interface SyncTemplatesResponse {
  success: boolean;
  error?: string | null;
  count: number;
  templates: WhatsAppTemplate[];
}

async function fetchWhatsAppTemplatesOverview(
  adminAllMode: boolean,
  params?: {
    page?: number;
    search?: string;
    status?: string;
    category?: string;
  },
): Promise<WhatsAppTemplatesOverviewResponse> {
  const listParams = {
    page: params?.page ?? 1,
    pageSize: PAGE_SIZE,
    search: params?.search,
    status:
      params?.status && params.status !== "all"
        ? (params.status as TemplateStatus)
        : undefined,
    category:
      params?.category && params.category !== "all"
        ? (params.category as TemplateCategory)
        : undefined,
  };

  const listTemplates = adminAllMode
    ? listWhatsAppTemplatesAdminAction
    : listWhatsAppTemplatesAction;
  const listPhones = adminAllMode
    ? listBusinessPhonesAdminAction
    : listBusinessPhonesAction;

  const [templatesResult, phonesResult] = await Promise.all([
    listTemplates(listParams),
    listPhones({ status: "CONNECTED", pageSize: 100 }),
  ]);

  const error = templatesResult.error ?? phonesResult.error ?? null;

  return {
    businessPhones: phonesResult.error ? [] : phonesResult.phones,
    templates: templatesResult.error ? [] : templatesResult.templates,
    meta: templatesResult.error ? null : templatesResult.meta,
    error,
  };
}

async function syncWhatsAppTemplates(
  businessPhoneId: string,
): Promise<SyncTemplatesResponse> {
  return syncAllWhatsAppTemplatesAction(businessPhoneId);
}

interface TemplatesPageProps {
  adminAllMode?: boolean;
}

export default function WhatsAppTemplatesPage({
  adminAllMode = false,
}: TemplatesPageProps = {}) {
  const t = useTranslations("whatsappTemplates");
  const { can } = useWorkspace();
  const { toast } = useToast();
  const router = useRouter();
  const tRef = useRef(t);
  const toastRef = useRef(toast);
  tRef.current = t;
  toastRef.current = toast;
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Server-side filters ("all" = unset). Backend is the source of truth.
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [businessPhones, setBusinessPhones] = useState<WhatsAppBusinessPhone[]>(
    [],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchWhatsAppTemplatesOverview(adminAllMode, {
        page,
        search: debouncedSearch || undefined,
        status: statusFilter,
        category: categoryFilter,
      });

      if (result.error) {
        toastRef.current({
          title: tRef.current("error.title"),
          description: result.error,
          variant: "destructive",
        });
      }

      setBusinessPhones(result.businessPhones ?? []);
      setTemplates(result.templates ?? []);
      setMeta(result.meta ?? null);
    } catch {
      toastRef.current({
        title: tRef.current("error.title"),
        description: tRef.current("error.default"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [adminAllMode, page, debouncedSearch, statusFilter, categoryFilter]);

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
  }, [statusFilter, categoryFilter]);

  const totalItems = meta?.totalItems ?? templates.length;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);

  const handleSync = async (phoneId: string) => {
    setSyncing(phoneId);
    try {
      const result = await syncWhatsAppTemplates(phoneId);
      if (result.error) {
        toast({
          title: t("toast.syncError"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("toast.syncSuccess"),
          description: t("toast.syncSuccessDescription", {
            count: result.count,
          }),
        });
        await fetchData();
      }
    } catch {
      toast({
        title: t("toast.syncError"),
        description: t("error.default"),
        variant: "destructive",
      });
    } finally {
      setSyncing(null);
    }
  };

  const approvedCount = useMemo(
    () => templates.filter((t) => t.status === "APPROVED").length,
    [templates],
  );
  const pendingCount = useMemo(
    () => templates.filter((t) => t.status === "PENDING").length,
    [templates],
  );
  const marketingCount = useMemo(
    () => templates.filter((t) => t.category === "MARKETING").length,
    [templates],
  );

  const columns = useMemo<DashboardTableColumn<WhatsAppTemplate>[]>(
    () => [
      {
        key: "name",
        header: t("card.name"),
        render: (row) => {
          const bodyText =
            row.components.find((c) => c.type === "BODY")?.text || "";
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {row.name}
              </span>
              {bodyText && (
                <span className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">
                  {bodyText.slice(0, 80)}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "business",
        header: t("card.business"),
        render: (row) => (
          <span
            className="block max-w-[180px] truncate text-sm text-foreground"
            title={row.wabaName || undefined}
          >
            {row.wabaName || t("waba.unknownAccount")}
          </span>
        ),
      },
      {
        key: "status",
        header: t("card.status"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              STATUS_COLORS[row.status] ?? "bg-slate-500 text-white",
            )}
          >
            {t(`status.${row.status.toLowerCase()}`)}
          </span>
        ),
      },
      {
        key: "category",
        header: t("card.category"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              CATEGORY_COLORS[row.category] ?? "bg-slate-500 text-white",
            )}
          >
            {t(`category.${row.category.toLowerCase()}`)}
          </span>
        ),
      },
      {
        key: "language",
        header: t("card.language"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.language.toUpperCase()}
          </span>
        ),
      },
      {
        key: "components",
        header: t("card.components"),
        render: (row) => (
          <span className="text-sm font-bold tabular-nums text-foreground">
            {row.components.length}
          </span>
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
    ],
    [t],
  );

  const renderRowActions = useCallback(
    (row: WhatsAppTemplate) => {
      if (adminAllMode) {
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/whatsapp-templates/${row.id}`);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Shield className="h-3.5 w-3.5" weight="bold" />
              {t("card.manageAccess")}
            </button>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-1">
          {can("whatsapp_templates", "send") && row.status === "APPROVED" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/whatsapp-templates/${row.id}/send`);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <PaperPlaneTilt className="h-3.5 w-3.5" weight="fill" />
              {t("card.send")}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/whatsapp-templates/${row.id}`);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <PencilSimple className="h-3.5 w-3.5" weight="bold" />
            {t("card.view")}
          </button>
        </div>
      );
    },
    [adminAllMode, can, router, t],
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-6"
    >
      <DashboardPageHeader
        icon={<WhatsappLogo className="h-6 w-6" weight="fill" />}
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
            : t("header.description")
        }
        colorClass="text-green-600"
        actions={
          can("whatsapp_templates", "create") && !adminAllMode ? (
            <Button
              variant="primary"
              title={t("button.create")}
              icon={<Plus className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              link="/dashboard/whatsapp-templates/new"
              newTab={false}
            />
          ) : undefined
        }
      />

      {adminAllMode && (
        <ElevatedContainer className="border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <Buildings
              weight="fill"
              className="h-5 w-5 flex-shrink-0 text-amber-600"
            />
            <p className="text-sm text-amber-900">
              {t.has("header.adminNotice")
                ? t("header.adminNotice")
                : t("header.description")}
            </p>
          </div>
        </ElevatedContainer>
      )}

      {/* Search + Stats bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 shadow-sm">
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
          {(["APPROVED", "PENDING", "REJECTED", "PAUSED"] as TemplateStatus[]).map(
            (s) => (
              <ElevatedSelectItem key={s} value={s}>
                {t(`status.${s.toLowerCase()}`)}
              </ElevatedSelectItem>
            ),
          )}
        </ElevatedSelect>
        <ElevatedSelect
          value={categoryFilter}
          onValueChange={setCategoryFilter}
          className="w-44"
        >
          <ElevatedSelectItem value="all">
            {t("filters.allCategory")}
          </ElevatedSelectItem>
          {(
            ["MARKETING", "UTILITY", "AUTHENTICATION"] as TemplateCategory[]
          ).map((c) => (
            <ElevatedSelectItem key={c} value={c}>
              {t(`category.${c.toLowerCase()}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        {can("whatsapp_templates", "create") && businessPhones[0] && (
          <Button
            variant="ghost"
            title=""
            icon={
              <ArrowClockwise
                className={cn("h-4 w-4", syncing !== null && "animate-spin")}
                weight="bold"
              />
            }
            iconVisible
            iconSide="left"
            onClick={() => handleSync(businessPhones[0].id)}
            disabled={syncing !== null}
          />
        )}
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
              {t("stats.approved")}
            </span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {loading ? "…" : approvedCount}
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
              {t("stats.marketing")}
            </span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {loading ? "…" : marketingCount}
            </span>
          </div>
        </div>
        {!loading && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {t("pagination.total", { total: totalItems })}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <DashboardTable<WhatsAppTemplate>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          loading
        />
      ) : templates.length === 0 ? (
        <DashboardTable<WhatsAppTemplate>
          data={[]}
          columns={columns}
          rowKey={(row) => row.id}
          emptyState={{
            icon: (
              <WhatsappLogo
                className="h-7 w-7 text-muted-foreground/40"
                weight="duotone"
              />
            ),
            title: searchQuery ? t("error.title") : t("empty.title"),
            description: searchQuery ? undefined : t("empty.description"),
          }}
        />
      ) : (
        <div className="space-y-4">
          <ElevatedContainer className="overflow-hidden border border-border/70 !p-0">
            <DashboardTable<WhatsAppTemplate>
              data={templates}
              columns={columns}
              rowKey={(row) => row.id}
              onRowClick={(row) =>
                router.push(`/dashboard/whatsapp-templates/${row.id}`)
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
    </motion.main>
  );
}
