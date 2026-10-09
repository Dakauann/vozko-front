import { describe, expect, it } from "vitest";

import { firstInvalidStep, parseOperations, planBatch, type AgentOutcome, type AgentStep } from "./batch";

interface Counter {
  value: number;
  items: string[];
}

type Op = { op: string; ref?: string; target?: string; targets?: string[]; item_id?: string; item_ids?: string[]; amount?: number; [key: string]: unknown };

function apply(doc: Counter, op: Op): AgentOutcome<Counter> {
  if (op.op === "add") {
    const id = `item-${doc.items.length + 1}`;
    return { ok: true, document: { value: doc.value, items: [...doc.items, id] }, created: [id], focus: { kind: "time", atMs: 0 }, label: "add" };
  }
  if (op.op === "bump") {
    if (op.target && !doc.items.includes(op.target)) return { ok: false, reason: `o item ${op.target} não existe` };
    return { ok: true, document: { ...doc, value: doc.value + (op.amount ?? 1) }, focus: { kind: "time", atMs: 0 }, label: "bump" };
  }
  return { ok: false, reason: "desconhecida" };
}

describe("planBatch", () => {
  it("applies operations in order and remembers what each one created by its ref", () => {
    const plan = planBatch<Counter, Op>({ value: 0, items: [] }, [{ op: "add", ref: "a" }, { op: "bump", target: "@a", amount: 2 }], apply, ["target", "targets"]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.steps).toHaveLength(2);
    expect(plan.final).toEqual({ value: 2, items: ["item-1"] });
    expect(plan.created).toEqual({ a: ["item-1"] });
  });

  it("applies nothing when any operation fails and names the one that did", () => {
    const plan = planBatch<Counter, Op>({ value: 0, items: [] }, [{ op: "bump" }, { op: "bump", target: "missing" }], apply, ["target"]);
    expect(plan).toMatchObject({ ok: false, index: 1, op: "bump", reason: "o item missing não existe" });
  });

  it("reports every failing operation at once and skips the ones that depend on them", () => {
    const plan = planBatch<Counter, Op>(
      { value: 0, items: [] },
      [
        { op: "add", ref: "a" },
        { op: "bump", target: "missing" },
        { op: "nope", ref: "b" },
        { op: "bump", target: "@b" },
        { op: "bump", target: "@a" },
        { op: "bump", target: "also-missing" },
      ],
      apply,
      ["target"],
    );
    expect(plan).toMatchObject({ ok: false, index: 1, failures: [{ index: 1, op: "bump" }, { index: 2, op: "nope" }, { index: 5, op: "bump" }], skipped: [3] });
  });

  it("turns an executor crash into a failure of that operation", () => {
    const crash = (doc: Counter, op: Op): AgentOutcome<Counter> => {
      if (op.op === "boom") throw new Error("read only");
      return apply(doc, op);
    };
    const plan = planBatch<Counter, Op>({ value: 0, items: [] }, [{ op: "add" }, { op: "boom" }], crash, []);
    expect(plan).toMatchObject({ ok: false, index: 1, op: "boom" });
    if (!plan.ok) expect(plan.reason).toContain("read only");
  });

  it("treats blank padding as absent and a single id in the plural field as the target", () => {
    const seen: Op[] = [];
    const record = (doc: Counter, op: Op): AgentOutcome<Counter> => {
      seen.push(op);
      return apply(doc, op);
    };
    planBatch<Counter, Op>(
      { value: 0, items: [] },
      [
        { op: "add", ref: "a" },
        { op: "bump", target: "", targets: [], amount: undefined, label: null, style: {}, nested: { a: "", b: null }, keys: [] },
        { op: "bump", item_ids: ["@a"] },
      ],
      record,
      ["target", "targets", "item_id", "item_ids"],
    );
    expect(seen[1]).toEqual({ op: "bump", keys: [] });
    expect(seen[2]).toEqual({ op: "bump", item_id: "item-1", item_ids: ["item-1"] });
  });

  it("refuses a ref that was never created earlier in the batch", () => {
    const plan = planBatch<Counter, Op>({ value: 0, items: [] }, [{ op: "bump", target: "@later" }, { op: "add", ref: "later" }], apply, ["target"]);
    expect(plan).toMatchObject({ ok: false, index: 0 });
    if (plan.ok) return;
    expect(plan.reason).toContain("@later");
  });

  it("resolves refs inside id lists too", () => {
    const seen: string[][] = [];
    const record = (doc: Counter, op: Op): AgentOutcome<Counter> => {
      if (op.targets) seen.push(op.targets);
      return apply(doc, op);
    };
    planBatch<Counter, Op>({ value: 0, items: [] }, [{ op: "add", ref: "a" }, { op: "bump", targets: ["@a", "plain"] }], record, ["targets"]);
    expect(seen).toEqual([["item-1", "plain"]]);
  });

  it("refuses a ref used twice, so later operations cannot silently retarget", () => {
    const plan = planBatch<Counter, Op>({ value: 0, items: [] }, [{ op: "add", ref: "a" }, { op: "add", ref: "a" }], apply, []);
    expect(plan).toMatchObject({ ok: false, index: 1 });
  });
});

describe("parseOperations", () => {
  const allowed = ["add_text", "seek"] as const;

  it("accepts a list of known operations", () => {
    expect(parseOperations({ operations: [{ op: "seek", at_ms: 0 }] }, allowed)).toEqual({ ok: true, operations: [{ op: "seek", at_ms: 0 }] });
  });

  it("refuses anything else before touching the document", () => {
    expect(parseOperations(null, allowed).ok).toBe(false);
    expect(parseOperations({ operations: [] }, allowed).ok).toBe(false);
    expect(parseOperations({ operations: [{ op: "export" }] }, allowed).ok).toBe(false);
    expect(parseOperations({ operations: ["seek"] }, allowed).ok).toBe(false);
    expect(parseOperations({ operations: Array.from({ length: 41 }, () => ({ op: "seek" })) }, allowed).ok).toBe(false);
  });
});

describe("firstInvalidStep", () => {
  it("names the first operation whose result breaks the document", () => {
    const steps: AgentStep<number>[] = [1, 2, 9, 3].map((document) => ({ document, focus: { kind: "canvas" }, label: "x" }));
    const check = (doc: number) => (doc < 5 ? ({ ok: true } as const) : ({ ok: false, issue: { field: "value", code: "out_of_range" } } as const));
    expect(firstInvalidStep(steps, check)).toEqual({ index: 2, issue: { field: "value", code: "out_of_range" } });
    expect(firstInvalidStep(steps.slice(0, 2), check)).toBeNull();
  });
});

describe("id resolution", () => {
  const known = (doc: Counter) => doc.items;

  it("reads a bare ref name and a unique id prefix, and says so", () => {
    const seen: Op[] = [];
    const record = (doc: Counter, op: Op): AgentOutcome<Counter> => {
      seen.push(op);
      return apply(doc, op);
    };
    const base = { value: 0, items: ["layer-abcdef123", "layer-zzz999"] };
    const plan = planBatch<Counter, Op>(base, [{ op: "add", ref: "titulo" }, { op: "bump", target: "titulo" }, { op: "bump", target: "layer-abcdef" }], record, ["target"], known);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(seen[1].target).toBe("item-3");
    expect(seen[2].target).toBe("layer-abcdef123");
    expect(plan.notes.join(" ")).toContain("@titulo");
    expect(plan.notes.join(" ")).toContain("layer-abcdef123");
  });

  it("never guesses between two candidates", () => {
    const base = { value: 0, items: ["layer-abcdef1", "layer-abcdef2"] };
    const plan = planBatch<Counter, Op>(base, [{ op: "bump", target: "layer-abcdef" }], apply, ["target"], known);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("layer-abcdef1, layer-abcdef2");
  });
});
