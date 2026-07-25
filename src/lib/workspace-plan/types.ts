import type { BillingType, Invoice } from "@/lib/invoices/types";

export type SubscriptionStatus = "active" | "cancelled" | "expired";

export interface PlanPricingItem {
  id: string;
  planDefinitionId: string;
  category: string;
  service: string;
  metric: string;
  // Internal, admin-only: the backend strips costMicros/markupPct from customer plan responses
  // (see vozko-go customer_billing_presenters.go), so they are ABSENT for end customers. Never render.
  costMicros?: number;
  priceMicros: number;
  markupPct?: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanPricingItemInput {
  category: string;
  service: string;
  metric: string;
  costMicros: number;
  priceMicros: number;
  markupPct: number;
  currency: string;
}

export interface PlanDefinition {
  id: string;
  name: string;
  description: string;
  basePriceBRLCents: number;
  maxCallChannels: number;
  maxTtsConcurrency?: number;
  includedWhatsAppBusinessPhones?: number;
  maxBranches?: number;
  maxHoldMusicTracks?: number;
  isGloballyVisible: boolean;
  exclusiveAffiliateId?: string | null;
  pricingItems?: PlanPricingItem[];
  allowedWorkspaceIds?: string[];
  allowedWorkspaces?: AllowedWorkspace[];
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AllowedWorkspace {
  id: string;
  name: string;
}

export interface SetPlanExclusiveAffiliateInput {
  affiliateId: string | null;
}

export interface PlanMutationInput {
  name: string;
  description: string;
  basePriceBRLCents: number;
  maxCallChannels: number;
  maxTtsConcurrency?: number;
  includedWhatsAppBusinessPhones?: number;
  maxBranches?: number;
  maxHoldMusicTracks?: number;
  isGloballyVisible?: boolean;
  pricingItems?: PlanPricingItemInput[];
}

export interface SetPlanVisibilityInput {
  isGloballyVisible: boolean;
  allowedWorkspaceIds: string[];
}

export interface PublicPlanDetails {
  plan: PlanDefinition;
}

export interface WorkspaceSubscription {
  id: string;
  workspaceId: string;
  planDefinitionId: string;
  billingCycle: 'monthly' | 'annual';
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSubscriptionDetails {
  subscription: WorkspaceSubscription;
  plan?: PlanDefinition;
}

export interface PublicWorkspaceSubscriptionDetails {
  subscription: WorkspaceSubscription;
  plan?: PlanDefinition;
}

export interface CreateSubscriptionInvoicePayload {
  planId: string;
  billingType: BillingType;
  billingCycle?: 'monthly' | 'annual';
  description?: string;
}

export interface CreateSubscriptionInvoiceResponse {
  invoice: Invoice;
}