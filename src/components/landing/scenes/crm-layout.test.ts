import { describe, expect, it } from "vitest";

import {
  CRM_COMPACT,
  CRM_WIDE,
  type Box,
  type CrmLayout,
  contains,
  crmBoxes,
  overlaps,
  bottom,
  left,
  right,
  top,
} from "./crm-layout";

/**
 * The CRM scene is laid out by hand in world units, so nothing but arithmetic
 * can tell us an element left its panel or landed on its neighbour. Both of
 * those shipped once: rows animated to an absolute x instead of the inbox's,
 * and every internal offset was measured from the stage origin, which only
 * works while a panel happens to sit on y=0.
 */
const TAGS = 2;
const LAYOUTS: Array<[string, CrmLayout]> = [
  ["wide", CRM_WIDE],
  ["portrait", CRM_COMPACT],
];

function pairs<T>(items: T[]): Array<[T, T]> {
  const out: Array<[T, T]> = [];
  for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) out.push([items[i], items[j]]);
  return out;
}

const describeBox = (b: Box) =>
  `${b.name} x[${left(b).toFixed(2)}, ${right(b).toFixed(2)}] y[${bottom(b).toFixed(2)}, ${top(b).toFixed(2)}]`;

describe.each(LAYOUTS)("CRM console geometry (%s)", (_name, layout) => {
  const { panels, inboxHeader, rows, threadParts, detailParts } = crmBoxes(layout, TAGS);
  const [inbox, thread, details] = panels;

  it("keeps the three panels apart", () => {
    for (const [a, b] of pairs(panels)) {
      expect(overlaps(a, b), `${describeBox(a)} overlaps ${describeBox(b)}`).toBe(false);
    }
  });

  it("keeps every conversation row inside the inbox", () => {
    for (const row of rows) {
      expect(contains(inbox, row), `${describeBox(row)} escapes ${describeBox(inbox)}`).toBe(true);
    }
  });

  it("keeps the rows clear of each other and of the inbox header", () => {
    for (const [a, b] of pairs(rows)) {
      expect(overlaps(a, b), `${describeBox(a)} overlaps ${describeBox(b)}`).toBe(false);
    }
    for (const row of rows) {
      expect(overlaps(row, inboxHeader), `${describeBox(row)} overlaps ${describeBox(inboxHeader)}`).toBe(false);
    }
  });

  it("keeps the thread's contents inside the thread", () => {
    for (const part of threadParts) {
      expect(contains(thread, part), `${describeBox(part)} escapes ${describeBox(thread)}`).toBe(true);
    }
  });

  it("stacks the thread without collisions", () => {
    for (const [a, b] of pairs(threadParts)) {
      expect(overlaps(a, b), `${describeBox(a)} overlaps ${describeBox(b)}`).toBe(false);
    }
  });

  it("keeps the record's contents inside the details panel", () => {
    for (const part of detailParts) {
      expect(contains(details, part), `${describeBox(part)} escapes ${describeBox(details)}`).toBe(true);
    }
  });

  it("stacks the record without collisions", () => {
    for (const [a, b] of pairs(detailParts)) {
      expect(overlaps(a, b), `${describeBox(a)} overlaps ${describeBox(b)}`).toBe(false);
    }
  });

  it("fits inside the extent the scene is scaled against", () => {
    const all = [...panels, inboxHeader, ...rows, ...threadParts, ...detailParts];
    const width = Math.max(...all.map(right)) - Math.min(...all.map(left));
    const height = Math.max(...all.map(top)) - Math.min(...all.map(bottom));
    expect(width, `content is ${width.toFixed(2)} wide, extent says ${layout.extent[0]}`).toBeLessThanOrEqual(layout.extent[0]);
    expect(height, `content is ${height.toFixed(2)} tall, extent says ${layout.extent[1]}`).toBeLessThanOrEqual(layout.extent[1]);
  });

  it("does not waste more than a unit of the extent it claims", () => {
    const all = [...panels, inboxHeader, ...rows, ...threadParts, ...detailParts];
    const width = Math.max(...all.map(right)) - Math.min(...all.map(left));
    const height = Math.max(...all.map(top)) - Math.min(...all.map(bottom));
    expect(layout.extent[0] - width).toBeLessThanOrEqual(1);
    expect(layout.extent[1] - height).toBeLessThanOrEqual(1);
  });
});
