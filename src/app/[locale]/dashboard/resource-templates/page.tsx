"use client";

import {
  ArrowRight,
  Check,
  CircleNotch,
  Funnel,
  MagnifyingGlass,
  Sparkle,
} from "@/components/icons";
import {
  CATEGORY_LABELS,
  RESOURCE_TYPE_LABELS,
} from "@/lib/resource-templates/types";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import type {
  ResourceTemplate,
  ResourceType,
  TemplateCategory,
  TemplateInstall,
} from "@/lib/resource-templates/types";
import {
  installTemplateAction,
  listCatalogTemplatesAction,
  listInstalledTemplatesAction,
} from "@/app/actions/resource-templates";
import { useCallback, useEffect, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 120, damping: 16 },
  },
};

export default function ResourceTemplatesCatalogPage() {
  const t = useTranslations("resourceTemplates");
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();

  const [searchInput, setSearchInput] = useState("");
  const [templates, setTemplates] = useState<ResourceTemplate[]>([]);
  const [installed, setInstalled] = useState<TemplateInstall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    page: number;
    search: string;
    resourceType: ResourceType | "";
    category: TemplateCategory | "";
  }>({ page: 1, search: "", resourceType: "", category: "" });
  const [totalPages, setTotalPages] = useState(1);
  const [installingId, setInstallingId] = useState<string | null>(null);

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
    if (workspaceLoading || !currentWorkspace?.id) return;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [catalogResult, installsResult] = await Promise.all([
          listCatalogTemplatesAction({
            page: filters.page,
            pageSize: PAGE_SIZE,
            search: filters.search || undefined,
            resourceType: filters.resourceType || undefined,
            category: filters.category || undefined,
          }),
          listInstalledTemplatesAction(),
        ]);

        if (cancelled) return;

        if (catalogResult.error) {
          setError(catalogResult.error);
          setTemplates([]);
          setTotalPages(1);
        } else {
          setTemplates(catalogResult.templates ?? []);
          setTotalPages(catalogResult.meta.totalPages);
        }

        if (!installsResult.error) {
          setInstalled(installsResult.installs ?? []);
        }
      } catch {
        if (cancelled) return;
        setError(t("error.default"));
        setTemplates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [
    currentWorkspace?.id,
    workspaceLoading,
    filters.page,
    filters.search,
    filters.resourceType,
    filters.category,
    t,
  ]);

  const installedTemplateIds = new Set(installed.map((i) => i.templateId));

  const handleInstall = useCallback(
    async (templateId: string) => {
      setInstallingId(templateId);
      try {
        const result = await installTemplateAction(templateId);
        if (result.error) {
          setError(result.error);
        } else if (result.install) {
          setInstalled((prev) => [...prev, result.install!]);
        }
      } catch {
        setError(t("catalog.installError"));
      } finally {
        setInstallingId(null);
      }
    },
    [t],
  );

  const featured = templates.filter((tpl) => tpl.isFeatured);
  const rest = templates.filter((tpl) => !tpl.isFeatured);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-6"
    >
      <DashboardPageHeader
        icon={<Sparkle className="h-6 w-6" weight="fill" />}
        badge={t("catalog.badge")}
        description={t("catalog.description")}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-card px-5 py-3 shadow-sm">
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

        <ElevatedSelect
          label={t("form.resourceType")}
          value={filters.resourceType || "__all__"}
          onValueChange={(v) =>
            setFilters((prev) => ({
              ...prev,
              page: 1,
              resourceType: v === "__all__" ? "" : (v as ResourceType),
            }))
          }
        >
          <ElevatedSelectItem value="__all__">
            <div className="flex items-center gap-2">
              <Funnel className="h-3.5 w-3.5" weight="bold" />
              {t("catalog.allTemplates")}
            </div>
          </ElevatedSelectItem>
          {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
            <ElevatedSelectItem key={value} value={value}>
              {label}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>

        <ElevatedSelect
          label={t("form.category")}
          value={filters.category || "__all__"}
          onValueChange={(v) =>
            setFilters((prev) => ({
              ...prev,
              page: 1,
              category: v === "__all__" ? "" : (v as TemplateCategory),
            }))
          }
        >
          <ElevatedSelectItem value="__all__">
            <div className="flex items-center gap-2">
              <Funnel className="h-3.5 w-3.5" weight="bold" />
              {t("catalog.allTemplates")}
            </div>
          </ElevatedSelectItem>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <ElevatedSelectItem key={value} value={value}>
              {label}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="animate-pulse rounded-[--radius] border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-[--radius] bg-border/60" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-border/60" />
                  <div className="h-3 w-1/3 rounded bg-border/60" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-border/60" />
                <div className="h-3 w-4/5 rounded bg-border/60" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-[--radius] border border-border bg-card px-6 py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-[--radius] bg-destructive/10 mb-3">
            <Sparkle className="h-7 w-7 text-destructive" weight="fill" />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">
            {t("error.title")}
          </p>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[--radius] border border-border bg-card px-6 py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-[--radius] bg-muted mb-3">
            <Sparkle
              className="h-7 w-7 text-muted-foreground/40"
              weight="fill"
            />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">
            {t("catalog.empty.title")}
          </p>
          <p className="text-sm text-muted-foreground max-w-md">
            {t("catalog.empty.description")}
          </p>
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-lamp-ink">
                <Sparkle className="h-4 w-4" weight="fill" />
                {t("catalog.featured")}
              </h2>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {featured.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    isInstalled={installedTemplateIds.has(tpl.id)}
                    isInstalling={installingId === tpl.id}
                    onInstall={handleInstall}
                    t={t}
                  />
                ))}
              </motion.div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="space-y-3">
              {featured.length > 0 && (
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("catalog.allTemplates")}
                </h2>
              )}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {rest.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    isInstalled={installedTemplateIds.has(tpl.id)}
                    isInstalling={installingId === tpl.id}
                    onInstall={handleInstall}
                    t={t}
                  />
                ))}
              </motion.div>
            </section>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4">
              {filters.page > 1 && (
                <Button
                  variant="ghost"
                  title="Previous"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                />
              )}
              <span className="text-sm text-muted-foreground">
                {filters.page} / {totalPages}
              </span>
              {filters.page < totalPages && (
                <Button
                  variant="ghost"
                  title="Next"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                />
              )}
            </div>
          )}
        </>
      )}
    </motion.main>
  );
}

function TemplateCard({
  template,
  isInstalled,
  isInstalling,
  onInstall,
  t,
}: {
  template: ResourceTemplate;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: (id: string) => void;
  t: (key: string) => string;
}) {
  return (
    <motion.div
      variants={cardVariants}
      className={cn(
        "group relative flex flex-col rounded-[--radius] border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30",
        template.isFeatured && "border-primary/20 ring-1 ring-primary/10",
      )}
    >
      {template.isFeatured && (
        <div className="absolute -top-2.5 right-4">
          <span className="inline-flex items-center gap-1 rounded-[--radius] bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            <Sparkle className="h-3 w-3" weight="fill" />
            {t("catalog.featured")}
          </span>
        </div>
      )}

      <div className="mb-3 flex items-start gap-3">
        {template.icon ? (
          <img
            src={template.icon}
            alt=""
            className="h-10 w-10 rounded-[--radius] object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-primary text-white shadow-sm">
            <Sparkle className="h-5 w-5" weight="fill" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {template.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center rounded-[--radius] bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {RESOURCE_TYPE_LABELS[template.resourceType] ??
                template.resourceType}
            </span>
            <span className="inline-flex items-center rounded-[--radius] bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {CATEGORY_LABELS[template.category] ?? template.category}
            </span>
          </div>
        </div>
      </div>

      <p className="mb-4 line-clamp-2 text-xs text-muted-foreground leading-relaxed flex-1">
        {template.description || "—"}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {template.installCount ?? 0} {t("stats.installs").toLowerCase()}
        </span>

        {isInstalled ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-healthy/10 px-3 py-1.5 text-xs font-medium text-healthy">
            <Check className="h-3.5 w-3.5" weight="bold" />
            {t("catalog.installed")}
          </span>
        ) : (
          <button
            type="button"
            disabled={isInstalling}
            onClick={() => onInstall(template.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {isInstalling ? (
              <>
                <CircleNotch
                  className="h-3.5 w-3.5 animate-spin"
                  weight="bold"
                />
                {t("catalog.installing")}
              </>
            ) : (
              <>
                <ArrowRight className="h-3.5 w-3.5" weight="bold" />
                {t("catalog.install")}
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}
