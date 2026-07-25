import type {
  CreateSubscriptionInvoicePayload,
  CreateSubscriptionInvoiceResponse,
  PlanDefinition,
  PlanMutationInput,
  PublicPlanDetails,
  PublicWorkspaceSubscriptionDetails,
  SetPlanExclusiveAffiliateInput,
  SetPlanVisibilityInput,
  WorkspaceSubscriptionDetails,
} from "@/lib/workspace-plan/types";
import { apiFetch } from "@/lib/api/http";
import { apiClient } from "@/lib/api/browser-client";
import { REF_COOKIE_NAME } from "@/lib/affiliate/ref-cookie.client";
import { clearClientCookie, readClientCookie } from "@/lib/browser/client-cookie";

export interface PublicAffiliateBrand {
  code: string;
  brandName: string;
  brandLogoUrl: string;
}

export async function listPublicPlansAction(
  workspaceId?: string,
  referralCode?: string,
): Promise<{
  plans: PublicPlanDetails[];
  annualDiscountPct: number;
  affiliateBrand?: PublicAffiliateBrand | null;
  error?: string | null;
}> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  if (!workspaceId && referralCode) {
    const trimmed = referralCode.trim();
    if (trimmed) params.set("ref", trimmed);
  }
  const path = params.size > 0 ? `/plans?${params}` : "/plans";

  const response = await apiFetch<{
    plans: PublicPlanDetails[];
    annualDiscountPct: number;
    affiliateBrand?: PublicAffiliateBrand | null;
  }>(path, {
    method: "GET",
  });

  if (response.error) {
    return {
      plans: [],
      annualDiscountPct: 0,
      affiliateBrand: null,
      error: response.error.message,
    };
  }

  return {
    plans: response.data?.plans ?? [],
    annualDiscountPct: response.data?.annualDiscountPct ?? 0,
    affiliateBrand: response.data?.affiliateBrand ?? null,
    error: null,
  };
}

export async function listMyAffiliateExclusivePlansAction(): Promise<{
  plans: PublicPlanDetails[];
  annualDiscountPct: number;
  error?: string | null;
}> {
  const response = await apiClient<{
    plans: PublicPlanDetails[];
    annualDiscountPct: number;
  }>("/affiliate/plans", { method: "GET" });

  if (response.error) {
    if (response.error.status === 403) {
      return { plans: [], annualDiscountPct: 0, error: "forbidden" };
    }
    return { plans: [], annualDiscountPct: 0, error: response.error.message };
  }

  return {
    plans: response.data?.plans ?? [],
    annualDiscountPct: response.data?.annualDiscountPct ?? 0,
    error: null,
  };
}

export async function adminListPlansAction(includeArchived = false): Promise<{
  plans: PlanDefinition[];
  error?: string | null;
}> {
  const params = new URLSearchParams();
  if (includeArchived) {
    params.set("includeArchived", "true");
  }

  const path = params.size > 0 ? `/admin/plans?${params}` : "/admin/plans";
  const response = await apiClient<PlanDefinition[]>(path, {
    method: "GET",
  });

  if (response.error) {
    return { plans: [], error: response.error.message };
  }

  return { plans: response.data ?? [], error: null };
}

export async function adminGetPlanAction(planId: string): Promise<{
  plan: PlanDefinition | null;
  error?: string | null;
}> {
  const response = await apiClient<PlanDefinition>(
    `/admin/plans/${encodeURIComponent(planId)}`,
    {
      method: "GET",
    },
  );

  if (response.error) {
    return { plan: null, error: response.error.message };
  }

  return { plan: response.data ?? null, error: null };
}

export async function adminCreatePlanAction(input: PlanMutationInput): Promise<{
  plan: PlanDefinition | null;
  error?: string | null;
}> {
  const response = await apiClient<PlanDefinition>("/admin/plans", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (response.error) {
    return { plan: null, error: response.error.message };
  }

  return { plan: response.data ?? null, error: null };
}

export async function adminUpdatePlanAction(
  planId: string,
  input: PlanMutationInput,
): Promise<{
  plan: PlanDefinition | null;
  error?: string | null;
}> {
  const response = await apiClient<PlanDefinition>(
    `/admin/plans/${encodeURIComponent(planId)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );

  if (response.error) {
    return { plan: null, error: response.error.message };
  }

  return { plan: response.data ?? null, error: null };
}

export async function adminArchivePlanAction(planId: string): Promise<{
  success: boolean;
  error?: string | null;
}> {
  const response = await apiClient<{ status: string }>(
    `/admin/plans/${encodeURIComponent(planId)}/archive`,
    {
      method: "PATCH",
    },
  );

  if (response.error) {
    return { success: false, error: response.error.message };
  }

  return { success: response.data?.status === "archived", error: null };
}

export async function adminSetPlanVisibilityAction(
  planId: string,
  input: SetPlanVisibilityInput,
): Promise<{
  plan: PlanDefinition | null;
  error?: string | null;
}> {
  const response = await apiClient<PlanDefinition>(
    `/admin/plans/${encodeURIComponent(planId)}/visibility`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );

  if (response.error) {
    return { plan: null, error: response.error.message };
  }

  return { plan: response.data ?? null, error: null };
}

export async function adminSetPlanExclusiveAffiliateAction(
  planId: string,
  input: SetPlanExclusiveAffiliateInput,
): Promise<{
  plan: PlanDefinition | null;
  error?: string | null;
}> {
  const response = await apiClient<PlanDefinition>(
    `/admin/plans/${encodeURIComponent(planId)}/exclusive-affiliate`,
    {
      method: "PUT",
      body: JSON.stringify({ affiliateId: input.affiliateId }),
    },
  );

  if (response.error) {
    return { plan: null, error: response.error.message };
  }

  return { plan: response.data ?? null, error: null };
}

export async function adminGetWorkspaceSubscriptionAction(
  workspaceId: string,
): Promise<{
  subscription: WorkspaceSubscriptionDetails | null;
  error?: string | null;
}> {
  const response = await apiClient<WorkspaceSubscriptionDetails>(
    `/admin/workspaces/${encodeURIComponent(workspaceId)}/subscription`,
    {
      method: "GET",
    },
  );

  if (response.error) {
    if (response.error.status === 404) {
      return { subscription: null, error: null };
    }
    return { subscription: null, error: response.error.message };
  }

  return { subscription: response.data ?? null, error: null };
}

export async function adminCancelWorkspaceSubscriptionAction(
  workspaceId: string,
): Promise<{
  subscription: WorkspaceSubscriptionDetails | null;
  error?: string | null;
}> {
  const response = await apiClient<WorkspaceSubscriptionDetails>(
    `/admin/workspaces/${encodeURIComponent(workspaceId)}/subscription/cancel`,
    {
      method: "POST",
    },
  );

  if (response.error) {
    return { subscription: null, error: response.error.message };
  }

  return { subscription: response.data ?? null, error: null };
}

export async function adminCreateSubscriptionInvoiceAction(
  workspaceId: string,
  input: CreateSubscriptionInvoicePayload,
): Promise<{
  invoice: CreateSubscriptionInvoiceResponse["invoice"] | null;
  error?: string | null;
}> {
  const response = await apiClient<CreateSubscriptionInvoiceResponse>(
    `/admin/workspaces/${encodeURIComponent(workspaceId)}/subscription`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  if (response.error) {
    return { invoice: null, error: response.error.message };
  }

  return { invoice: response.data?.invoice ?? null, error: null };
}

export async function getWorkspaceSubscriptionAction(
  workspaceId: string,
): Promise<{
  subscription: PublicWorkspaceSubscriptionDetails | null;
  error?: string | null;
}> {
  const response = await apiClient<PublicWorkspaceSubscriptionDetails>(
    `/workspaces/${encodeURIComponent(workspaceId)}/subscription`,
    {
      method: "GET",
    },
  );

  if (response.error) {
    if (response.error.status === 404) {
      return { subscription: null, error: null };
    }
    return { subscription: null, error: response.error.message };
  }

  return { subscription: response.data ?? null, error: null };
}

export async function cancelWorkspaceSubscriptionAction(
  workspaceId: string,
): Promise<{
  subscription: PublicWorkspaceSubscriptionDetails | null;
  error?: string | null;
}> {
  const response = await apiClient<PublicWorkspaceSubscriptionDetails>(
    `/workspaces/${encodeURIComponent(workspaceId)}/subscription/cancel`,
    {
      method: "POST",
    },
  );

  if (response.error) {
    return { subscription: null, error: response.error.message };
  }

  return { subscription: response.data ?? null, error: null };
}

export async function createSubscriptionInvoiceAction(
  workspaceId: string,
  input: CreateSubscriptionInvoicePayload,
): Promise<{
  invoice: CreateSubscriptionInvoiceResponse["invoice"] | null;
  error?: string | null;
  errorCode?: string | null;
}> {
  const referralCode = readClientCookie(REF_COOKIE_NAME)?.trim() || "";
  const bodyWithRef = referralCode ? { ...input, referralCode } : input;

  const response = await apiClient<CreateSubscriptionInvoiceResponse>(
    `/workspaces/${encodeURIComponent(workspaceId)}/subscription`,
    {
      method: "POST",
      body: JSON.stringify(bodyWithRef),
      headers: referralCode ? { "X-Affiliate-Ref": referralCode } : undefined,
    },
  );

  if (response.error) {
    return { invoice: null, error: response.error.message, errorCode: response.error.code ?? null };
  }

  if (referralCode) {
    clearClientCookie(REF_COOKIE_NAME);
  }

  return { invoice: response.data?.invoice ?? null, error: null, errorCode: null };
}
