
export type FormatTag = "strong" | "em" | "del" | "code" | "pre";

export type FormatNode =
  | { type: "text"; value: string }
  | { type: "element"; tag: FormatTag; children: FormatNode[] };

interface Rule {
  tag: FormatTag;
  pattern: string;
  recurse: boolean;
}

const RULES: Rule[] = [
  { tag: "pre", pattern: "```([\\s\\S]+?)```", recurse: false },
  { tag: "code", pattern: "`([^`\\n]+?)`", recurse: false },
  { tag: "strong", pattern: "\\*(\\S|\\S[\\s\\S]*?\\S)\\*", recurse: true },
  { tag: "em", pattern: "_(\\S|\\S[\\s\\S]*?\\S)_", recurse: true },
  { tag: "del", pattern: "~(\\S|\\S[\\s\\S]*?\\S)~", recurse: true },
];

export function parseWhatsAppFormat(input: string): FormatNode[] {
  if (!input) return [];

  let earliest: { rule: Rule; match: RegExpExecArray } | null = null;
  for (const rule of RULES) {
    const match = new RegExp(rule.pattern).exec(input);
    if (match && (earliest === null || match.index < earliest.match.index)) {
      earliest = { rule, match };
    }
  }

  if (!earliest) {
    return [{ type: "text", value: input }];
  }

  const { rule, match } = earliest;
  const nodes: FormatNode[] = [];

  const before = input.slice(0, match.index);
  if (before) nodes.push({ type: "text", value: before });

  const inner = match[1];
  nodes.push({
    type: "element",
    tag: rule.tag,
    children: rule.recurse
      ? parseWhatsAppFormat(inner)
      : [{ type: "text", value: inner }],
  });

  const after = input.slice(match.index + match[0].length);
  if (after) nodes.push(...parseWhatsAppFormat(after));

  return nodes;
}
