"use client";

import {
  Archive,
  ArrowUp,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Sparkle,
  Trash,
} from "@/components/icons";
import {
  adminArchiveTemplateAction,
  adminDeleteTemplateAction,
  adminListTemplatesAction,
  adminPublishTemplateAction,
} from "@/app/actions/resource-templates";
import { useEffect, useMemo, useState } from "react";

import type { ResourceTemplate } from "@/lib/resource-templates/types";
import {
  RESOURCE_TYPE_LABELS,
  CATEGORY_LABELS,
} from "@/lib/resource-templates/types";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

export default function AdminResourceTemplatesPage() {
  const t = useTranslations("resourceTemplates");
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [templates, setTemplates] = useState<ResourceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ page: 1, search: "" });
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchInput.trim();
      setFilters((prev) =>
        prev.search === nextSearch
          ? prev
          : { ...prev, page: 1, search: nextSearch },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function fetchTemplates() {
      setLoading(true);
      setError(null);
      try {
        const result = await adminListTemplatesAction({
          page: filters.page,
          pageSize: PAGE_SIZE,
          search: filters.search || undefined,
        });

        if (cancelled) return;

        if (result.error) {
          setError(result.error);
          setTemplates([]);
          setTotalPages(1);
          setTotalItems(0);
        } else {
          setTemplates(result.templates ?? []);
          setTotalPages(result.meta.totalPages);
          setTotalItems(result.meta.totalItems);
        }
      } catch {
        if (cancelled) return;
        setError(t("error.default"));
        setTemplates([]);
        setTotalPages(1);
        setTotalItems(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTemplates();
    return () => {
      cancelled = true;
    };
  }, [filters.page, filters.search, reloadKey, t]);

  const handlePublish = async (id: string) => {
    const result = await adminPublishTemplateAction(id);
    if (!result.error) setReloadKey((prev) => prev + 1);
  };

  const handleArchive = async (id: string) => {
    const result = await adminArchiveTemplateAction(id);
    if (!result.error) setReloadKey((prev) => prev + 1);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("form.deleteConfirm"))) return;
    const result = await adminDeleteTemplateAction(id);
    if (!result.error) {
      if (templates.length === 1 && filters.page > 1) {
        setFilters((prev) => ({ ...prev, page: prev.page - 1 }));
        return;
      }
      setReloadKey((prev) => prev + 1);
    }
  };

  const published = templates.filter((t) => t.status === "published").length;
  const draft = templates.filter((t) => t.status === "draft").length;
  const archived = templates.filter((t) => t.status === "archived").length;
  const totalInstalls = templates.reduce(
    (acc, t) => acc + (t.installCount ?? 0),
    0,
  );

  const columns = useMemo<DashboardTableColumn<ResourceTemplate>[]>(
    () => [
      {
        key: "name",
        header: t("form.name"),
        render: (row) => (
          <div className="flex items-center gap-3">
            {row.icon ? (
              <img
                src={row.icon}
                alt=""
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <Sparkle className="h-4 w-4" weight="fill" />
              </div>
            )}
            <span className="text-sm font-medium text-foreground">
              {row.name}
            </span>
          </div>
        ),
      },
      {
        key: "resourceType",
        header: t("form.resourceType"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {RESOURCE_TYPE_LABELS[row.resourceType] ?? row.resourceType}
          </span>
        ),
      },
      {
        key: "category",
        header: t("form.category"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {CATEGORY_LABELS[row.category] ?? row.category}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
              row.status === "published"
                ? "bg-healthy text-white"
                : row.status === "draft"
                  ? "bg-warning text-white"
                  : "bg-muted text-white",
            )}
          >
            {t(`status.${row.status}`)}
          </span>
        ),
      },
      {
        key: "installCount",
        header: t("stats.installs"),
        render: (row) => (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {row.installCount ?? 0}
          </span>
        ),
      },
      {
        key: "featured",
        header: t("catalog.featured"),
        render: (row) =>
          row.isFeatured ? (
            <span className="inline-flex items-center rounded-[--radius] bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
              <Sparkle className="mr-1 h-3 w-3" weight="fill" />
              {t("catalog.featured")}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">,</span>
          ),
      },
      {
        key: "createdAt",
        header: "Created",
        render: (row) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {new Date(row.createdAt).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      <DashboardPageHeader
        icon={<Sparkle className="h-6 w-6" weight="fill" />}
        badge={t("admin.badge")}
        description={t("admin.description")}
        actions={
          <Button
            variant="primary"
            title={t("admin.create")}
            icon={<Plus className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            link="/dashboard/resource-templates/admin/new"
            newTab={false}
          />
        }
      />

      <DashboardTable<ResourceTemplate>
        data={templates}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) =>
          router.push(`/dashboard/resource-templates/admin/${row.id}`)
        }
        stats={[
          {
            label: t("stats.total"),
            value: loading ? "..." : totalItems,
          },
          {
            label: t("stats.published"),
            value: loading ? "..." : published,
          },
          {
            label: t("stats.draft"),
            value: loading ? "..." : draft,
          },
          {
            label: t("stats.archived"),
            value: loading ? "..." : archived,
          },
          {
            label: t("stats.installs"),
            value: loading ? "..." : totalInstalls,
          },
        ]}
        headerLeft={
          <div className="relative w-full max-w-xs">
            <ElevatedInput
              type="text"
              label={t("search.placeholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
            />
          </div>
        }
        pagination={{
          currentPage: filters.page,
          totalPages,
          pageSize: PAGE_SIZE,
          totalItems,
          onPageChange: (page) => setFilters((prev) => ({ ...prev, page })),
        }}
        renderRowActions={(row) => (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/resource-templates/admin/${row.id}`);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <PencilSimple className="h-3.5 w-3.5" weight="bold" />
            </button>
            {row.status === "draft" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePublish(row.id);
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-healthy hover:bg-healthy/10 transition-colors"
              >
                <ArrowUp className="h-3.5 w-3.5" weight="bold" />
                {t("form.publish")}
              </button>
            )}
            {row.status === "published" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchive(row.id);
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Archive className="h-3.5 w-3.5" weight="bold" />
                {t("form.archive")}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.id);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash className="h-3.5 w-3.5" weight="bold" />
              {t("form.delete")}
            </button>
          </>
        )}
        emptyState={
          error
            ? {
                icon: (
                  <Sparkle className="h-7 w-7 text-destructive" weight="fill" />
                ),
                title: t("error.title"),
                description: error,
              }
            : {
                icon: (
                  <Sparkle
                    className="h-7 w-7 text-muted-foreground/40"
                    weight="fill"
                  />
                ),
                title: t("empty.title"),
                description: t("empty.description"),
                action: (
                  <Button
                    variant="primary"
                    title={t("admin.create")}
                    icon={<Plus className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    link="/dashboard/resource-templates/admin/new"
                    newTab={false}
                  />
                ),
              }
        }
      />
    </motion.main>
  );
}
