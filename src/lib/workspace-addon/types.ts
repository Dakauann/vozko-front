export type AddonEntitlementKind = "call_channels" | "whatsapp_business_phones";
export type AddonBillingCycle = "monthly" | "annual";
export type AddonSubscriptionStatus = "active" | "cancelled" | "expired";

export interface AddonDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  entitlementKind: AddonEntitlementKind;
  unitsPerQuantity: number;
  monthlyPriceMicros: number;
  annualPriceMicros: number;
  // Internal, admin-only: the backend strips these from the customer /addons/available response
  // (see vozko-go customer_billing_presenters.go), so they are ABSENT for end customers. Never render.
  monthlyCostMicros?: number;
  annualCostMicros?: number;
  isActive: boolean;
  isGloballyVisible: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddonDefinitionInput {
  key: string;
  name: string;
  description: string;
  entitlementKind: AddonEntitlementKind;
  unitsPerQuantity: number;
  monthlyPriceMicros: number;
  annualPriceMicros: number;
  monthlyCostMicros: number;
  annualCostMicros: number;
  isActive?: boolean;
  isGloballyVisible?: boolean;
}

export interface AddonSubscription {
  id: string;
  workspaceId: string;
  addonDefinitionId: string;
  addonKey: string;
  entitlementKind: AddonEntitlementKind;
  quantity: number;
  unitsPerQuantity: number;
  billingCycle: AddonBillingCycle;
  status: AddonSubscriptionStatus;
  unitPriceMicros: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseAddonInput {
  addonDefinitionId: string;
  quantity: number;
  billingCycle: AddonBillingCycle;
}

/**
 * No-charge quote shown before confirming an addon purchase (from POST /addons/preview). All money is in
 * USD micros (the saldo currency); the UI converts to BRL. `chargeNowMicros` is the exact amount debited
 * from saldo now (the prorated activation stub for a new monthly channel); `recurringMicros` is the
 * steady-state per-cycle amount that lands on the unified monthly invoice. Price only, never cost.
 */
export interface AddonPurchasePreview {
  chargeNowMicros: number;
  recurringMicros: number;
  billingCycle: AddonBillingCycle;
  prorated: boolean;
  /** Days the up-front charge covers, from activation to the first billing anchor (the 23rd). */
  proratedDays: number;
  /** Co-term period end = the first billing anchor (a 23rd); the recurring charge starts here. */
  periodEnd: string;
  nextInvoiceDate: string;
}

export interface WorkspaceEntitlement {
  kind: AddonEntitlementKind;
  planBase: number;
  addonUnits: number;
  total: number;
}
