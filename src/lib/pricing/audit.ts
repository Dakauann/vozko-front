import type { PricingAuditEntry } from "@/lib/pricing/types";

export type AuditChangeKind = "price" | "cost";

export interface AuditChange {
    kind: AuditChangeKind;
    oldMicros: number;
    newMicros: number;
}

type AuditAmounts = Pick<PricingAuditEntry, "oldPriceMicros" | "newPriceMicros"> & {
    oldCostMicros?: number;
    newCostMicros?: number;
};

export function auditChangeOf(entry: AuditAmounts): AuditChange {
    const oldCost = entry.oldCostMicros ?? 0;
    const newCost = entry.newCostMicros ?? 0;
    if (oldCost !== newCost && entry.oldPriceMicros === entry.newPriceMicros) {
        return { kind: "cost", oldMicros: oldCost, newMicros: newCost };
    }
    return { kind: "price", oldMicros: entry.oldPriceMicros, newMicros: entry.newPriceMicros };
}
