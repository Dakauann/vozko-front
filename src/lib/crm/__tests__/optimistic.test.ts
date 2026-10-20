import { describe, expect, it } from "vitest";

import type { ActiveConversation, InboxEntry } from "@/lib/conversations/types";
import {
  applyOptimistic,
  beginOperation,
  confirmOperation,
  emptyLedger,
  pendingOn,
  rollback,
  rollbackOperation,
  type ConversationViews,
  type ViewMembership,
  type ViewsSnapshot,
} from "../optimistic";

function entry(id: string, status: string): InboxEntry {
  return {
    entry_id: id,
    entry_type: "whatsapp",
    lead_name: id,
    lead_number: "",
    unread_count: 0,
    last_message_at: "2026-10-18T10:00:00Z",
    conversation_status: status,
  } as unknown as InboxEntry;
}

const active = {
  entry_id: "e-2",
  entry_type: "whatsapp",
  lead_name: "e-2",
  messages: [],
  conversation_status: "new",
} as unknown as ActiveConversation;

const target = { entryId: "e-2", entryType: "whatsapp" };

const showsEverything: ViewMembership = { inbox: () => true, search: () => true };

const showsOnly = (status: string): ViewMembership => ({
  inbox: (e) => e.conversation_status === status,
  search: (e) => e.conversation_status === status,
});

function views(): ConversationViews {
  return {
    inbox: [entry("e-1", "new"), entry("e-2", "new"), entry("e-3", "new")],
    search: [entry("e-2", "new")],
    active,
  };
}

describe("optimistic conversation views", () => {
  it("patches the entry in the inbox, the search results and the open conversation", () => {
    const { views: next } = applyOptimistic(views(), target, { conversation_status: "ongoing" }, showsEverything);

    expect(next.inbox[1].conversation_status).toBe("ongoing");
    expect(next.search?.[0].conversation_status).toBe("ongoing");
    expect(next.active?.conversation_status).toBe("ongoing");
  });

  it("drops the entry from a list whose filter it no longer matches", () => {
    const { views: next } = applyOptimistic(views(), target, { conversation_status: "finished" }, showsOnly("new"));

    expect(next.inbox.map((e) => e.entry_id)).toEqual(["e-1", "e-3"]);
    expect(next.search).toEqual([]);
  });

  it("rollback restores inbox, search results and the active conversation exactly", () => {
    const before = views();
    const { views: patched, snapshot } = applyOptimistic(
      before,
      target,
      { conversation_status: "finished", close_source: "human", closed_at: "2026-10-18T11:00:00Z" },
      showsOnly("new"),
    );

    const restored = rollback(patched, target, snapshot, showsOnly("new"));

    expect(restored.inbox).toEqual(before.inbox);
    expect(restored.search).toEqual(before.search);
    expect(restored.active?.conversation_status).toBe("new");
    expect(restored.active?.close_source).toBeUndefined();
    expect(restored.active?.closed_at).toBeUndefined();
  });

  it("rollback takes the server's correction over the remembered value", () => {
    const { views: patched, snapshot } = applyOptimistic(views(), target, { conversation_status: "finished" }, showsEverything);

    const restored = rollback(patched, target, snapshot, showsEverything, { conversation_status: "ongoing" });

    expect(restored.inbox[1].conversation_status).toBe("ongoing");
    expect(restored.search?.[0].conversation_status).toBe("ongoing");
    expect(restored.active?.conversation_status).toBe("ongoing");
  });

  it("rollback keeps the entry out of a list whose filter the restored entry does not match", () => {
    const { views: patched, snapshot } = applyOptimistic(views(), target, { conversation_status: "ongoing" }, showsEverything);

    const restored = rollback(patched, target, snapshot, showsOnly("ongoing"));

    expect(restored.inbox.map((e) => e.entry_id)).toEqual(["e-1", "e-3"]);
  });

  it("leaves search results closed when there is no search", () => {
    const { views: patched, snapshot } = applyOptimistic({ ...views(), search: null }, target, { conversation_status: "ongoing" }, showsEverything);

    expect(rollback(patched, target, snapshot, showsEverything).search).toBeNull();
  });

  it("leaves another open conversation alone", () => {
    const other = { ...active, entry_id: "e-9" };
    const { views: patched, snapshot } = applyOptimistic({ ...views(), active: other }, target, { conversation_status: "ongoing" }, showsEverything);

    expect(patched.active).toBe(other);
    expect(rollback(patched, target, snapshot, showsEverything).active).toBe(other);
  });
});

describe("optimistic ledger", () => {
  const snapshotA: ViewsSnapshot = { inbox: null, search: null, active: { conversation_status: "new" } };
  const snapshotB: ViewsSnapshot = { inbox: null, search: null, active: { conversation_status: "ongoing" } };

  it("finds the pending operation by its target, the way server errors name it", () => {
    const ledger = beginOperation(emptyLedger<ViewsSnapshot>(), { id: "op-1", target: "whatsapp-e-2", snapshot: snapshotA });

    expect(pendingOn(ledger, "whatsapp-e-2")?.id).toBe("op-1");
    expect(pendingOn(ledger, "whatsapp-e-9")).toBeUndefined();
  });

  it("hands the snapshot back once on rollback", () => {
    const ledger = beginOperation(emptyLedger<ViewsSnapshot>(), { id: "op-1", target: "t", snapshot: snapshotA });

    const first = rollbackOperation(ledger, "op-1");
    const second = rollbackOperation(first.ledger, "op-1");

    expect(first.snapshot).toBe(snapshotA);
    expect(second.snapshot).toBeNull();
  });

  it("a late success after a rollback does not reapply", () => {
    const ledger = beginOperation(emptyLedger<ViewsSnapshot>(), { id: "op-1", target: "t", snapshot: snapshotA });
    const { ledger: rolledBack } = rollbackOperation(ledger, "op-1");

    expect(confirmOperation(rolledBack, "op-1").confirmed).toBe(false);
  });

  it("a success settles the operation so a later failure has nothing to roll back", () => {
    const ledger = beginOperation(emptyLedger<ViewsSnapshot>(), { id: "op-1", target: "t", snapshot: snapshotA });
    const confirmed = confirmOperation(ledger, "op-1");

    expect(confirmed.confirmed).toBe(true);
    expect(rollbackOperation(confirmed.ledger, "op-1").snapshot).toBeNull();
  });

  it("a second change on the same target keeps the state from before the first, which is what the server still has", () => {
    const first = beginOperation(emptyLedger<ViewsSnapshot>(), { id: "op-1", target: "t", snapshot: snapshotA });
    const second = beginOperation(first, { id: "op-2", target: "t", snapshot: snapshotB });

    expect(pendingOn(second, "t")?.id).toBe("op-2");
    expect(rollbackOperation(second, "op-2").snapshot).toBe(snapshotA);
    expect(confirmOperation(second, "op-1").confirmed).toBe(false);
  });

  it("never mutates the ledger it was given", () => {
    const empty = emptyLedger<ViewsSnapshot>();
    beginOperation(empty, { id: "op-1", target: "t", snapshot: snapshotA });

    expect(empty.size).toBe(0);
  });
});
