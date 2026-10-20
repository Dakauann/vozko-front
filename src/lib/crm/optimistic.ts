import type { ActiveConversation, InboxEntry } from "@/lib/conversations/types";

export interface OptimisticOperation<Snapshot> {
  id: string;
  target: string;
  snapshot: Snapshot;
}

export type OptimisticLedger<Snapshot> = ReadonlyMap<string, OptimisticOperation<Snapshot>>;

export function emptyLedger<Snapshot>(): OptimisticLedger<Snapshot> {
  return new Map();
}

export function pendingOn<Snapshot>(
  ledger: OptimisticLedger<Snapshot>,
  target: string,
): OptimisticOperation<Snapshot> | undefined {
  for (const operation of ledger.values()) {
    if (operation.target === target) return operation;
  }
  return undefined;
}

export function beginOperation<Snapshot>(
  ledger: OptimisticLedger<Snapshot>,
  operation: OptimisticOperation<Snapshot>,
): OptimisticLedger<Snapshot> {
  const next = new Map(ledger);
  const superseded = pendingOn(ledger, operation.target);
  if (superseded) next.delete(superseded.id);
  next.set(operation.id, {
    ...operation,
    snapshot: superseded ? superseded.snapshot : operation.snapshot,
  });
  return next;
}

export function rollbackOperation<Snapshot>(
  ledger: OptimisticLedger<Snapshot>,
  id: string,
): { ledger: OptimisticLedger<Snapshot>; snapshot: Snapshot | null } {
  const operation = ledger.get(id);
  if (!operation) return { ledger, snapshot: null };
  const next = new Map(ledger);
  next.delete(id);
  return { ledger: next, snapshot: operation.snapshot };
}

export function confirmOperation<Snapshot>(
  ledger: OptimisticLedger<Snapshot>,
  id: string,
): { ledger: OptimisticLedger<Snapshot>; confirmed: boolean } {
  if (!ledger.has(id)) return { ledger, confirmed: false };
  const next = new Map(ledger);
  next.delete(id);
  return { ledger: next, confirmed: true };
}

export interface EntryTarget {
  entryId: string;
  entryType: string;
}

export type ConversationPatch = Partial<
  Pick<
    ActiveConversation,
    "conversation_status" | "close_source" | "close_reason" | "close_outcome" | "closed_at"
  >
>;

export interface ConversationViews {
  inbox: InboxEntry[];
  search: InboxEntry[] | null;
  active: ActiveConversation | null;
}

export interface ViewMembership {
  inbox: (entry: InboxEntry) => boolean;
  search: (entry: InboxEntry) => boolean;
}

export interface SavedEntry {
  entry: InboxEntry;
  index: number;
}

export interface ViewsSnapshot {
  inbox: SavedEntry | null;
  search: SavedEntry | null;
  active: ConversationPatch | null;
}

function isTarget(
  candidate: { entry_id: string; entry_type: string },
  target: EntryTarget,
): boolean {
  return candidate.entry_id === target.entryId && candidate.entry_type === target.entryType;
}

export function saveEntry(list: InboxEntry[] | null, target: EntryTarget): SavedEntry | null {
  const index = list?.findIndex((e) => isTarget(e, target)) ?? -1;
  return list && index >= 0 ? { entry: list[index], index } : null;
}

export function saveActive(
  active: ActiveConversation | null,
  target: EntryTarget,
  patch: ConversationPatch,
): ConversationPatch | null {
  if (!active || !isTarget(active, target)) return null;
  const saved: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof ConversationPatch)[]) {
    saved[key] = active[key];
  }
  return saved as ConversationPatch;
}

export function snapshotViews(
  views: ConversationViews,
  target: EntryTarget,
  patch: ConversationPatch,
): ViewsSnapshot {
  return {
    inbox: saveEntry(views.inbox, target),
    search: saveEntry(views.search, target),
    active: saveActive(views.active, target, patch),
  };
}

export function applyToList(
  list: InboxEntry[],
  target: EntryTarget,
  patch: ConversationPatch,
  keep: (entry: InboxEntry) => boolean,
): InboxEntry[] {
  const index = list.findIndex((e) => isTarget(e, target));
  if (index < 0) return list;
  const patched = { ...list[index], ...patch };
  if (!keep(patched)) return list.filter((_, i) => i !== index);
  const next = [...list];
  next[index] = patched;
  return next;
}

export function restoreList(
  list: InboxEntry[],
  target: EntryTarget,
  saved: SavedEntry | null,
  keep: (entry: InboxEntry) => boolean,
  correction?: ConversationPatch,
): InboxEntry[] {
  const without = list.filter((e) => !isTarget(e, target));
  if (!saved) return without;
  const restored = { ...saved.entry, ...correction };
  if (!keep(restored)) return without;
  const next = [...without];
  next.splice(Math.min(saved.index, next.length), 0, restored);
  return next;
}

export function applyToActive(
  active: ActiveConversation | null,
  target: EntryTarget,
  patch: ConversationPatch,
): ActiveConversation | null {
  return active && isTarget(active, target) ? { ...active, ...patch } : active;
}

export function restoreActive(
  active: ActiveConversation | null,
  target: EntryTarget,
  saved: ConversationPatch | null,
  correction?: ConversationPatch,
): ActiveConversation | null {
  if (!active || !saved || !isTarget(active, target)) return active;
  return { ...active, ...saved, ...correction };
}

export function applyOptimistic(
  views: ConversationViews,
  target: EntryTarget,
  patch: ConversationPatch,
  membership: ViewMembership,
): { views: ConversationViews; snapshot: ViewsSnapshot } {
  return {
    snapshot: snapshotViews(views, target, patch),
    views: {
      inbox: applyToList(views.inbox, target, patch, membership.inbox),
      search: views.search && applyToList(views.search, target, patch, membership.search),
      active: applyToActive(views.active, target, patch),
    },
  };
}

export function rollback(
  views: ConversationViews,
  target: EntryTarget,
  snapshot: ViewsSnapshot,
  membership: ViewMembership,
  correction?: ConversationPatch,
): ConversationViews {
  return {
    inbox: restoreList(views.inbox, target, snapshot.inbox, membership.inbox, correction),
    search:
      views.search &&
      restoreList(views.search, target, snapshot.search, membership.search, correction),
    active: restoreActive(views.active, target, snapshot.active, correction),
  };
}
