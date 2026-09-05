/**
 * The CRM console's geometry, kept out of the scene so it can be checked by
 * arithmetic instead of by eye. Every offset here is measured from the panel it
 * belongs to, never from the stage origin: the wide layout happens to put all
 * three panels on y=0, which hides the difference, and the portrait layout does
 * not, which is where it showed up as rows floating outside their own inbox.
 *
 * `crmBoxes` returns every element as a flat rectangle in stage coordinates, so
 * `crm-layout.test.ts` can assert containment and non-overlap for both layouts.
 */

export type Size3 = [number, number, number];
export type Point = [number, number];
export type Panel = { at: Point; size: Size3 };

export type CrmLayout = {
  inbox: Panel;
  thread: Panel;
  details: Panel;
  /** A conversation row in the inbox list. */
  row: Size3;
  rowGap: number;
  /** First row, measured DOWN from the inbox's top edge. */
  rowTop: number;
  visibleRows: number;
  /** Thread contents, measured down from the thread's top edge. */
  threadRows: { header: number; first: number; second: number; third: number };
  /** The composer, measured UP from the thread's bottom edge. */
  composer: number;
  /** Record contents, measured down from the details panel's top edge. */
  detailRows: { title: number; stage: number; tags: number };
  /** The owner block, measured up from the details panel's bottom edge. */
  owner: number;
  tag: Size3;
  /** Portrait puts the two tags beside each other; wide stacks them. */
  tagsInARow: boolean;
  tagStep: number;
  extent: Point;
};

export const CRM_WIDE: CrmLayout = {
  inbox: { at: [-3.95, 0], size: [3.0, 5.6, 0.26] },
  thread: { at: [-0.3, 0], size: [3.7, 5.6, 0.3] },
  details: { at: [3.5, 0], size: [2.5, 5.6, 0.26] },
  row: [2.7, 0.8, 0.16],
  rowGap: 0.94,
  rowTop: 1.08,
  visibleRows: 5,
  threadRows: { header: 0.44, first: 1.5, second: 2.5, third: 3.5 },
  composer: 0.42,
  detailRows: { title: 0.34, stage: 1.05, tags: 1.9 },
  owner: 0.72,
  tag: [1.5, 0.34, 0.1],
  tagsInARow: false,
  tagStep: 0.52,
  extent: [10.6, 6.2],
};

export const CRM_COMPACT: CrmLayout = {
  // On phones the conversation gets the full width. The inbox and contact
  // record sit beneath it, keeping the scene short enough for readable type.
  inbox: { at: [-1.8, -1.95], size: [3.3, 3.5, 0.22] },
  thread: { at: [0, 1.85], size: [6.9, 3.5, 0.26] },
  details: { at: [1.8, -1.95], size: [3.3, 3.5, 0.22] },
  row: [3.0, 0.9, 0.14],
  rowGap: 1.04,
  rowTop: 0.9,
  visibleRows: 2,
  threadRows: { header: 0.4, first: 1.05, second: 1.7, third: 2.35 },
  composer: 0.36,
  detailRows: { title: 0.3, stage: 0.9, tags: 1.5 },
  owner: 0.45,
  tag: [2.5, 0.32, 0.1],
  tagsInARow: false,
  tagStep: 0.45,
  extent: [7.3, 7.7],
};

const halfH = (panel: Panel) => panel.size[1] / 2;

/** A conversation row's centre, in stage coordinates. */
export function rowAt(layout: CrmLayout, index: number): Point {
  return [layout.inbox.at[0], layout.inbox.at[1] + halfH(layout.inbox) - layout.rowTop - index * layout.rowGap];
}

/** Where a row starts before it slides into the queue. */
export function rowEntryX(layout: CrmLayout): number {
  return layout.inbox.at[0] - 2.2;
}

/** A y inside the thread, from an offset measured down from its top edge. */
export function threadY(layout: CrmLayout, down: number): number {
  return layout.thread.at[1] + halfH(layout.thread) - down;
}

export function composerY(layout: CrmLayout): number {
  return layout.thread.at[1] - halfH(layout.thread) + layout.composer;
}

/** A y inside the details panel, from an offset measured down from its top edge. */
export function detailY(layout: CrmLayout, down: number): number {
  return layout.details.at[1] + halfH(layout.details) - down;
}

export function ownerY(layout: CrmLayout): number {
  return layout.details.at[1] - halfH(layout.details) + layout.owner;
}

/** Where a tag comes to rest on the record, once it has been filed. */
export function tagAt(layout: CrmLayout, index: number, total: number): Point {
  const top = detailY(layout, layout.detailRows.tags) - 0.3;
  if (!layout.tagsInARow) return [layout.details.at[0], top - index * layout.tagStep];
  return [layout.details.at[0] + (index - (total - 1) / 2) * layout.tagStep, top];
}

/** Where a tag starts: on the open conversation, before it is filed. */
export function tagFrom(layout: CrmLayout): Point {
  return [layout.thread.at[0], threadY(layout, layout.threadRows.second)];
}

export type Box = { name: string; x: number; y: number; w: number; h: number };

const box = (name: string, at: Point, w: number, h: number): Box => ({ name, x: at[0], y: at[1], w, h });

/**
 * Every element of the scene as a flat rectangle. Text blocks are given the
 * height their rendered line box occupies at the scene's own scale, which is
 * what makes a "label overlaps a chip" assertion meaningful.
 */
export function crmBoxes(layout: CrmLayout, tags: number) {
  const lineH = 0.26;
  const twoLineH = 0.44;
  const bubbleH = 0.42;

  const panels: Box[] = [
    box("inbox", layout.inbox.at, layout.inbox.size[0], layout.inbox.size[1]),
    box("thread", layout.thread.at, layout.thread.size[0], layout.thread.size[1]),
    box("details", layout.details.at, layout.details.size[0], layout.details.size[1]),
  ];

  const inboxHeader: Box = box(
    "inbox.header",
    [layout.inbox.at[0], layout.inbox.at[1] + halfH(layout.inbox) - 0.28],
    layout.inbox.size[0] - 0.4,
    lineH,
  );
  const rows: Box[] = Array.from({ length: layout.visibleRows }, (_, index) =>
    box(`row.${index}`, rowAt(layout, index), layout.row[0], layout.row[1]),
  );

  const threadParts: Box[] = [
    box("thread.header", [layout.thread.at[0], threadY(layout, layout.threadRows.header)], layout.thread.size[0] - 0.4, twoLineH),
    box("thread.customer", [layout.thread.at[0], threadY(layout, layout.threadRows.first)], layout.thread.size[0] - 0.5, bubbleH),
    box("thread.ai", [layout.thread.at[0], threadY(layout, layout.threadRows.second)], layout.thread.size[0] - 0.5, bubbleH),
    box("thread.human", [layout.thread.at[0], threadY(layout, layout.threadRows.third)], layout.thread.size[0] - 0.5, bubbleH),
    box("thread.composer", [layout.thread.at[0], composerY(layout)], layout.thread.size[0] - 0.4, 0.4),
  ];

  const detailParts: Box[] = [
    box("details.title", [layout.details.at[0], detailY(layout, layout.detailRows.title)], layout.details.size[0] - 0.3, lineH),
    box("details.stage", [layout.details.at[0], detailY(layout, layout.detailRows.stage)], layout.details.size[0] - 0.3, twoLineH),
    box("details.tags", [layout.details.at[0], detailY(layout, layout.detailRows.tags)], layout.details.size[0] - 0.3, lineH),
    box("details.owner", [layout.details.at[0], ownerY(layout)], layout.details.size[0] - 0.3, twoLineH),
    ...Array.from({ length: tags }, (_, index) => box(`tag.${index}`, tagAt(layout, index, tags), layout.tag[0], layout.tag[1])),
  ];

  return { panels, inboxHeader, rows, threadParts, detailParts };
}

export const left = (b: Box) => b.x - b.w / 2;
export const right = (b: Box) => b.x + b.w / 2;
export const bottom = (b: Box) => b.y - b.h / 2;
export const top = (b: Box) => b.y + b.h / 2;

/** True when `inner` sits entirely within `outer`, allowing a hair of slack. */
export function contains(outer: Box, inner: Box, slack = 0.001) {
  return (
    left(inner) >= left(outer) - slack &&
    right(inner) <= right(outer) + slack &&
    bottom(inner) >= bottom(outer) - slack &&
    top(inner) <= top(outer) + slack
  );
}

/** Overlap in both axes at once, which is the only kind that shows on screen. */
export function overlaps(a: Box, b: Box, slack = 0.001) {
  return (
    left(a) < right(b) - slack && right(a) > left(b) + slack && bottom(a) < top(b) - slack && top(a) > bottom(b) + slack
  );
}
