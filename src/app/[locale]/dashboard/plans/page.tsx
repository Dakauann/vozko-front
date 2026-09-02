"use client";

import * as React from "react";

import type { Affiliate, PaginationMeta } from "@/lib/affiliate/types";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowsClockwise,
  Buildings,
  CheckCircle,
  CircleNotch,
  Eye,
  EyeSlash,
  FloppyDisk,
  Package,
  PlusCircle,
  UserCircle,
  X,
} from "@/components/icons";
import type {
  PlanDefinition,
  PlanMutationInput,
} from "@/lib/workspace-plan/types";
import type { PricingItem } from "@/lib/pricing/types";
import {
  draftsToMutationInputs,
  isDraftCustomized,
  mergePlanPricingDrafts,
  resetDraftToDefault,
  sortDraftsByCatalog,
  type PricingItemDraft,
} from "@/lib/pricing/catalog";
import {
  formatUsdCurrency,
  isPercentageMetric,
  microsToUsdNumber,
  parseAmount,
  parseBrlToUsdMicros,
  resolveExchangeRate,
} from "@/lib/pricing/money";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import UserPlansCatalog from "@/components/dashboard/plans/UserPlansCatalog";
import type { Workspace } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import { fetchWorkspaces } from "@/lib/workspace/client";
import { formatPricingServiceFallback } from "@/lib/branding/ai-models";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import {
  adminGetAffiliateAction,
  adminListAffiliatesAction,
} from "@/app/actions/affiliate";
import {
  adminArchivePlanAction,
  adminCreatePlanAction,
  adminListPlansAction,
  adminSetPlanExclusiveAffiliateAction,
  adminSetPlanVisibilityAction,
  adminUpdatePlanAction,
} from "@/app/actions/workspace-plan";
import {
  getDefaultPricingItemsAction,
  getExchangeRateAction,
} from "@/app/actions/pricing";

type PlanDraft = {
  name: string;
  description: string;
  basePriceBRL: string;
  maxCallChannels: string;
  maxTtsConcurrency: string;
  includedWhatsAppBusinessPhones: string;
  maxBranches: string;
  pricingItems: PricingItemDraft[];
};

const CENTS = 100;

function centsToDisplay(cents: number) {
  return (cents / CENTS).toFixed(2);
}

function displayToCents(value: string) {
  const normalized = value.replace(/,/g, ".");
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * CENTS);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatBRLFromCents(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / CENTS);
}

function buildDraft(
  plan: PlanDefinition | null,
  defaults: PricingItem[],
  rate: number,
): PlanDraft {
  return {
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    basePriceBRL: centsToDisplay(plan?.basePriceBRLCents ?? 0),
    maxCallChannels: String(plan?.maxCallChannels ?? 3),
    maxTtsConcurrency: String(plan?.maxTtsConcurrency ?? 3),
    includedWhatsAppBusinessPhones: String(
      plan?.includedWhatsAppBusinessPhones ?? 0,
    ),
    maxBranches: String(plan?.maxBranches ?? 1),
    pricingItems: sortDraftsByCatalog(
      mergePlanPricingDrafts(plan?.pricingItems, defaults, rate),
    ),
  };
}

function toMutationInput(draft: PlanDraft, rate: number): PlanMutationInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    basePriceBRLCents: displayToCents(draft.basePriceBRL),
    // VoIP was removed from the product, so this is no longer configurable.
    // The key stays in the payload because the API still requires it.
    maxCallChannels: 1,
    maxTtsConcurrency: Number.parseInt(draft.maxTtsConcurrency, 10) || 0,
    includedWhatsAppBusinessPhones:
      Number.parseInt(draft.includedWhatsAppBusinessPhones, 10) || 0,
    // Ramais were a SIP concept; no longer configurable, key kept for the API.
    maxBranches: 1,
    pricingItems: draftsToMutationInputs(draft.pricingItems, rate),
  };
}


interface AdminPlansResponse {
  plans: PlanDefinition[];
  error?: string | null;
}

interface AdminPlanMutationResponse {
  plan: PlanDefinition | null;
  error?: string | null;
}

interface AdminPlanArchiveResponse {
  success: boolean;
  error?: string | null;
}

interface AdminAffiliatesResponse {
  items: Affiliate[];
  meta: PaginationMeta;
  error?: string;
}

async function fetchAdminAffiliate(
  id: string,
): Promise<{ affiliate: Affiliate | null; error?: string }> {
  const result = await adminGetAffiliateAction(id);
  return {
    affiliate: result.profile?.affiliate ?? null,
    error: result.error,
  };
}

async function fetchAdminAffiliates(
  page: number,
  pageSize: number,
): Promise<AdminAffiliatesResponse> {
  return adminListAffiliatesAction(page, pageSize);
}

async function fetchAdminPlans(
  includeArchived: boolean,
): Promise<AdminPlansResponse> {
  return adminListPlansAction(includeArchived);
}

async function createAdminPlanRequest(
  input: PlanMutationInput,
): Promise<AdminPlanMutationResponse> {
  return adminCreatePlanAction(input);
}

async function updateAdminPlanRequest(
  planId: string,
  input: PlanMutationInput,
): Promise<AdminPlanMutationResponse> {
  return adminUpdatePlanAction(planId, input);
}

async function archiveAdminPlanRequest(
  planId: string,
): Promise<AdminPlanArchiveResponse> {
  return adminArchivePlanAction(planId);
}

async function updatePlanVisibilityRequest(
  planId: string,
  input: {
    isGloballyVisible: boolean;
    allowedWorkspaceIds: string[];
  },
): Promise<AdminPlanMutationResponse> {
  return adminSetPlanVisibilityAction(planId, input);
}

async function updatePlanExclusiveAffiliateRequest(
  planId: string,
  affiliateId: string | null,
): Promise<AdminPlanMutationResponse> {
  return adminSetPlanExclusiveAffiliateAction(planId, { affiliateId });
}

export default function DashboardPlansPage() {
  return <UserPlansCatalog />;
}

export function AdminPlansManager() {
  const t = useTranslations("adminPlans");
  const { toast } = useToast();

  const [plans, setPlans] = React.useState<PlanDefinition[]>([]);
  const [pricingDefaults, setPricingDefaults] = React.useState<PricingItem[]>(
    [],
  );
  const [exchangeRate, setExchangeRate] = React.useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = React.useState<
    string | "new" | null
  >(null);
  const [draft, setDraft] = React.useState<PlanDraft | null>(null);
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savingVisibility, setSavingVisibility] = React.useState(false);
  const [visibilityGlobal, setVisibilityGlobal] = React.useState(true);
  const [allowedWorkspaces, setAllowedWorkspaces] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [savingExclusive, setSavingExclusive] = React.useState(false);
  const [exclusiveAffiliate, setExclusiveAffiliate] = React.useState<{
    id: string;
    code: string;
    brandName: string;
  } | null>(null);

  const hydrateDraft = React.useCallback(
    (
      nextSelection: string | "new" | null,
      nextPlans: PlanDefinition[],
      defaults: PricingItem[],
      rate: number | null,
    ) => {
      setSelectedPlanId(nextSelection);
      const resolved = resolveExchangeRate(rate);
      if (!nextSelection || resolved == null || defaults.length === 0) {
        setDraft(null);
        if (!nextSelection) {
          setVisibilityGlobal(true);
          setAllowedWorkspaces([]);
          setExclusiveAffiliate(null);
        }
        return;
      }
      if (nextSelection === "new") {
        setDraft(buildDraft(null, defaults, resolved));
        setVisibilityGlobal(true);
        setAllowedWorkspaces([]);
        setExclusiveAffiliate(null);
        return;
      }
      const selected =
        nextPlans.find((plan) => plan.id === nextSelection) ?? null;
      setDraft(buildDraft(selected, defaults, resolved));
      setVisibilityGlobal(selected?.isGloballyVisible ?? true);
      setAllowedWorkspaces(
        selected?.allowedWorkspaces?.map((w) => ({
          id: w.id,
          name: w.name,
        })) ?? [],
      );
      const exclusiveId = selected?.exclusiveAffiliateId ?? null;
      if (!exclusiveId) {
        setExclusiveAffiliate(null);
      } else {
        setExclusiveAffiliate((prev) =>
          prev?.id === exclusiveId
            ? prev
            : { id: exclusiveId, code: "", brandName: "" },
        );
        void fetchAdminAffiliate(exclusiveId).then(({ affiliate }) => {
          if (!affiliate) return;
          setExclusiveAffiliate({
            id: affiliate.id,
            code: affiliate.code,
            brandName: affiliate.brandName,
          });
        });
      }
    },
    [],
  );

  const loadData = React.useCallback(
    async (preferredSelection?: string | "new" | null) => {
      setLoading(true);
      setError(null);
      try {
        const [plansResult, defaultsResult, rateResult] = await Promise.all([
          fetchAdminPlans(includeArchived),
          getDefaultPricingItemsAction(),
          getExchangeRateAction(),
        ]);

        if (plansResult.error) {
          setError(plansResult.error);
          return;
        }
        if (defaultsResult.error) {
          setError(defaultsResult.error);
          return;
        }

        const nextPlans = plansResult.plans;
        const nextDefaults = defaultsResult.items ?? [];
        const rate =
          !rateResult.error && rateResult.item
            ? rateResult.item.priceMicros / 1_000_000
            : null;

        setPlans(nextPlans);
        setPricingDefaults(nextDefaults);
        setExchangeRate(rate);

        if (resolveExchangeRate(rate) == null) {
          setError(t("error.exchangeRateRequired"));
          return;
        }
        if (nextDefaults.length === 0) {
          setError(t("error.catalogEmpty"));
          return;
        }

        const effectiveSelection =
          preferredSelection !== undefined
            ? preferredSelection
            : selectedPlanId &&
                (selectedPlanId === "new" ||
                  nextPlans.some((plan) => plan.id === selectedPlanId))
              ? selectedPlanId
              : (nextPlans[0]?.id ?? "new");

        hydrateDraft(effectiveSelection, nextPlans, nextDefaults, rate);
      } catch {
        setError(t("error.default"));
      } finally {
        setLoading(false);
      }
    },
    [hydrateDraft, includeArchived, selectedPlanId, t],
  );

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPlans = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return plans;
    }
    return plans.filter((item) => {
      const haystack = `${item.name} ${item.description}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [plans, search]);

  const selectedPlan = React.useMemo(
    () => plans.find((item) => item.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const activePlans = plans.filter((item) => !item.archivedAt).length;
  const archivedPlans = plans.length - activePlans;

  const handleDraftChange = React.useCallback(
    (field: keyof PlanDraft, value: string) => {
      setDraft((current) =>
        current ? { ...current, [field]: value } : current,
      );
    },
    [],
  );

  const handleReset = React.useCallback(() => {
    hydrateDraft(
      selectedPlanId ?? "new",
      plans,
      pricingDefaults,
      exchangeRate,
    );
  }, [
    exchangeRate,
    hydrateDraft,
    plans,
    pricingDefaults,
    selectedPlanId,
  ]);

  const handleSave = React.useCallback(async () => {
    if (!draft) {
      return;
    }

    const rate = resolveExchangeRate(exchangeRate);
    if (rate == null) {
      toast({
        title: t("toast.validation.exchangeRate"),
        variant: "destructive",
      });
      return;
    }

    const payload = toMutationInput(draft, rate);
    if (!payload.name) {
      toast({ title: t("toast.validation.name"), variant: "destructive" });
      return;
    }
    if (!payload.pricingItems || payload.pricingItems.length === 0) {
      toast({
        title: t("toast.validation.pricingItems"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const result =
        selectedPlanId === "new" || !selectedPlanId
          ? await createAdminPlanRequest(payload)
          : await updateAdminPlanRequest(selectedPlanId, payload);

      if (result.error || !result.plan) {
        toast({
          title: t("toast.error.save"),
          description: result.error ?? undefined,
          variant: "destructive",
        });
        return;
      }

      toast({
        title:
          selectedPlanId === "new" || !selectedPlanId
            ? t("toast.success.created")
            : t("toast.success.updated"),
      });
      await loadData(result.plan.id);
    } catch {
      toast({ title: t("toast.error.save"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [draft, exchangeRate, loadData, selectedPlanId, t, toast]);

  const handleArchive = React.useCallback(async () => {
    if (!selectedPlan || selectedPlan.archivedAt) {
      return;
    }

    const confirmed = window.confirm(
      t("archive.confirm", { name: selectedPlan.name }),
    );
    if (!confirmed) {
      return;
    }

    setArchiving(true);
    try {
      const result = await archiveAdminPlanRequest(selectedPlan.id);
      if (result.error || !result.success) {
        toast({
          title: t("toast.error.archive"),
          description: result.error ?? undefined,
          variant: "destructive",
        });
        return;
      }

      toast({ title: t("toast.success.archived") });
      await loadData("new");
    } catch {
      toast({ title: t("toast.error.archive"), variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  }, [loadData, selectedPlan, t, toast]);

  const handleSaveVisibility = React.useCallback(async () => {
    if (!selectedPlan) return;

    setSavingVisibility(true);
    try {
      const ids = visibilityGlobal ? [] : allowedWorkspaces.map((w) => w.id);

      const result = await updatePlanVisibilityRequest(selectedPlan.id, {
        isGloballyVisible: visibilityGlobal,
        allowedWorkspaceIds: ids,
      });

      if (result.error) {
        toast({
          title: t("toast.error.visibility"),
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: t("toast.success.visibility") });
      await loadData(selectedPlan.id);
    } catch {
      toast({ title: t("toast.error.visibility"), variant: "destructive" });
    } finally {
      setSavingVisibility(false);
    }
  }, [allowedWorkspaces, loadData, selectedPlan, t, toast, visibilityGlobal]);

  const allowedIds = React.useMemo(
    () => new Set(allowedWorkspaces.map((w) => w.id)),
    [allowedWorkspaces],
  );

  const workspaceSelect = usePaginatedSelect<Workspace>({
    fetchFn: React.useCallback(async (page: number, search: string) => {
      const result = await fetchWorkspaces({
        page,
        pageSize: 20,
        search: search || undefined,
      });
      return { items: result.workspaces, totalPages: result.totalPages ?? 1 };
    }, []),
    mapOption: React.useCallback(
      (ws: Workspace) => {
        const alreadyGranted = allowedIds.has(ws.id);
        return {
          label: ws.name,
          value: ws.id,
          description: ws.ownerEmail
            ? `${ws.ownerEmail}${ws.isDefault ? " · default" : ""}`
            : undefined,
          icon: <Buildings className="h-4 w-4" weight="fill" />,
          disabled: alreadyGranted,
          meta: alreadyGranted ? (
            <CheckCircle className="h-4 w-4 text-healthy-ink" weight="fill" />
          ) : undefined,
        };
      },
      [allowedIds],
    ),
    enabled: !visibilityGlobal,
  });

  const handleGrantWorkspace = React.useCallback(
    (workspaceId: string) => {
      const ws = workspaceSelect.items.find((w) => w.id === workspaceId);
      if (!ws || allowedIds.has(workspaceId)) return;
      setAllowedWorkspaces((prev) => [...prev, { id: ws.id, name: ws.name }]);
    },
    [allowedIds, workspaceSelect.items],
  );

  const handleRevokeWorkspace = React.useCallback((workspaceId: string) => {
    setAllowedWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
  }, []);

  const affiliateSelect = usePaginatedSelect<Affiliate>({
    fetchFn: React.useCallback(async (page: number) => {
      const result = await fetchAdminAffiliates(page, 20);
      return {
        items: (result.items ?? []).filter((a) => a.active),
        totalPages: result.meta?.totalPages ?? 1,
      };
    }, []),
    mapOption: React.useCallback(
      (aff: Affiliate) => ({
        label: aff.brandName || aff.code,
        value: aff.id,
        description: `${aff.code}${
          aff.active ? "" : " · inactive"
        } · ${(aff.commissionPct * 100).toFixed(1)}%`,
        icon: <UserCircle className="h-4 w-4" weight="fill" />,
        disabled: !aff.active,
      }),
      [],
    ),
  });

  const handleSelectExclusiveAffiliate = React.useCallback(
    (affiliateId: string) => {
      const aff = affiliateSelect.items.find((a) => a.id === affiliateId);
      if (!aff) return;
      setExclusiveAffiliate({
        id: aff.id,
        code: aff.code,
        brandName: aff.brandName,
      });
    },
    [affiliateSelect.items],
  );

  const handleClearExclusiveAffiliate = React.useCallback(() => {
    setExclusiveAffiliate(null);
  }, []);

  const handleSaveExclusiveAffiliate = React.useCallback(async () => {
    if (!selectedPlan) return;
    setSavingExclusive(true);
    try {
      const result = await updatePlanExclusiveAffiliateRequest(
        selectedPlan.id,
        exclusiveAffiliate?.id ?? null,
      );
      if (result.error || !result.plan) {
        toast({
          title: t("exclusive.error.save"),
          description: result.error ?? undefined,
          variant: "destructive",
        });
        return;
      }
      toast({ title: t("exclusive.success") });
      await loadData(selectedPlan.id);
    } catch {
      toast({ title: t("exclusive.error.save"), variant: "destructive" });
    } finally {
      setSavingExclusive(false);
    }
  }, [exclusiveAffiliate, loadData, selectedPlan, t, toast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <CircleNotch
          className="h-8 w-8 animate-spin text-primary-ink"
          weight="bold"
        />
        <p className="mt-3 text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mx-auto mt-8 max-w-2xl rounded-[--radius] border border-border bg-card p-12 text-center"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <Package
          className="mx-auto mb-4 h-12 w-12 text-destructive-ink"
          weight="fill"
        />
        <p className="font-semibold text-foreground">{t("error.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button
          className="mt-4"
          onClick={() => loadData()}
          title={t("button.retry")}
          variant="outline"
        />
      </div>
    );
  }

  return (
    <main className="w-full space-y-4">
      <div>
        <DashboardPageHeader
          actions={
            <>
              <Button
                icon={<ArrowsClockwise className="h-4 w-4" weight="bold" />}
                iconVisible
                onClick={() => loadData(selectedPlanId ?? undefined)}
                title={t("button.refresh")}
                variant="outline"
              />
              <Button
                icon={<PlusCircle className="h-4 w-4" weight="fill" />}
                iconVisible
                onClick={() =>
                  hydrateDraft("new", plans, pricingDefaults, exchangeRate)
                }
                title={t("button.newPlan")}
              />
            </>
          }
          badge={t("header.badge")}
          description={t("header.description")}
          icon={<Package className="h-6 w-6" weight="fill" />}
        />
      </div>

      {/*
        CONSOLE BAR.

        Three stat cards for three integers, above a card holding two filters,
        was four boxes of chrome carrying one line of information. The counts
        are readouts, the filters are controls, and both belong on the same
        strip — which is also the only place the operator looks before picking a
        plan out of the register.
      */}
      <section className="well">
        <div className="flex flex-col gap-x-8 gap-y-4 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <dl className="flex flex-wrap items-end gap-x-8 gap-y-3">
            {[
              { key: "total", label: t("stats.total"), value: plans.length },
              { key: "active", label: t("stats.active"), value: activePlans },
              {
                key: "archived",
                label: t("stats.archived"),
                value: archivedPlans,
              },
            ].map((stat) => (
              <div key={stat.key}>
                <dt className="legend">{stat.label}</dt>
                <dd className="readout mt-1.5 text-2xl font-semibold leading-none tracking-[-0.02em] text-foreground">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label={t("filters.search")}
              className="h-8 w-full rounded-[--radius] border border-border bg-background px-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50 sm:w-60"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("filters.search")}
              type="search"
              value={search}
            />
            <button
              aria-pressed={includeArchived}
              className={cn(
                "rounded-[--radius] legend inline-flex h-8 items-center gap-2 border border-border px-2.5 transition-colors",
                includeArchived
                  ? "bg-muted text-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setIncludeArchived((current) => !current)}
              title={t("filters.includeArchivedDescription")}
              type="button"
            >
              <span
                aria-hidden
                className={cn("lamp", !includeArchived && "opacity-20")}
              />
              {t("filters.includeArchived")}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[288px_minmax(0,1fr)]">
        {/*
          THE REGISTER.

          Not a stack of cards: a list of rows on one surface, each carrying the
          three facts that identify a plan — what it is called, what it costs,
          whether it still sells. Scanning twenty of those is a column of prices,
          not twenty bordered boxes.
        */}
        <section className="well h-fit overflow-hidden">
          <header className="rule-engraved flex items-center justify-between gap-3 px-4 py-2.5">
            <p className="legend">{t("register")}</p>
            <span className="readout text-2xs text-muted-foreground">
              {filteredPlans.length}
            </span>
          </header>

          {filteredPlans.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-semibold text-foreground">
                {t("empty.title")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("empty.description")}
              </p>
            </div>
          ) : (
            <ul>
              {filteredPlans.map((item, index) => {
                const isSelected = item.id === selectedPlanId;
                const isArchived = item.archivedAt != null;

                return (
                  <li key={item.id}>
                    <button
                      aria-current={isSelected ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left transition-colors first:border-t-0",
                        // The row already carries a lamp — that is the mark.
                        isSelected
                          ? "bg-muted text-foreground"
                          : "hover:bg-muted/50",
                      )}
                      onClick={() =>
                        hydrateDraft(
                          item.id,
                          plans,
                          pricingDefaults,
                          exchangeRate,
                        )
                      }
                      type="button"
                    >
                      <span
                        aria-hidden
                        className={cn("lamp", !isSelected && "opacity-0")}
                      />
                      <span className="readout w-5 shrink-0 text-2xs text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {item.name}
                          </span>
                          <span className="readout shrink-0 text-sm font-semibold text-foreground">
                            {formatBRLFromCents(item.basePriceBRLCents)}
                          </span>
                        </span>
                        <span className="mt-1 flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "legend",
                              isArchived
                                ? "text-muted-foreground"
                                : "text-primary-ink",
                            )}
                          >
                            {isArchived
                              ? t("status.archived")
                              : t("status.active")}
                          </span>
                          <span className="readout truncate text-2xs text-muted-foreground">
                            {formatDate(item.updatedAt)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/*
          THE EDITOR.

          One panel, divided by engraved rules and legended section by section,
          instead of a stack of bordered sub-cards. The action bar sticks to the
          top of the pane so save stays reachable from the pricing table at the
          bottom, which is where the long edits happen.
        */}
        <section className="well overflow-hidden">
          {!draft ? null : (
            <>
              <header className="rule-engraved sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-card px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <p className="legend">
                    {selectedPlanId === "new"
                      ? t("editor.newBadge")
                      : t("editor.editBadge")}
                  </p>
                  <span aria-hidden className="h-3 w-px bg-border" />
                  <p className="truncate text-sm font-semibold text-foreground">
                    {selectedPlanId === "new"
                      ? t("editor.newTitle")
                      : (selectedPlan?.name ?? t("editor.editTitle"))}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    icon={<ArrowsClockwise className="h-4 w-4" weight="bold" />}
                    iconVisible
                    onClick={handleReset}
                    title={t("button.reset")}
                    variant="outline"
                  />
                  {selectedPlan && !selectedPlan.archivedAt ? (
                    <Button
                      disabled={archiving}
                      icon={
                        archiving ? (
                          <CircleNotch
                            className="h-4 w-4 animate-spin"
                            weight="bold"
                          />
                        ) : (
                          <Archive className="h-4 w-4" weight="fill" />
                        )
                      }
                      iconVisible
                      onClick={handleArchive}
                      title={t("button.archive")}
                      variant="outline"
                    />
                  ) : null}
                  <Button
                    disabled={saving || selectedPlan?.archivedAt != null}
                    icon={
                      saving ? (
                        <CircleNotch
                          className="h-4 w-4 animate-spin"
                          weight="bold"
                        />
                      ) : (
                        <FloppyDisk className="h-4 w-4" weight="fill" />
                      )
                    }
                    iconVisible
                    onClick={handleSave}
                    title={
                      selectedPlanId === "new"
                        ? t("button.create")
                        : t("button.save")
                    }
                  />
                </div>
              </header>

              <div className="space-y-7 px-4 py-5">
                {selectedPlan?.archivedAt ? (
                  <div className="border-l-2 border-warning bg-muted px-3 py-2.5">
                    <p className="text-sm font-semibold text-foreground">
                      {t("editor.archivedTitle")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("editor.archivedDescription", {
                        archivedAt: formatDate(selectedPlan.archivedAt),
                      })}
                    </p>
                  </div>
                ) : null}

                <PanelSection
                  description={t("sections.identityDescription")}
                  title={t("sections.identity")}
                >
                  <div className="space-y-4">
                    <ElevatedInput
                      disabled={selectedPlan?.archivedAt != null}
                      label={t("form.name")}
                      onChange={(event) =>
                        handleDraftChange("name", event.target.value)
                      }
                      placeholder={t("form.namePlaceholder")}
                      value={draft.name}
                    />
                    <div>
                      <label
                        className="legend mb-1.5 block"
                        htmlFor="plan-description"
                      >
                        {t("form.description")}
                      </label>
                      <textarea
                        className="min-h-[104px] w-full rounded-[--radius] border border-border bg-background px-3 py-2.5 text-sm leading-snug text-foreground outline-none transition focus:border-primary/50"
                        disabled={selectedPlan?.archivedAt != null}
                        id="plan-description"
                        onChange={(event) =>
                          handleDraftChange("description", event.target.value)
                        }
                        placeholder={t("form.descriptionPlaceholder")}
                        value={draft.description}
                      />
                    </div>
                  </div>
                </PanelSection>

                <PanelSection
                  description={t("sections.capacityDescription")}
                  title={t("sections.capacity")}
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <ElevatedInput
                      disabled={selectedPlan?.archivedAt != null}
                      label={t("form.basePrice")}
                      min="0"
                      onChange={(event) =>
                        handleDraftChange("basePriceBRL", event.target.value)
                      }
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={draft.basePriceBRL}
                    />
                    <ElevatedInput
                      disabled={selectedPlan?.archivedAt != null}
                      label={t("form.includedWhatsAppBusinessPhones")}
                      min="0"
                      onChange={(event) =>
                        handleDraftChange(
                          "includedWhatsAppBusinessPhones",
                          event.target.value,
                        )
                      }
                      type="number"
                      value={draft.includedWhatsAppBusinessPhones}
                    />
                    <ElevatedInput
                      disabled={selectedPlan?.archivedAt != null}
                      label={t("form.maxTtsConcurrency")}
                      min="1"
                      onChange={(event) =>
                        handleDraftChange(
                          "maxTtsConcurrency",
                          event.target.value,
                        )
                      }
                      type="number"
                      value={draft.maxTtsConcurrency}
                    />
                  </div>

                  <p className="mt-4 border-l-2 border-border pl-3 text-xs leading-snug text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {t("form.catalogModeTitle")}
                    </span>{" "}
                    {t("form.catalogModeDescription")}
                  </p>
                </PanelSection>

                {selectedPlan && !selectedPlan.archivedAt ? (
                  <PanelSection
                    actions={
                      <button
                        aria-pressed={visibilityGlobal}
                        className={cn(
                          "rounded-[--radius] legend inline-flex h-7 items-center gap-1.5 border border-border px-2 transition-colors",
                          visibilityGlobal
                            ? "bg-muted text-foreground"
                            : "bg-background text-muted-foreground",
                        )}
                        onClick={() => setVisibilityGlobal((v) => !v)}
                        type="button"
                      >
                        {visibilityGlobal ? (
                          <Eye className="h-3.5 w-3.5" weight="bold" />
                        ) : (
                          <EyeSlash className="h-3.5 w-3.5" weight="bold" />
                        )}
                        {visibilityGlobal
                          ? t("visibility.global")
                          : t("visibility.restricted")}
                      </button>
                    }
                    description={t("visibility.description")}
                    title={t("visibility.title")}
                  >
                    {visibilityGlobal ? (
                      <p className="text-sm text-muted-foreground">
                        {t("visibility.globalHint")}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <ElevatedCommandSelect
                          disabled={savingVisibility}
                          emptyMessage={t("visibility.noWorkspaces")}
                          fullWidth
                          isLoading={workspaceSelect.isLoading}
                          label={t("visibility.searchWorkspaces")}
                          onOpenChange={workspaceSelect.onOpenChange}
                          onScrollEnd={workspaceSelect.onScrollEnd}
                          onSearch={workspaceSelect.onSearch}
                          onValueChange={(val) => handleGrantWorkspace(val)}
                          options={workspaceSelect.options}
                          searchPlaceholder={t("visibility.searchWorkspaces")}
                          value={null}
                        />

                        {allowedWorkspaces.length > 0 ? (
                          <div>
                            <p className="legend">
                              {t("visibility.grantedWorkspaces", {
                                count: allowedWorkspaces.length,
                              })}
                            </p>
                            <ul className="mt-1.5">
                              {allowedWorkspaces.map((ws) => (
                                <li
                                  key={ws.id}
                                  className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-b-0"
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    <Buildings
                                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                      weight="fill"
                                    />
                                    <span className="truncate text-sm font-medium text-foreground">
                                      {ws.name}
                                    </span>
                                    <span className="readout truncate text-2xs text-muted-foreground">
                                      {ws.id}
                                    </span>
                                  </span>
                                  <button
                                    className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-destructive-ink"
                                    onClick={() => handleRevokeWorkspace(ws.id)}
                                    type="button"
                                  >
                                    <X className="h-3.5 w-3.5" weight="bold" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div className="mt-4 flex justify-end">
                      <Button
                        disabled={savingVisibility}
                        icon={
                          savingVisibility ? (
                            <CircleNotch
                              className="h-4 w-4 animate-spin"
                              weight="bold"
                            />
                          ) : (
                            <FloppyDisk className="h-4 w-4" weight="fill" />
                          )
                        }
                        iconVisible
                        onClick={handleSaveVisibility}
                        title={t("visibility.save")}
                        variant="outline"
                      />
                    </div>
                  </PanelSection>
                ) : null}

                {selectedPlan && !selectedPlan.archivedAt ? (
                  <PanelSection
                    actions={
                      <span
                        className={cn(
                          "rounded-[--radius] legend inline-flex items-center gap-1.5 border border-border px-2 py-1",
                          exclusiveAffiliate
                            ? "bg-muted text-foreground"
                            : "bg-background text-muted-foreground",
                        )}
                      >
                        {exclusiveAffiliate ? (
                          <UserCircle className="h-3.5 w-3.5" weight="fill" />
                        ) : (
                          <EyeSlash className="h-3.5 w-3.5" weight="bold" />
                        )}
                        {exclusiveAffiliate
                          ? t("exclusive.badge")
                          : t("exclusive.none")}
                      </span>
                    }
                    description={t("exclusive.description")}
                    title={t("exclusive.title")}
                  >
                    {!visibilityGlobal && !exclusiveAffiliate ? (
                      <p
                        className="mb-3 border-l-2 border-warning bg-muted px-3 py-2 text-xs text-foreground"
                        role="note"
                      >
                        {t("exclusive.conflictWithRestricted")}
                      </p>
                    ) : null}

                    {exclusiveAffiliate ? (
                      <div className="flex items-center justify-between gap-2 border-b border-border py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <UserCircle
                            className="h-3.5 w-3.5 shrink-0 text-warning-ink"
                            weight="fill"
                          />
                          <span className="truncate text-sm font-medium text-foreground">
                            {exclusiveAffiliate.brandName ||
                              t("exclusive.resolving")}
                          </span>
                          {exclusiveAffiliate.code ? (
                            <span className="readout truncate text-2xs text-muted-foreground">
                              {exclusiveAffiliate.code}
                            </span>
                          ) : null}
                        </span>
                        <button
                          aria-label={t("exclusive.clear")}
                          className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-destructive-ink"
                          onClick={handleClearExclusiveAffiliate}
                          type="button"
                        >
                          <X className="h-3.5 w-3.5" weight="bold" />
                        </button>
                      </div>
                    ) : (
                      <ElevatedCommandSelect
                        disabled={savingExclusive}
                        emptyMessage={t("exclusive.empty")}
                        fullWidth
                        isLoading={affiliateSelect.isLoading}
                        label={t("exclusive.searchLabel")}
                        onOpenChange={affiliateSelect.onOpenChange}
                        onScrollEnd={affiliateSelect.onScrollEnd}
                        onSearch={affiliateSelect.onSearch}
                        onValueChange={(val) =>
                          handleSelectExclusiveAffiliate(val)
                        }
                        options={affiliateSelect.options}
                        searchPlaceholder={t("exclusive.searchPlaceholder")}
                        value={null}
                      />
                    )}

                    <div className="mt-4 flex justify-end">
                      <Button
                        disabled={
                          savingExclusive ||
                          (exclusiveAffiliate?.id ?? null) ===
                            (selectedPlan.exclusiveAffiliateId ?? null)
                        }
                        icon={
                          savingExclusive ? (
                            <CircleNotch
                              className="h-4 w-4 animate-spin"
                              weight="bold"
                            />
                          ) : (
                            <FloppyDisk className="h-4 w-4" weight="fill" />
                          )
                        }
                        iconVisible
                        onClick={handleSaveExclusiveAffiliate}
                        title={t("exclusive.save")}
                        variant="outline"
                      />
                    </div>
                  </PanelSection>
                ) : null}

                <PricingItemsEditor
                  disabled={selectedPlan?.archivedAt != null}
                  exchangeRate={exchangeRate}
                  items={draft.pricingItems}
                  onChange={(items) =>
                    setDraft((current) =>
                      current ? { ...current, pricingItems: items } : current,
                    )
                  }
                />
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}


function serviceLabel(
  t: { has: (key: string) => boolean; (key: string): string },
  service: string,
) {
  const key = `pricing.services.${service}`;
  return t.has(key) ? t(key) : formatPricingServiceFallback(service);
}

function metricLabel(
  t: { has: (key: string) => boolean; (key: string): string },
  metric: string,
) {
  const key = `pricing.metrics.${metric}`;
  return t.has(key) ? t(key) : metric;
}

function PricingItemsEditor({
  items,
  onChange,
  disabled,
  exchangeRate,
}: {
  items: PricingItemDraft[];
  onChange: (items: PricingItemDraft[]) => void;
  disabled?: boolean | null;
  exchangeRate: number | null;
}) {
  const t = useTranslations("adminPlans");
  const rate = resolveExchangeRate(exchangeRate);

  const handleItemChange = (
    index: number,
    field: keyof PricingItemDraft,
    value: string,
  ) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const handleResetRow = (index: number) => {
    if (rate == null) return;
    const next = [...items];
    next[index] = resetDraftToDefault(next[index], rate);
    onChange(next);
  };

  const grouped = React.useMemo(() => {
    const map = new Map<string, { item: PricingItemDraft; index: number }[]>();
    items.forEach((item, index) => {
      const arr = map.get(item.category) ?? [];
      arr.push({ item, index });
      map.set(item.category, arr);
    });
    return map;
  }, [items]);

  if (rate == null) {
    return (
      <PanelSection title={t("pricingItems.title")}>
        <p className="text-sm text-muted-foreground">
          {t("pricingItems.rateRequired")}
        </p>
      </PanelSection>
    );
  }

  return (
    <PanelSection
      actions={
        <span className="text-right">
          <span className="legend block">
            {t("pricingItems.rateBannerLabel")}
          </span>
          <span className="readout mt-1 block text-sm font-semibold text-foreground">
            {t("pricingItems.rateBannerValue", {
              rate: rate.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""),
            })}
          </span>
        </span>
      }
      description={t("pricingItems.description")}
     
      title={t("pricingItems.title")}
    >
      <p className="text-xs text-muted-foreground">
        {t("pricingItems.conversionNote")}
      </p>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("pricingItems.empty")}
        </p>
      ) : (
        <div className="-mx-1 mt-4 overflow-x-auto px-1">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="rule-engraved">
                <th className="legend py-2 pr-3 font-semibold" scope="col">
                  {t("pricingItems.service")}
                </th>
                <th className="legend px-3 py-2 font-semibold" scope="col">
                  {t("pricingItems.metric")}
                </th>
                <th className="legend px-3 py-2 font-semibold" scope="col">
                  {t("pricingItems.costBrl")}
                </th>
                <th className="legend px-3 py-2 font-semibold" scope="col">
                  {t("pricingItems.priceBrl")}
                </th>
                <th className="legend px-3 py-2 font-semibold" scope="col">
                  {t("pricingItems.markupPct")}
                </th>
                <th
                  className="legend py-2 pl-3 text-right font-semibold"
                  scope="col"
                >
                  {t("pricingItems.actions")}
                </th>
              </tr>
            </thead>

            {Array.from(grouped.entries()).map(([category, rows]) => {
              const categoryKey = `pricing.categories.${category}` as const;
              const categoryTitle = t.has(categoryKey)
                ? t(categoryKey)
                : category;

              return (
                <tbody key={category}>
                  <tr>
                    <th className="pb-1.5 pt-5" colSpan={6} scope="colgroup">
                      <span className="flex items-center gap-2">
                        <span className="legend text-foreground">
                          {categoryTitle}
                        </span>
                        <span className="readout text-2xs text-muted-foreground">
                          {rows.length}
                        </span>
                        <span
                          aria-hidden
                          className="h-px min-w-4 flex-1 bg-border"
                        />
                      </span>
                    </th>
                  </tr>

                  {rows.map(({ item, index }) => {
                    const percentage = isPercentageMetric(item.metric);
                    const customized = isDraftCustomized(item, rate);
                    const costUsd = percentage
                      ? null
                      : microsToUsdNumber(
                          parseBrlToUsdMicros(item.costBrl, rate),
                        );
                    const priceUsd = percentage
                      ? null
                      : microsToUsdNumber(
                          parseBrlToUsdMicros(item.priceBrl, rate),
                        );
                    const priceBelowCost =
                      !percentage &&
                      costUsd != null &&
                      priceUsd != null &&
                      priceUsd > 0 &&
                      costUsd > 0 &&
                      priceUsd < costUsd;
                    const invalidBrl =
                      !percentage &&
                      (parseAmount(item.costBrl) === null ||
                        parseAmount(item.priceBrl) === null);

                    return (
                      <tr
                        key={`${item.category}-${item.service}-${item.metric}`}
                        className="border-b border-border last:border-b-0"
                      >
                        <th
                          className="py-2 pr-3 align-top text-sm font-medium text-foreground"
                          scope="row"
                        >
                          <span className="flex flex-wrap items-center gap-1.5">
                            {serviceLabel(t, item.service)}
                            {customized ? (
                              <span className="rounded-lg legend border border-border bg-muted px-1.5 py-0.5 text-primary-ink">
                                {t("pricingItems.customized")}
                              </span>
                            ) : null}
                          </span>
                          {priceBelowCost ? (
                            <span className="mt-1 block text-2xs font-normal text-warning-ink">
                              {t("pricingItems.priceBelowCost")}
                            </span>
                          ) : null}
                          {invalidBrl ? (
                            <span className="mt-1 block text-2xs font-normal text-destructive-ink">
                              {t("pricingItems.invalidAmount")}
                            </span>
                          ) : null}
                        </th>
                        <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                          {metricLabel(t, item.metric)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {percentage ? (
                            <span className="text-xs text-muted-foreground">
                              {t("pricingItems.notApplicable")}
                            </span>
                          ) : (
                            <>
                              <input
                                aria-label={t("pricingItems.costBrl")}
                                className="readout w-28 rounded-[--radius] border border-border bg-background px-2 py-1 text-xs outline-none transition focus:border-primary/50"
                                disabled={!!disabled}
                                inputMode="decimal"
                                min="0"
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "costBrl",
                                    e.target.value,
                                  )
                                }
                                placeholder="0,00"
                                step="any"
                                type="text"
                                value={item.costBrl}
                              />
                              <span className="readout mt-1 block text-2xs text-muted-foreground">
                                ≈ {formatUsdCurrency(costUsd ?? 0)}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {percentage ? (
                            <span className="text-xs text-muted-foreground">
                              {t("pricingItems.notApplicable")}
                            </span>
                          ) : (
                            <>
                              <input
                                aria-label={t("pricingItems.priceBrl")}
                                className="readout w-28 rounded-[--radius] border border-border bg-background px-2 py-1 text-xs outline-none transition focus:border-primary/50"
                                disabled={!!disabled}
                                inputMode="decimal"
                                min="0"
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "priceBrl",
                                    e.target.value,
                                  )
                                }
                                placeholder="0,00"
                                step="any"
                                type="text"
                                value={item.priceBrl}
                              />
                              <span className="readout mt-1 block text-2xs text-muted-foreground">
                                ≈ {formatUsdCurrency(priceUsd ?? 0)}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            aria-label={t("pricingItems.markupPct")}
                            className="readout w-20 rounded-[--radius] border border-border bg-background px-2 py-1 text-xs outline-none transition focus:border-primary/50"
                            disabled={!!disabled}
                            min="0"
                            onChange={(e) =>
                              handleItemChange(index, "markupPct", e.target.value)
                            }
                            step="0.01"
                            type="number"
                            value={item.markupPct}
                          />
                        </td>
                        <td className="py-2 pl-3 align-top text-right">
                          <button
                            className={cn(
                              "legend inline-flex items-center gap-1 py-1 transition-colors",
                              customized && !disabled
                                ? "text-primary-ink hover:text-foreground"
                                : "cursor-default text-muted-foreground",
                            )}
                            disabled={!!disabled || !customized}
                            onClick={() => handleResetRow(index)}
                            type="button"
                          >
                            <ArrowCounterClockwise
                              className="h-3.5 w-3.5"
                              weight="bold"
                            />
                            {t("pricingItems.resetRow")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </PanelSection>
  );
}
