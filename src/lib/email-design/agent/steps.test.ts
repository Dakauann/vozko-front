import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { duplicateBlock, findBlock, footerIndex, insertBlock, moveBlock, removeBlock, setColumnsRatio, updateBlock, updateSettings, type Position } from "../document";
import type { Block, ColumnRatio, Document, Settings } from "../types";
import { editPayloadOf, stepDocuments, type StepPatch } from "./steps";

interface Placement {
  after?: string;
  before?: string;
  into?: string;
  column?: number;
}

interface Operation {
  op: string;
  id?: string;
  kind?: string;
  fields?: Record<string, unknown>;
  at?: Placement;
}

interface ContractCase {
  name: string;
  operations: Operation[];
  created?: string[];
  final?: Document;
  steps?: StepPatch[];
  refusal?: { index: number; code: string };
}

const fixture = JSON.parse(readFileSync(resolve(process.cwd(), "../vozko-back/domain/emaildesign/testdata/edit_contract.json"), "utf8")) as { base: Document; cases: ContractCase[] };

const same = (a: unknown, b: unknown) => expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)));

function positionOf(doc: Document, at: Placement | undefined): Position {
  if (!at) return { container: { kind: "root" }, index: Math.max(0, footerIndex(doc)) };
  if (at.into) return { container: { kind: "column", columnsId: at.into, column: at.column ?? 0 }, index: Number.MAX_SAFE_INTEGER };
  const anchor = findBlock(doc, at.after ?? at.before ?? "");
  if (!anchor) throw new Error("the fixture anchors on a block that does not exist");
  return { container: anchor.position.container, index: anchor.position.index + (at.after ? 1 : 0) };
}

function withIdsOf(copy: Block, original: Block): Block {
  if (copy.kind !== "columns" || original.kind !== "columns") return { ...copy, id: original.id };
  const columns = copy.columns.columns.map((column, c) => ({ blocks: column.blocks.map((child, i) => withIdsOf(child, original.columns.columns[c].blocks[i])) }));
  return { ...copy, id: original.id, columns: { ...copy.columns, columns } } as Block;
}

function blockIn(doc: Document, id: string | null): Block {
  const found = id ? findBlock(doc, id) : null;
  if (!found) throw new Error(`the step does not hold ${id}`);
  return found.block;
}

function manual(previous: Document, op: Operation, next: Document, focus: string | null): Document | null {
  switch (op.op) {
    case "add":
      return insertBlock(previous, blockIn(next, focus), positionOf(previous, op.at));
    case "move":
      return moveBlock(previous, op.id ?? "", positionOf(previous, op.at));
    case "remove":
      return removeBlock(previous, op.id ?? "");
    case "duplicate": {
      const result = duplicateBlock(previous, op.id ?? "");
      const copied = blockIn(result.document, result.id);
      return updateBlock(result.document, copied.id, (block) => withIdsOf(block, blockIn(next, focus)));
    }
    case "settings":
      return updateSettings(previous, op.fields as Partial<Settings>);
    case "set": {
      const ratio = op.fields?.ratio as ColumnRatio | undefined;
      if (!ratio || !op.id) return null;
      const target = blockIn(next, op.id);
      return updateBlock(setColumnsRatio(previous, op.id, ratio), op.id, (block) => ({ ...block, background_color: target.background_color }));
    }
  }
  return null;
}

const applied = fixture.cases.filter((c) => c.steps);

describe("the email edit contract shared with the Go executor", () => {
  it("covers both applied batches and refusals", () => {
    expect(applied.length).toBeGreaterThan(3);
    expect(fixture.cases.some((c) => c.refusal)).toBe(true);
  });

  it.each(applied.map((c) => [c.name, c] as const))("rebuilds every step of %s from the compact patches", (_name, c) => {
    const payload = editPayloadOf({ base: fixture.base, steps: c.steps });
    expect(payload).not.toBeNull();
    const steps = stepDocuments(payload!);
    expect(steps).toHaveLength(c.operations.length);
    same(steps.at(-1)!.document, c.final);
  });

  it.each(applied.map((c) => [c.name, c] as const))("reaches the same structure as the manual editor for %s", (_name, c) => {
    const steps = stepDocuments(editPayloadOf({ base: fixture.base, steps: c.steps })!);
    let previous = fixture.base;
    steps.forEach((step, index) => {
      const expected = manual(previous, c.operations[index], step.document, step.focus);
      if (expected) same(expected, step.document);
      previous = step.document;
    });
  });

  it("keeps the blocks a step did not touch as the same objects", () => {
    const steps = stepDocuments(editPayloadOf({ base: fixture.base, steps: applied[0].steps })!);
    const untouched = fixture.base.blocks.find((block) => block.id === "footer");
    expect(steps[0].document.blocks.find((block) => block.id === "footer")).toBe(untouched);
  });

  it("refuses payloads that are not an edit", () => {
    expect(editPayloadOf(null)).toBeNull();
    expect(editPayloadOf({ base: fixture.base })).toBeNull();
    expect(editPayloadOf({ base: { blocks: [] }, steps: [] })).toBeNull();
    expect(editPayloadOf({ base: fixture.base, steps: [{ op: "add", order: ["ghost"] }] })).toBeNull();
  });
});
