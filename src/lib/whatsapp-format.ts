// Pure parser for WhatsApp-style inline text formatting.
//
// Mirrors how the WhatsApp clients render the literal marker characters that
// arrive in a message body:
//
//   *bold*            -> bold
//   _italic_          -> italic
//   ~strikethrough~   -> strikethrough
//   `inline code`     -> monospace (inline)
//   ```code block```  -> monospace (block, may span lines)
//
// Rules that match WhatsApp's behaviour:
//   - A marker pair only formats when the character immediately inside each
//     delimiter is NOT whitespace, e.g. "*bold*" formats but "* not *" does not.
//     This is what keeps "2 * 3 = 6" and "* bullet" from turning bold.
//   - Markers can nest, e.g. "*_bold italic_*".
//   - Code spans are literal: their contents are never re-parsed.
//   - Unbalanced / unmatched markers are left as plain text.
//
// The parser is intentionally URL-agnostic: callers should extract URLs first
// so that underscores/tildes inside a link are never treated as formatting.

export type FormatTag = "strong" | "em" | "del" | "code" | "pre";

export type FormatNode =
  | { type: "text"; value: string }
  | { type: "element"; tag: FormatTag; children: FormatNode[] };

interface Rule {
  tag: FormatTag;
  // Source pattern (no global flag, we exec a fresh, stateless RegExp).
  pattern: string;
  // Whether the inner content may itself contain formatting.
  recurse: boolean;
}

// Order matters: ``` is tried before `, and on an exact index tie the first
// rule in this list wins.
const RULES: Rule[] = [
  { tag: "pre", pattern: "```([\\s\\S]+?)```", recurse: false },
  { tag: "code", pattern: "`([^`\\n]+?)`", recurse: false },
  // (\S | \S … \S): the first and last inner characters must be non-space.
  { tag: "strong", pattern: "\\*(\\S|\\S[\\s\\S]*?\\S)\\*", recurse: true },
  { tag: "em", pattern: "_(\\S|\\S[\\s\\S]*?\\S)_", recurse: true },
  { tag: "del", pattern: "~(\\S|\\S[\\s\\S]*?\\S)~", recurse: true },
];

export function parseWhatsAppFormat(input: string): FormatNode[] {
  if (!input) return [];

  // Find the rule whose match starts earliest in the string.
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
