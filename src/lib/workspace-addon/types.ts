export type AddonEntitlementKind =
  | "call_channels"
  | "whatsapp_business_phones"
  | "unofficial_whatsapp_instances";
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

export interface AddonPurchasePreview {
  chargeNowMicros: number;
  recurringMicros: number;
  billingCycle: AddonBillingCycle;
  prorated: boolean;
  proratedDays: number;
  periodEnd: string;
  nextInvoiceDate: string;
}

export interface WorkspaceEntitlement {
  kind: AddonEntitlementKind;
  planBase: number;
  addonUnits: number;
  total: number;
}
