import type { SceneNode } from "../scene/scene";

export interface GestureSplit {
  below: number;
  above: number;
}

function blendsWithBackdrop(node: SceneNode): boolean {
  return Boolean(node.blend && node.blend !== "normal");
}

function runStart(nodes: readonly SceneNode[], index: number): number {
  const base = nodes[index].clipOf;
  if (!base) return index;
  for (let i = index - 1; i >= 0; i--) if (nodes[i].id === base) return i;
  return index;
}

function runEnd(nodes: readonly SceneNode[], index: number): number {
  const base = nodes[index].clipOf ?? nodes[index].id;
  let end = index;
  while (end + 1 < nodes.length && nodes[end + 1].clipOf === base) end += 1;
  return end;
}

function sameOrder(nodes: readonly SceneNode[], previous: readonly SceneNode[]): boolean {
  return nodes.length === previous.length && nodes.every((node, i) => node.id === previous[i].id);
}

export function gestureSplit(nodes: readonly SceneNode[], previous: readonly SceneNode[], othersChanged: boolean): GestureSplit | null {
  if (!sameOrder(nodes, previous) || nodes.some((node) => node.source.kind === "effect")) return null;
  const changed = nodes.flatMap((node, index) => (previous[index] === node ? [] : [index]));
  if (changed.length === 0) return othersChanged && nodes.length > 0 ? { below: nodes.length, above: nodes.length } : null;
  const below = runStart(nodes, changed[0]);
  const lastLive = runEnd(nodes, changed[changed.length - 1]);
  const above = nodes.slice(lastLive + 1).some(blendsWithBackdrop) ? nodes.length : lastLive + 1;
  return below === 0 && above === nodes.length ? null : { below, above };
}
