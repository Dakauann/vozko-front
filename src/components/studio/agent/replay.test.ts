import { describe, expect, it } from "vitest";

import type { AgentStep } from "@/lib/studio/agent/batch";
import { createStudioStore } from "@/lib/studio/store";

import { createAgentPresence } from "./presence";
import { replaySteps, stepDelay } from "./replay";

interface Doc {
  items: string[];
}

function steps(base: Doc, names: string[]): AgentStep<Doc>[] {
  let current = base;
  return names.map((name) => {
    current = { items: [...current.items, name] };
    return { document: current, focus: { kind: "time", atMs: 0 }, label: name };
  });
}

describe("replaySteps", () => {
  it("applies the whole batch at once in a hidden tab, where the browser holds timers back", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    const started = Date.now();
    const outcome = await replaySteps(base, steps(base, ["a", "b", "c"]), {
      store,
      presence: createAgentPresence(),
      locate: () => null,
      label: (step) => step.label,
      delayMs: 60_000,
      hidden: () => true,
    });
    expect(outcome).toBe("applied");
    expect(store.getState().document.items).toEqual(["a", "b", "c"]);
    expect(Date.now() - started).toBeLessThan(1000);
    store.getState().undo();
    expect(store.getState().document.items).toEqual([]);
  });

  it("finishes the rest of the batch at once when the tab is hidden halfway", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    let shown = 0;
    const outcome = await replaySteps(base, steps(base, ["a", "b", "c", "d"]), {
      store,
      presence: createAgentPresence(),
      locate: () => null,
      label: (step) => step.label,
      onStep: () => {
        shown += 1;
      },
      delayMs: 0,
      hidden: () => shown >= 2,
    });
    expect(outcome).toBe("applied");
    expect(shown).toBe(2);
    expect(store.getState().document.items).toEqual(["a", "b", "c", "d"]);
    store.getState().undo();
    expect(store.getState().document.items).toEqual([]);
  });

  it("applies a whole batch as one undo step while the cursor visits each target", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    const presence = createAgentPresence();
    const labels: string[] = [];
    const outcome = await replaySteps(base, steps(base, ["a", "b", "c"]), {
      store,
      presence,
      locate: () => ({ point: { x: 1, y: 2 }, outline: null }),
      label: (step) => {
        labels.push(step.label);
        return step.label;
      },
      delayMs: 0,
    });
    expect(outcome).toBe("applied");
    expect(store.getState().document.items).toEqual(["a", "b", "c"]);
    expect(labels).toEqual(["a", "b", "c"]);
    store.getState().undo();
    expect(store.getState().document.items).toEqual([]);
    expect(presence.store.getState().busy).toBe(false);
  });

  it("applies a batch as one quiet change while the person is watching, without moving the cursor or selecting", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    const presence = createAgentPresence();
    const changes: Doc[] = [];
    store.subscribe((state, previous) => {
      if (state.document !== previous.document) changes.push(state.document);
    });
    let visited = 0;
    let located = 0;
    const started = Date.now();
    const outcome = await replaySteps(base, steps(base, ["a", "b", "c"]), {
      store,
      presence,
      locate: () => {
        located += 1;
        return { point: { x: 1, y: 2 }, outline: null };
      },
      label: (step) => step.label,
      onStep: () => {
        visited += 1;
      },
      delayMs: 400,
      quiet: true,
    });
    expect(outcome).toBe("applied");
    expect(changes.map((doc) => doc.items)).toEqual([["a", "b", "c"]]);
    expect(visited).toBe(0);
    expect(located).toBe(0);
    expect(Date.now() - started).toBeLessThan(300);
    store.getState().undo();
    expect(store.getState().document.items).toEqual([]);
  });

  it("does nothing when the person changed the project after Elo planned", async () => {
    const base: Doc = { items: [] };
    const store = createStudioStore(base);
    store.getState().apply(() => ({ items: ["mine"] }));
    const outcome = await replaySteps(base, steps(base, ["a"]), { store, presence: createAgentPresence(), locate: () => null, label: () => "", delayMs: 0 });
    expect(outcome).toBe("interrupted");
    expect(store.getState().document.items).toEqual(["mine"]);
  });
});

describe("stepDelay", () => {
  it("keeps a batch near a couple of seconds and respects reduced motion", () => {
    expect(stepDelay(1, false)).toBe(420);
    expect(stepDelay(40, false)).toBe(120);
    expect(stepDelay(10, true)).toBe(0);
  });
});
