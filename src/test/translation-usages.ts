interface TranslationUsage {
  line: number;
  key: string;
  raw: boolean;
}

interface Binding {
  name: string;
  namespace: string;
  at: number;
}

const QUOTED = String.raw`(?:"([^"\\]*)"|'([^'\\]*)'|` + "`([^`$\\\\]*)`)";
const BINDING = new RegExp(
  String.raw`\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*` + `(?:${QUOTED})?` + String.raw`\s*\)(?!\s*\()`,
  "g",
);

function escapeName(name: string): string {
  return name.replace(/\$/g, "\\$");
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function bindingsIn(source: string): Binding[] {
  return [...source.matchAll(BINDING)].map((match) => ({
    name: match[1],
    namespace: match[2] ?? match[3] ?? match[4] ?? "",
    at: match.index ?? 0,
  }));
}

export function literalTranslationUsages(source: string): TranslationUsage[] {
  const bindings = bindingsIn(source);
  const usages: TranslationUsage[] = [];
  for (const name of new Set(bindings.map((binding) => binding.name))) {
    const ownBindings = bindings.filter((binding) => binding.name === name);
    const callee = String.raw`(?<![\w$.])` + escapeName(name) + String.raw`(?:\.(rich|markup|raw))?\(\s*`;
    const single = new RegExp(callee + QUOTED + String.raw`\s*[,)]`, "g");
    const ternary = new RegExp(callee + String.raw`[^()?,;\n]*?\?\s*` + QUOTED + String.raw`\s*:\s*` + QUOTED + String.raw`\s*[,)]`, "g");
    const record = (at: number, method: string | undefined, keys: Array<string | undefined>) => {
      const binding = ownBindings.filter((candidate) => candidate.at < at).at(-1);
      if (!binding) return;
      for (const key of keys) {
        if (!key) continue;
        usages.push({
          line: lineAt(source, at),
          key: binding.namespace ? `${binding.namespace}.${key}` : key,
          raw: method === "raw",
        });
      }
    };
    for (const match of source.matchAll(single)) {
      record(match.index ?? 0, match[1], [match[2] ?? match[3] ?? match[4]]);
    }
    for (const match of source.matchAll(ternary)) {
      record(match.index ?? 0, match[1], [match[2] ?? match[3] ?? match[4], match[5] ?? match[6] ?? match[7]]);
    }
  }
  return usages.sort((a, b) => a.line - b.line || a.key.localeCompare(b.key));
}
