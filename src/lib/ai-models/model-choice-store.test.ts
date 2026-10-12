import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createModelChoiceStore, readFilterMemory, writeFilterMemory } from "./model-choice-store";

const thinker = { levels: ["low", "medium", "high"] as const, default: "medium" as const };
const deep = { levels: ["high", "max"] as const, default: "high" as const };

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("model choice store", () => {
  it("reads the stored model and level next to each other", () => {
    localStorage.setItem("chat:model", "lab/thinker");
    localStorage.setItem("chat:reasoning", "high");
    const store = createModelChoiceStore("chat");
    expect(store.get()).toEqual({ model: "lab/thinker", reasoning: "high", adjusted: null });
  });

  it("stores a chosen level and model", () => {
    const store = createModelChoiceStore("chat");
    store.chooseModel("lab/thinker", { levels: [...thinker.levels], default: thinker.default });
    store.chooseReasoning("high");
    expect(localStorage.getItem("chat:model")).toBe("lab/thinker");
    expect(localStorage.getItem("chat:reasoning")).toBe("high");
  });

  it("resets a level the new model does not offer and remembers the adjustment until the next choice", () => {
    const store = createModelChoiceStore("chat");
    store.chooseModel("lab/thinker", { levels: [...thinker.levels], default: thinker.default });
    store.chooseReasoning("low");
    store.chooseModel("lab/deep", { levels: [...deep.levels], default: deep.default });
    expect(store.get()).toEqual({ model: "lab/deep", reasoning: "", adjusted: { from: "low", to: "high" } });
    expect(localStorage.getItem("chat:reasoning")).toBe("");
    store.chooseReasoning("max");
    expect(store.get().adjusted).toBeNull();
  });

  it("lets the person acknowledge an adjustment without changing the choice", () => {
    const store = createModelChoiceStore("chat");
    store.chooseModel("lab/thinker", { levels: [...thinker.levels], default: thinker.default });
    store.chooseReasoning("low");
    store.chooseModel("lab/deep", { levels: [...deep.levels], default: deep.default });
    store.acknowledgeAdjustment();
    expect(store.get()).toEqual({ model: "lab/deep", reasoning: "", adjusted: null });
  });

  it("tells subscribers about every change", () => {
    const store = createModelChoiceStore("chat");
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.chooseModel("lab/deep", undefined);
    store.chooseReasoning("high");
    stop();
    store.chooseReasoning("max");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps working when the browser refuses storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const store = createModelChoiceStore("chat");
    expect(store.get()).toEqual({ model: "", reasoning: "", adjusted: null });
    store.chooseModel("lab/deep", undefined);
    expect(store.get().model).toBe("lab/deep");
  });
});

describe("filter memory", () => {
  it("remembers the chosen capability filters per surface", () => {
    writeFilterMemory("elo", ["vision", "free"]);
    expect(readFilterMemory("elo")).toEqual(["vision", "free"]);
    expect(readFilterMemory("workflow-builder")).toEqual([]);
  });

  it("drops unknown or malformed entries", () => {
    localStorage.setItem("ai-models:filters:elo", JSON.stringify(["vision", "telepathy", 3]));
    expect(readFilterMemory("elo")).toEqual(["vision"]);
    localStorage.setItem("ai-models:filters:elo", "{not json");
    expect(readFilterMemory("elo")).toEqual([]);
  });

  it("survives a browser that refuses storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeFilterMemory("elo", ["vision"])).not.toThrow();
    expect(readFilterMemory("elo")).toEqual([]);
  });
});
