export type Catalog = Record<string, unknown>;

export function flattenCatalog(node: unknown, prefix = ""): Map<string, unknown> {
  const entries = new Map<string, unknown>();
  const visit = (value: unknown, path: string) => {
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        visit(child, path ? `${path}.${key}` : key);
      }
      return;
    }
    entries.set(path, value);
  };
  visit(node, prefix);
  return entries;
}

const NESTED_TYPES = new Set(["plural", "select", "selectordinal"]);

function closingBrace(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (char === "'" && (text[index + 1] === "{" || text[index + 1] === "}")) {
      const end = text.indexOf("'", index + 1);
      if (end === -1) return -1;
      index = end;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function blocks(text: string): string[] {
  const found: string[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "'" && text[index + 1] === "'") {
      index += 1;
      continue;
    }
    if (char === "'" && (text[index + 1] === "{" || text[index + 1] === "}")) {
      const end = text.indexOf("'", index + 1);
      if (end === -1) break;
      index = end;
      continue;
    }
    if (char !== "{") continue;
    const end = closingBrace(text, index);
    if (end === -1) break;
    found.push(text.slice(index + 1, end));
    index = end;
  }
  return found;
}

export function messageArguments(message: string): string[] {
  const names = new Set<string>();
  const walk = (text: string) => {
    for (const block of blocks(text)) {
      const [rawName, rawType, ...rest] = block.split(",");
      const name = rawName.trim();
      if (/^[A-Za-z_][\w]*$/.test(name)) names.add(name);
      if (rawType && NESTED_TYPES.has(rawType.trim())) blocks(rest.join(",")).forEach(walk);
    }
  };
  walk(message);
  return [...names].sort();
}
