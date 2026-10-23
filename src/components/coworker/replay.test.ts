import { describe, expect, it } from "vitest";

import type { AgentStep } from "@/lib/studio/agent/batch";
import { createStudioStore } from "@/lib/studio/store";

import { createAgentPresence } from "@/components/studio/agent/presence";

import { replaySteps, stepDelay, type ReplayDeps } from "./replay";

interface Item {
  id: string;
  value: number;
}

interface Doc {
  items: Item[];
}

function steps(base: Doc, ids: string[]): AgentStep<Doc>[] {
  let current = base;
  return ids.map((id) => {
    current = { items: [...current.items, { id, value: 0 }] };
    return { document: current, focus: { kind: "time", atMs: 0 }, label: id };
  });
}

function deps(store: ReturnType<typeof createStudioStore<Doc>>, extra: Partial<ReplayDeps<Doc, AgentStep<Doc>>> = {}): ReplayDeps<Doc, AgentStep<Doc>> {
  return { store, presence: createAgentPresence(), locate: () => null, label: (step) => step.label, delayMs: 0, valid: () => true, ...extra };
}

const ids = (doc: Doc) => doc.items.map((item) => item.id);

describe("replaySteps", () => {
  it("applies a whole batch as one undo step while the cursor visits each target", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    const presence = createAgentPresence();
    const labels: string[] = [];
    const outcome = await replaySteps(base, steps(base, ["a", "b", "c"]), deps(store, { presence, locate: () => ({ point: { x: 1, y: 2 }, outline: null }), label: (step) => (labels.push(step.label), step.label) }));
    expect(outcome).toEqual({ conflicts: [], skipped: [] });
    expect(ids(store.getState().document)).toEqual(["a", "b", "c"]);
    expect(labels).toEqual(["a", "b", "c"]);
    store.getState().undo();
    expect(ids(store.getState().document)).toEqual([]);
    expect(presence.store.getState().busy).toBe(false);
  });

  it("works next to the person: their edit during the batch stays and the batch still lands", async () => {
    const base: Doc = { items: [{ id: "mine", value: 0 }] };
    const store = createStudioStore(base);
    let shown = 0;
    const outcome = await replaySteps(base, steps(base, ["a", "b", "c"]), deps(store, {
      onStep: () => {
        shown += 1;
        if (shown === 1) store.getState().apply((doc) => ({ items: doc.items.map((item) => (item.id === "mine" ? { ...item, value: 7 } : item)) }));
      },
    }));
    expect(outcome).toEqual({ conflicts: [], skipped: [] });
    expect(store.getState().document.items).toEqual([{ id: "mine", value: 7 }, { id: "a", value: 0 }, { id: "b", value: 0 }, { id: "c", value: 0 }]);
  });

  it("keeps the person's value when both changed the same thing and reports it", async () => {
    const base: Doc = { items: [{ id: "x", value: 0 }] };
    const store = createStudioStore(base);
    const theirs: AgentStep<Doc>[] = [
      { document: { items: [{ id: "x", value: 1 }] }, focus: { kind: "time", atMs: 0 }, label: "one" },
      { document: { items: [{ id: "x", value: 2 }] }, focus: { kind: "time", atMs: 0 }, label: "two" },
    ];
    let shown = 0;
    const outcome = await replaySteps(base, theirs, deps(store, {
      onStep: () => {
        shown += 1;
        if (shown === 1) store.getState().apply(() => ({ items: [{ id: "x", value: 9 }] }));
      },
    }));
    expect(store.getState().document.items).toEqual([{ id: "x", value: 9 }]);
    expect(outcome.conflicts).toEqual(["items.x.value"]);
  });

  it("waits while the person is in the middle of a gesture", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    store.getState().beginTransaction();
    const replay = replaySteps(base, steps(base, ["a"]), deps(store));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(ids(store.getState().document)).toEqual([]);
    store.getState().commitTransaction();
    await replay;
    expect(ids(store.getState().document)).toEqual(["a"]);
  });

  it("skips a step whose merge would leave the project invalid", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    const outcome = await replaySteps(base, steps(base, ["a", "b"]), deps(store, { valid: (doc) => !doc.items.some((item) => item.id === "b") }));
    expect(outcome.skipped).toEqual([1]);
    expect(ids(store.getState().document)).toEqual(["a"]);
  });

  it("names every step a hidden tab could not land at once", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    store.getState().apply(() => ({ items: [{ id: "theirs", value: 1 }] }));
    const outcome = await replaySteps(base, steps(base, ["a", "b", "c"]), deps(store, { hidden: () => true, valid: (doc) => !doc.items.some((item) => item.id === "theirs") }));
    expect(outcome.skipped).toEqual([0, 1, 2]);
  });

  it("names the rest of the batch when a tab hidden halfway could not land it", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    let shown = 0;
    const outcome = await replaySteps(base, steps(base, ["a", "b", "c", "d"]), deps(store, { onStep: () => (shown += 1), hidden: () => shown >= 2, valid: (doc) => !doc.items.some((item) => item.id === "d") }));
    expect(outcome.skipped).toEqual([2, 3]);
    expect(ids(store.getState().document)).toEqual(["a", "b"]);
  });

  it("applies the whole batch at once in a hidden tab, where the browser holds timers back", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    const started = Date.now();
    await replaySteps(base, steps(base, ["a", "b", "c"]), deps(store, { delayMs: 60_000, hidden: () => true }));
    expect(ids(store.getState().document)).toEqual(["a", "b", "c"]);
    expect(Date.now() - started).toBeLessThan(1000);
    store.getState().undo();
    expect(ids(store.getState().document)).toEqual([]);
  });

  it("finishes the rest of the batch at once when the tab is hidden halfway", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    let shown = 0;
    await replaySteps(base, steps(base, ["a", "b", "c", "d"]), deps(store, { onStep: () => (shown += 1), hidden: () => shown >= 2 }));
    expect(shown).toBe(2);
    expect(ids(store.getState().document)).toEqual(["a", "b", "c", "d"]);
    store.getState().undo();
    expect(ids(store.getState().document)).toEqual([]);
  });

  it("applies a batch as one quiet change while the person is watching, without moving the cursor", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    const changes: Doc[] = [];
    store.subscribe((state, previous) => {
      if (state.document !== previous.document) changes.push(state.document);
    });
    let located = 0;
    await replaySteps(base, steps(base, ["a", "b", "c"]), deps(store, { locate: () => ((located += 1), null), delayMs: 400, quiet: true }));
    expect(changes.map(ids)).toEqual([["a", "b", "c"]]);
    expect(located).toBe(0);
  });

  it("tells the step whether the person and Elo still see the same project", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    const together: boolean[] = [];
    await replaySteps(base, steps(base, ["a", "b"]), deps(store, {
      onStep: (_, alone) => {
        together.push(alone);
        if (together.length === 1) store.getState().apply((doc) => ({ items: [...doc.items, { id: "mine", value: 0 }] }));
      },
    }));
    expect(together).toEqual([true, false]);
  });
});

describe("stepDelay", () => {
  it("spreads a batch over the animation budget within limits, and skips it for reduced motion", () => {
    expect(stepDelay(1, false)).toBe(420);
    expect(stepDelay(100, false)).toBe(120);
    expect(stepDelay(10, true)).toBe(0);
  });
});
