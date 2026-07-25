// Pure matching logic for the canvas node search (Ctrl+F). Kept free of React /
// React Flow imports so it is unit-testable in isolation.

export interface SearchableNode {
  id: string;
  label?: string;
  nodeType: string;
  config?: Record<string, unknown>;
}

// All searchable text for a node: its id, label, type, and every string / number
// / boolean leaf in its config (deep), joined and lowercased for a cheap
// case-insensitive "includes" match. This is what lets a user type an email,
// phone, url, or any value they configured and land on the node that holds it.
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
  // Separator that cannot appear in the query, so matches never span two fields.
  return parts.join("  ").toLowerCase();
}

export interface MatchOptions {
  /** Restrict matches to a single node type (exact). Null/undefined = any type. */
  type?: string | null;
}

// Ids of every node that matches, in input order. A node matches when it is of
// the requested type (if a type filter is set) AND its searchable text contains
// the query (if a query is given). With neither a query nor a type, nothing
// matches and the caller clears the highlight. A type filter alone returns every
// node of that type, so a user can highlight "all e-mail nodes" with one pick.
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
