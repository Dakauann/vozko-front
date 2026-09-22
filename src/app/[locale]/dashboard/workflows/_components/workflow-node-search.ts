
export interface SearchableNode {
  id: string;
  label?: string;
  nodeType: string;
  config?: Record<string, unknown>;
}

export function nodeSearchText(node: SearchableNode): string {
  const parts: string[] = [node.id, node.label ?? "", node.nodeType];
  const walk = (value: unknown) => {
    if (value == null) return;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      parts.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(walk);
    }
  };
  walk(node.config ?? {});
  return parts.join("  ").toLowerCase();
}

export interface MatchOptions {
  type?: string | null;
}

export function matchNodeIds(
  query: string,
  nodes: SearchableNode[],
  opts: MatchOptions = {},
): string[] {
  const q = query.trim().toLowerCase();
  const type = opts.type ?? null;
  if (!q && !type) return [];
  const out: string[] = [];
  for (const node of nodes) {
    if (type && node.nodeType !== type) continue;
    if (q && !nodeSearchText(node).includes(q)) continue;
    out.push(node.id);
  }
  return out;
}
