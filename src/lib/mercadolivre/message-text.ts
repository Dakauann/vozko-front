import rules from "./message-text-rules.json";

export const MERCADOLIVRE_MAX_MESSAGE_CHARACTERS = 350;

const VARIATION_SELECTOR = "️";
const FIRST_SKIN_TONE = 0x1f3fb;
const LAST_SKIN_TONE = 0x1f3ff;
const LATIN1_LAST = 0xff;
const ASCII_DELETE = 0x7f;
const FIRST_C1_CONTROL = 0x80;
const LAST_C1_CONTROL = 0x9f;
const FIRST_PRINTABLE_ASCII = 0x20;
const ALLOWED_CONTROLS = new Set(["\t", "\n", "\r"]);
const SPACES = new Set([
  "\t", "\n", "\v", "\f", "\r", " ", "\u0085", " ", " ",
  " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ",
  " ", " ", " ", " ", "　",
]);

export type MessageTextError = "empty" | "too_long" | "charset";

export interface OffendingCharacter {
  character: string;
  occurrences: number;
}

export interface MessageTextResult {
  valid: boolean;
  error: MessageTextError | null;
  length: number;
  max: number;
  offending: readonly OffendingCharacter[];
}

interface EmojiTable {
  fitzpatrick: Map<string, boolean>;
  starts: Set<string>;
  longest: number;
}

function buildEmojiTable(): EmojiTable {
  if (rules.maxRunes !== MERCADOLIVRE_MAX_MESSAGE_CHARACTERS || rules.emoji.length === 0) {
    throw new Error("mercadolivre: message text rules disagree with the limit or carry no emoji");
  }
  const table: EmojiTable = { fitzpatrick: new Map(), starts: new Set(), longest: 0 };
  for (const entry of rules.emoji) {
    const key = entry.sequence.split(VARIATION_SELECTOR).join("");
    const points = Array.from(key);
    if (points.length === 0) continue;
    table.fitzpatrick.set(key, entry.fitzpatrick);
    table.starts.add(points[0]);
    table.longest = Math.max(table.longest, points.length);
  }
  return table;
}

let emojiTable: EmojiTable | null = null;

function emojiRules(): EmojiTable {
  emojiTable ??= buildEmojiTable();
  return emojiTable;
}

function skipVariationSelectors(points: readonly string[], at: number): number {
  let next = at;
  while (next < points.length && points[next] === VARIATION_SELECTOR) next++;
  return next;
}

function isSkinTone(point: string): boolean {
  const code = point.codePointAt(0) ?? 0;
  return code >= FIRST_SKIN_TONE && code <= LAST_SKIN_TONE;
}

function matchEmoji(table: EmojiTable, points: readonly string[], at: number): number {
  if (!table.starts.has(points[at])) return 0;
  const collected: string[] = [];
  const ends: number[] = [];
  for (let j = at; j < points.length && collected.length < table.longest; j++) {
    if (points[j] === VARIATION_SELECTOR) {
      if (j === at) return 0;
      continue;
    }
    collected.push(points[j]);
    ends.push(j + 1);
  }
  for (let n = collected.length; n > 0; n--) {
    const fitzpatrick = table.fitzpatrick.get(collected.slice(0, n).join(""));
    if (fitzpatrick === undefined) continue;
    let end = skipVariationSelectors(points, ends[n - 1]);
    if (fitzpatrick && end < points.length && isSkinTone(points[end])) {
      end = skipVariationSelectors(points, end + 1);
    }
    return end - at;
  }
  return 0;
}

function allowedLatin1(point: string): boolean {
  if (ALLOWED_CONTROLS.has(point)) return true;
  if (point.length !== 1) return false;
  const code = point.charCodeAt(0);
  if (code < FIRST_PRINTABLE_ASCII || code === ASCII_DELETE) return false;
  if (code >= FIRST_C1_CONTROL && code <= LAST_C1_CONTROL) return false;
  return code <= LATIN1_LAST;
}

export function offendingMessageCharacters(text: string): OffendingCharacter[] {
  const table = emojiRules();
  const points = Array.from(text);
  const offending = new Map<string, OffendingCharacter>();
  for (let i = 0; i < points.length; ) {
    const matched = matchEmoji(table, points, i);
    if (matched > 0) {
      i += matched;
      continue;
    }
    const point = points[i];
    i++;
    if (allowedLatin1(point)) continue;
    const seen = offending.get(point);
    if (seen) seen.occurrences++;
    else offending.set(point, { character: point, occurrences: 1 });
  }
  return [...offending.values()];
}

function isBlank(points: readonly string[]): boolean {
  return points.every((point) => SPACES.has(point));
}

export function validateMessageText(text: string): MessageTextResult {
  const points = Array.from(text);
  const length = points.length;
  const base = { length, max: MERCADOLIVRE_MAX_MESSAGE_CHARACTERS };
  if (isBlank(points)) return { ...base, valid: false, error: "empty", offending: [] };
  const offending = offendingMessageCharacters(text);
  if (offending.length > 0) return { ...base, valid: false, error: "charset", offending };
  if (length > MERCADOLIVRE_MAX_MESSAGE_CHARACTERS) return { ...base, valid: false, error: "too_long", offending: [] };
  return { ...base, valid: true, error: null, offending: [] };
}
