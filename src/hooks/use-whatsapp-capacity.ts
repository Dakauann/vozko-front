"use client";

import * as React from "react";

import { getWorkspaceEntitlementsAction } from "@/app/actions/addons";
import {
  getWhatsAppOnboardingConfigAction,
  listBusinessPhonesAction,
} from "@/app/actions/whatsapp-business-phones";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * Phone statuses that do NOT consume a WhatsApp number slot. This mirrors the
 * backend provisioning gate (CountActiveDialog360ByOwner), which counts numbers
 * whose status is not ONBOARDING_FAILED or SUSPENDED. Keeping the two definitions
 * aligned stops the UI from claiming "full" while the backend would still allow a
 * number (or the reverse).
 */
export const INACTIVE_STATUSES = new Set<string>([
  "ONBOARDING_FAILED",
  "SUSPENDED",
  "DELETED",
]);

export interface WhatsAppCapacity {
  /** True until the entitlement has resolved for the first time. */
  loading: boolean;
  /** True once we have a real entitlement answer (never gate a flow before this). */
  ready: boolean;
  /** Active numbers currently occupying a slot. */
  used: number;
  /** Total slots = plan base + active addon units. */
  total: number;
  planBase: number;
  addonUnits: number;
  /** Free slots, never negative. */
  remaining: number;
  /** The workspace has any WhatsApp number allowance at all. */
  hasPlan: boolean;
  /** Allowance exists and every slot is taken. */
  atLimit: boolean;
  /** A new number can be connected right now. */
  canAdd: boolean;
  /**
   * Whether the server's active onboarding path consumes a capacity slot. Mirrors
   * the backend ENABLE_360DIALOG_ONBOARDING flag: the native Meta path is slot-free
   * (false), the 360dialog path is slot-billed (true). When false the capacity cap
   * never blocks onboarding.
   */
  requiresSlot: boolean;
}

interface Entitlement {
  total: number;
  planBase: number;
  addonUnits: number;
}

/**
 * Resolves the current workspace's WhatsApp number capacity (allowance vs usage)
 * as one derived value. It is the single source of truth for both the capacity
 * meter and the "can I start onboarding?" gate.
 *
 * Pass `usedOverride` when the caller already has the workspace's phone list
 * loaded (e.g. the list page) to avoid a second fetch; omit it to let the hook
 * fetch the active number count itself (e.g. the connect page).
 */
export function useWhatsAppCapacity(opts?: {
  usedOverride?: number;
}): WhatsAppCapacity {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? null;
  const usedOverride = opts?.usedOverride;

  const [entitlement, setEntitlement] = React.useState<Entitlement | null>(null);
  const [fetchedUsed, setFetchedUsed] = React.useState<number | null>(null);
  // Whether the server's active onboarding path consumes a slot. null until resolved.
  const [requiresSlot, setRequiresSlot] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void getWorkspaceEntitlementsAction(workspaceId).then((r) => {
      if (cancelled) return;
      const e = r.entitlements.find((x) => x.kind === "whatsapp_business_phones");
      setEntitlement(
        e
          ? { total: e.total, planBase: e.planBase, addonUnits: e.addonUnits }
          : { total: 0, planBase: 0, addonUnits: 0 },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  React.useEffect(() => {
    if (usedOverride !== undefined) return;
    if (!workspaceId) return;
    let cancelled = false;
    void listBusinessPhonesAction({ page: 1, pageSize: 200 }).then((r) => {
      if (cancelled) return;
      const rows = r.phones ?? [];
      // Count only numbers that actually occupy THIS workspace's slot, same rule as
      // the backend gate (CountActiveDialog360ByOwner): active AND owned by this
      // workspace. The scoped list also returns numbers merely shared with the
      // workspace (workspace_phone_access), which are owned, and billed, elsewhere;
      // counting those inflated the meter to e.g. "6/10" when only one is truly owned.
      const activeOwned = rows.filter(
        (p) =>
          p.ownerWorkspaceId === workspaceId &&
          !INACTIVE_STATUSES.has(p.status),
      ).length;
      setFetchedUsed(activeOwned);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, usedOverride]);

  React.useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void getWhatsAppOnboardingConfigAction().then((r) => {
      if (cancelled) return;
      // Default to slot-billed (true) if the config is unavailable, so a failed
      // lookup errs on the side of enforcing the cap rather than giving away
      // uncapped numbers.
      setRequiresSlot(r.config ? r.config.requiresSlot : true);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return React.useMemo<WhatsAppCapacity>(() => {
    const ready = entitlement !== null && requiresSlot !== null;
    const slotBilled = requiresSlot ?? true;
    const total = entitlement?.total ?? 0;
    const planBase = entitlement?.planBase ?? 0;
    const addonUnits = entitlement?.addonUnits ?? 0;
    const used = usedOverride ?? fetchedUsed ?? 0;
    const hasPlan = total > 0;
    const remaining = Math.max(0, total - used);
    // A slot-free onboarding path (native Meta) is never "at limit" and can always
    // add; the capacity cap only applies to the slot-billed (360dialog) path.
    const atLimit = slotBilled && hasPlan && used >= total;
    const canAdd = slotBilled ? hasPlan && used < total : true;
    return {
      loading: !ready,
      ready,
      used,
      total,
      planBase,
      addonUnits,
      remaining,
      hasPlan,
      atLimit,
      canAdd,
      requiresSlot: slotBilled,
    };
  }, [entitlement, fetchedUsed, usedOverride, requiresSlot]);
}
