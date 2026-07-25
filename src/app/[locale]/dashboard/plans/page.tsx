"use client";

import * as React from "react";

import type { Affiliate, PaginationMeta } from "@/lib/affiliate/types";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowsClockwise,
  Buildings,
  ChatCircle,
  CheckCircle,
  CircleNotch,
  Eye,
  EyeSlash,
  FloppyDisk,
  Microphone,
  Package,
  Phone,
  PlusCircle,
  Scales,
  Sparkle,
  SpeakerHigh,
  UserCircle,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
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
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import UserPlansCatalog from "@/components/dashboard/plans/UserPlansCatalog";
import type { Workspace } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import { fetchWorkspaces } from "@/lib/workspace/client";
import { formatPricingServiceFallback } from "@/lib/branding/ai-models";
import { motion } from "framer-motion";
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
  maxHoldMusicTracks: string;
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
    maxHoldMusicTracks: String(plan?.maxHoldMusicTracks ?? 3),
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
    maxCallChannels: Number.parseInt(draft.maxCallChannels, 10) || 0,
    maxTtsConcurrency: Number.parseInt(draft.maxTtsConcurrency, 10) || 0,
    includedWhatsAppBusinessPhones:
      Number.parseInt(draft.includedWhatsAppBusinessPhones, 10) || 0,
    maxBranches: Number.parseInt(draft.maxBranches, 10) || 0,
    maxHoldMusicTracks: Number.parseInt(draft.maxHoldMusicTracks, 10) || 0,
    pricingItems: draftsToMutationInputs(draft.pricingItems, rate),
  };
}

function statusClasses(archivedAt?: string | null) {
  return archivedAt ? "bg-slate-500 text-white" : "bg-emerald-500 text-white";
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
    if (payload.maxCallChannels <= 0) {
      toast({ title: t("toast.validation.channels"), variant: "destructive" });
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
            <CheckCircle className="h-4 w-4 text-emerald-500" weight="fill" />
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
          className="h-8 w-8 animate-spin text-primary"
          weight="bold"
        />
        <p className="mt-3 text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mx-auto mt-8 max-w-2xl rounded-[26px] border border-border/70 bg-card/90 p-12 text-center"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <Package
          className="mx-auto mb-4 h-12 w-12 text-red-400"
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
    <motion.main
      animate={{ opacity: 1 }}
      className="w-full space-y-4"
      initial={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        animate={{ opacity: 1 }}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
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
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: t("stats.total"),
            value: String(plans.length),
            icon: <Package className="h-4 w-4 text-white" weight="fill" />,
            bg: "bg-slate-700",
          },
          {
            label: t("stats.active"),
            value: String(activePlans),
            icon: <Sparkle className="h-4 w-4 text-white" weight="fill" />,
            bg: "bg-emerald-500",
          },
          {
            label: t("stats.archived"),
            value: String(archivedPlans),
            icon: <Archive className="h-4 w-4 text-white" weight="fill" />,
            bg: "bg-amber-500",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border/70 bg-card/90 p-5"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {stat.value}
                </p>
              </div>
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl",
                  stat.bg,
                )}
              >
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section
          className="space-y-4 rounded-[26px] border border-border/70 bg-card/90 p-5"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="space-y-3">
            <ElevatedInput
              label={t("filters.search")}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("filters.searchPlaceholder")}
              value={search}
            />

            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("filters.includeArchived")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("filters.includeArchivedDescription")}
                </p>
              </div>
              <button
                className={cn(
                  "inline-flex rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  includeArchived
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
                onClick={() => setIncludeArchived((current) => !current)}
                type="button"
              >
                {includeArchived ? t("filters.on") : t("filters.off")}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredPlans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-4 py-10 text-center">
                <Package
                  className="mx-auto h-8 w-8 text-muted-foreground"
                  weight="fill"
                />
                <p className="mt-3 text-sm font-medium text-foreground">
                  {t("empty.title")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("empty.description")}
                </p>
              </div>
            ) : (
              filteredPlans.map((item) => {
                const isSelected = item.id === selectedPlanId;
                return (
                  <button
                    key={item.id}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-4 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                        : "border-border/70 bg-background/70 hover:border-primary/30 hover:bg-background",
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.name}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {item.description || t("card.noDescription")}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase",
                          statusClasses(item.archivedAt),
                        )}
                      >
                        {item.archivedAt
                          ? t("status.archived")
                          : t("status.active")}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">
                          {t("card.basePrice")}
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {formatBRLFromCents(item.basePriceBRLCents)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {t("card.channels")}
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {item.maxCallChannels}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {t("card.branches")}
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {item.maxBranches ?? 1}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {t("card.holdMusic")}
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {item.maxHoldMusicTracks ?? 3}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {t("card.updatedAt")}
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {formatDate(item.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section
          className="space-y-4 rounded-[26px] border border-border/70 bg-card/90 p-5"
          style={{ boxShadow: softSurfaceShadow }}
        >
          {!draft ? null : (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-primary">
                    {selectedPlanId === "new"
                      ? t("editor.newBadge")
                      : t("editor.editBadge")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">
                    {selectedPlanId === "new"
                      ? t("editor.newTitle")
                      : (selectedPlan?.name ?? t("editor.editTitle"))}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                    {t("editor.description")}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
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
              </div>

              {selectedPlan?.archivedAt ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                  <p className="font-medium">{t("editor.archivedTitle")}</p>
                  <p className="mt-1 text-xs text-amber-800">
                    {t("editor.archivedDescription", {
                      archivedAt: formatDate(selectedPlan.archivedAt),
                    })}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <ElevatedInput
                  disabled={selectedPlan?.archivedAt != null}
                  label={t("form.name")}
                  onChange={(event) =>
                    handleDraftChange("name", event.target.value)
                  }
                  placeholder={t("form.namePlaceholder")}
                  value={draft.name}
                />
                <ElevatedInput
                  disabled={selectedPlan?.archivedAt != null}
                  label={t("form.maxCallChannels")}
                  min="1"
                  onChange={(event) =>
                    handleDraftChange("maxCallChannels", event.target.value)
                  }
                  type="number"
                  value={draft.maxCallChannels}
                />
                <ElevatedInput
                  disabled={selectedPlan?.archivedAt != null}
                  label={t("form.maxTtsConcurrency")}
                  min="1"
                  onChange={(event) =>
                    handleDraftChange("maxTtsConcurrency", event.target.value)
                  }
                  type="number"
                  value={draft.maxTtsConcurrency}
                />
                <ElevatedInput
                  disabled={selectedPlan?.archivedAt != null}
                  label="Números WhatsApp inclusos"
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
                  label={t("form.maxBranches")}
                  min="0"
                  onChange={(event) =>
                    handleDraftChange("maxBranches", event.target.value)
                  }
                  type="number"
                  value={draft.maxBranches}
                />
                <ElevatedInput
                  disabled={selectedPlan?.archivedAt != null}
                  label={t("form.maxHoldMusicTracks")}
                  min="0"
                  max="10"
                  onChange={(event) =>
                    handleDraftChange("maxHoldMusicTracks", event.target.value)
                  }
                  type="number"
                  value={draft.maxHoldMusicTracks}
                />
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
                <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {t("form.catalogMode")}
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {t("form.catalogModeTitle")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("form.catalogModeDescription")}
                  </p>
                </div>
                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("form.description")}
                  </label>
                  <textarea
                    className="min-h-[120px] w-full rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    disabled={selectedPlan?.archivedAt != null}
                    onChange={(event) =>
                      handleDraftChange("description", event.target.value)
                    }
                    placeholder={t("form.descriptionPlaceholder")}
                    value={draft.description}
                  />
                </div>
              </div>

              {/* Plan Visibility */}
              {selectedPlan && !selectedPlan.archivedAt ? (
                <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase text-primary">
                        {t("visibility.title")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("visibility.description")}
                      </p>
                    </div>
                    <button
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                        visibilityGlobal
                          ? "bg-emerald-500 text-white"
                          : "bg-amber-500 text-white",
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
                  </div>

                  {!visibilityGlobal ? (
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
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("visibility.grantedWorkspaces", {
                              count: allowedWorkspaces.length,
                            })}
                          </p>
                          <div className="space-y-1">
                            {allowedWorkspaces.map((ws) => (
                              <div
                                key={ws.id}
                                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/80 px-3 py-2"
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <Buildings
                                    className="h-4 w-4 shrink-0 text-muted-foreground"
                                    weight="fill"
                                  />
                                  <span className="truncate text-sm font-medium text-foreground">
                                    {ws.name}
                                  </span>
                                  <span className="truncate text-xs text-muted-foreground">
                                    {ws.id}
                                  </span>
                                </div>
                                <button
                                  className="ml-2 shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
                                  onClick={() => handleRevokeWorkspace(ws.id)}
                                  type="button"
                                >
                                  <X className="h-3.5 w-3.5" weight="bold" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex justify-end">
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
                </div>
              ) : null}

              {/* Exclusive affiliate */}
              {selectedPlan && !selectedPlan.archivedAt ? (
                <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-primary">
                        {t("exclusive.title")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("exclusive.description")}
                      </p>
                    </div>
                    {exclusiveAffiliate ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                        <UserCircle className="h-3.5 w-3.5" weight="fill" />
                        {t("exclusive.badge")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500 px-3 py-1 text-xs font-semibold text-white">
                        <EyeSlash className="h-3.5 w-3.5" weight="bold" />
                        {t("exclusive.none")}
                      </span>
                    )}
                  </div>

                  {!visibilityGlobal && !exclusiveAffiliate ? (
                    <div
                      className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800"
                      role="note"
                    >
                      {t("exclusive.conflictWithRestricted")}
                    </div>
                  ) : null}

                  {exclusiveAffiliate ? (
                    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/80 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <UserCircle
                          className="h-4 w-4 shrink-0 text-amber-600"
                          weight="fill"
                        />
                        <span className="truncate text-sm font-medium text-foreground">
                          {exclusiveAffiliate.brandName ||
                            t("exclusive.resolving")}
                        </span>
                        {exclusiveAffiliate.code ? (
                          <span className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {exclusiveAffiliate.code}
                          </span>
                        ) : null}
                      </div>
                      <button
                        aria-label={t("exclusive.clear")}
                        className="ml-2 shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
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

                  <div className="flex justify-end">
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
                </div>
              ) : null}

              {/* Pricing Items Editor */}
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
            </>
          )}
        </section>
      </div>
    </motion.main>
  );
}

const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string; weight?: "fill" | "bold" }>
> = {
  tts: SpeakerHigh,
  stt: Microphone,
  llm: ChatCircle,
  whatsapp: WhatsappLogo,
  telephony: Phone,
};

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
      <div className="rounded-2xl border border-border/70 bg-card/90 px-4 py-6 text-sm text-muted-foreground">
        {t("pricingItems.rateRequired")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">
            {t("pricingItems.title")}
          </p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            {t("pricingItems.description")}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white">
            <Scales className="h-4 w-4" weight="fill" />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("pricingItems.rateBannerLabel")}
            </p>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {t("pricingItems.rateBannerValue", {
                rate: rate.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""),
              })}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("pricingItems.conversionNote")}
      </p>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("pricingItems.empty")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([category, rows]) => {
            const Icon = CATEGORY_ICONS[category] ?? Package;
            const categoryKey = `pricing.categories.${category}` as const;
            const categoryTitle = t.has(categoryKey)
              ? t(categoryKey)
              : category;
            return (
              <div
                key={category}
                className="overflow-hidden rounded-2xl border border-border/70 bg-background/60"
              >
                <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-700 text-white">
                    <Icon className="h-4 w-4" weight="fill" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {categoryTitle}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {rows.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("pricingItems.service")}
                        </th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("pricingItems.metric")}
                        </th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("pricingItems.costBrl")}
                        </th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("pricingItems.priceBrl")}
                        </th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("pricingItems.markupPct")}
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("pricingItems.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
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
                            className="border-b border-border/40 last:border-b-0"
                          >
                            <td className="px-3 py-2.5 align-top">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-medium text-foreground">
                                  {serviceLabel(t, item.service)}
                                </span>
                                {customized ? (
                                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                    {t("pricingItems.customized")}
                                  </span>
                                ) : null}
                              </div>
                              {priceBelowCost ? (
                                <p className="mt-1 text-[10px] text-amber-700">
                                  {t("pricingItems.priceBelowCost")}
                                </p>
                              ) : null}
                              {invalidBrl ? (
                                <p className="mt-1 text-[10px] text-red-600">
                                  {t("pricingItems.invalidAmount")}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 align-top text-xs text-muted-foreground">
                              {metricLabel(t, item.metric)}
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              {percentage ? (
                                <span className="text-xs text-muted-foreground">
                                  {t("pricingItems.notApplicable")}
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  <input
                                    aria-label={t("pricingItems.costBrl")}
                                    className="w-28 rounded-lg border border-border/70 bg-background px-2 py-1 text-xs tabular-nums outline-none transition focus:border-primary/40"
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
                                  <p className="text-[10px] tabular-nums text-muted-foreground">
                                    ≈{" "}
                                    {formatUsdCurrency(costUsd ?? 0)}
                                  </p>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              {percentage ? (
                                <span className="text-xs text-muted-foreground">
                                  {t("pricingItems.notApplicable")}
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  <input
                                    aria-label={t("pricingItems.priceBrl")}
                                    className="w-28 rounded-lg border border-border/70 bg-background px-2 py-1 text-xs tabular-nums outline-none transition focus:border-primary/40"
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
                                  <p className="text-[10px] tabular-nums text-muted-foreground">
                                    ≈{" "}
                                    {formatUsdCurrency(priceUsd ?? 0)}
                                  </p>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <input
                                aria-label={t("pricingItems.markupPct")}
                                className="w-20 rounded-lg border border-border/70 bg-background px-2 py-1 text-xs tabular-nums outline-none transition focus:border-primary/40"
                                disabled={!!disabled}
                                min="0"
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "markupPct",
                                    e.target.value,
                                  )
                                }
                                step="0.01"
                                type="number"
                                value={item.markupPct}
                              />
                            </td>
                            <td className="px-3 py-2.5 align-top text-right">
                              <button
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
                                  customized && !disabled
                                    ? "text-primary hover:bg-primary/5"
                                    : "cursor-default text-muted-foreground/50",
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
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
