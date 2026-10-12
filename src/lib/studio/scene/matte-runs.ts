import { PLAIN_MATTE, type Matte } from "../matte";
import type { SceneNode } from "./scene";

export interface MatteGroup {
  base: string;
  order: number;
  matte: Matte;
}

function sameMatte(a: Matte, b: Matte): boolean {
  return a.channel === b.channel && a.invert === b.invert;
}

export function matteGroups(nodes: readonly SceneNode[]): Map<string, MatteGroup> {
  const groups = new Map<string, MatteGroup>();
  let current: MatteGroup | null = null;
  for (const node of nodes) {
    if (node.source.kind === "effect") continue;
    if (!node.clipOf) {
      current = null;
      continue;
    }
    const matte = node.clipMatte ?? PLAIN_MATTE;
    if (!current || current.base !== node.clipOf || !sameMatte(current.matte, matte)) {
      current = { base: node.clipOf, order: current && current.base === node.clipOf ? current.order + 1 : 0, matte };
    }
    groups.set(node.id, current);
  }
  return groups;
}
