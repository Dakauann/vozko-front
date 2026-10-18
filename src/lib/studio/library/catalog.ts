import { searchText } from "../inspector-layout";
import { LIBRARY_ID_PATTERN, LIBRARY_LOCALES, type LibraryEditor, type LibraryItem, type LibraryLabel, type LibraryLocale } from "./model";

export const RECENT_LIMIT = 12;

type Translate = (key: string) => string;

export interface LibraryEntry {
  item: LibraryItem;
  name: string;
}

export function libraryLocale(value: string): LibraryLocale {
  const prefix = value.toLowerCase().split(/[-_]/)[0];
  return (LIBRARY_LOCALES as readonly string[]).includes(prefix) ? (prefix as LibraryLocale) : "pt";
}

export function labelText(label: LibraryLabel, translate: Translate, locale: LibraryLocale): string {
  return "key" in label ? translate(label.key) : label.text[locale];
}

export function itemLabelKey(id: string): string {
  return `studio.library.items.${id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`;
}

export function supports(item: LibraryItem, editor: LibraryEditor): boolean {
  return item.editors.includes(editor);
}

export function idWords(id: string): string[] {
  return id
    .split(/[-_.\s]+/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((word) => word.toLowerCase())
    .filter((word) => word !== "");
}

export function searchTerms(item: LibraryItem, name: string, locale: LibraryLocale): string[] {
  const english = "text" in item.label && locale !== "en" ? [item.label.text.en] : [];
  const englishTags = locale === "en" ? [] : (item.tags?.en ?? []);
  return [name, ...(item.tags?.[locale] ?? []), ...english, ...englishTags, ...idWords(item.id)];
}

interface FoldedTerms {
  name: string;
  terms: string[];
  haystack: string;
}

const PLAIN = /^[a-z0-9 _-]*$/;

function fold(text: string): string {
  return PLAIN.test(text) ? text.trim() : searchText(text);
}

function foldTerms(name: string, terms: readonly string[]): FoldedTerms {
  const folded = terms.map(fold);
  return { name: fold(name), terms: folded, haystack: folded.join(" ") };
}

function rankFolded(wanted: string, tokens: readonly string[], folded: FoldedTerms): number | null {
  if (tokens.length === 0 || !tokens.every((token) => folded.haystack.includes(token))) return null;
  if (folded.name === wanted) return 0;
  if (folded.name.startsWith(wanted)) return 1;
  if (folded.terms.some((term) => term.startsWith(wanted))) return 2;
  return 3;
}

function queryTokens(query: string): { wanted: string; tokens: string[] } {
  const wanted = searchText(query);
  return { wanted, tokens: wanted.split(/\s+/).filter((token) => token !== "") };
}

export function matchRank(query: string, name: string, terms: readonly string[]): number | null {
  const { wanted, tokens } = queryTokens(query);
  return rankFolded(wanted, tokens, foldTerms(name, terms));
}

const foldedCache = new WeakMap<LibraryItem, Map<string, FoldedTerms>>();

function foldedEntry(entry: LibraryEntry, locale: LibraryLocale): FoldedTerms {
  const byLocale = foldedCache.get(entry.item) ?? new Map<string, FoldedTerms>();
  foldedCache.set(entry.item, byLocale);
  const key = `${locale}:${entry.name}`;
  const known = byLocale.get(key);
  if (known) return known;
  const folded = foldTerms(entry.name, searchTerms(entry.item, entry.name, locale));
  byLocale.set(key, folded);
  return folded;
}

export function searchEntries(entries: readonly LibraryEntry[], query: string, locale: LibraryLocale): LibraryEntry[] {
  const { wanted, tokens } = queryTokens(query);
  if (tokens.length === 0) return [];
  const ranked: { entry: LibraryEntry; index: number; rank: number }[] = [];
  entries.forEach((entry, index) => {
    const rank = rankFolded(wanted, tokens, foldedEntry(entry, locale));
    if (rank !== null) ranked.push({ entry, index, rank });
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map((item) => item.entry);
}

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

export function closestIds(target: string, ids: readonly string[], count: number): string[] {
  const wanted = target.trim().toLowerCase();
  return ids
    .map((id, index) => ({ id, index, score: id.includes(wanted) && wanted !== "" ? 0 : distance(wanted, id) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, count)
    .map((ranked) => ranked.id);
}

export function withRecent(ids: readonly string[], id: string): string[] {
  return [id, ...ids.filter((known) => known !== id)].slice(0, RECENT_LIMIT);
}

export function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids = parsed.filter((id): id is string => typeof id === "string" && LIBRARY_ID_PATTERN.test(id));
    return [...new Set(ids)].slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}
