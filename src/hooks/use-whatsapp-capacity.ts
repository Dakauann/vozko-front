"use client";

import * as React from "react";

import { getWorkspaceEntitlementsAction } from "@/app/actions/addons";
import {
  getWhatsAppOnboardingConfigAction,
  listBusinessPhonesAction,
} from "@/app/actions/whatsapp-business-phones";
import { useWorkspace } from "@/contexts/workspace-context";

export const INACTIVE_STATUSES = new Set<string>([
  "ONBOARDING_FAILED",
  "SUSPENDED",
  "DELETED",
]);

export interface WhatsAppCapacity {
  loading: boolean;
  ready: boolean;
  used: number;
  total: number;
  planBase: number;
  addonUnits: number;
  remaining: number;
  hasPlan: boolean;
  atLimit: boolean;
  canAdd: boolean;
  requiresSlot: boolean;
}

interface Entitlement {
  total: number;
  planBase: number;
  addonUnits: number;
}

export function useWhatsAppCapacity(opts?: {
  usedOverride?: number;
}): WhatsAppCapacity {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? null;
  const usedOverride = opts?.usedOverride;

  const [entitlement, setEntitlement] = React.useState<Entitlement | null>(null);
  const [fetchedUsed, setFetchedUsed] = React.useState<number | null>(null);
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
