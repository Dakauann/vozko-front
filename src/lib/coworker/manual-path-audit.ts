import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import type { ManualEntry, ToolEntry } from "./manual-paths";

export const SRC = join(__dirname, "..", "..");
const LOCALES = { pt, en, es, de } as const;

function message(messages: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), messages);
}

function readsKey(source: string, key: string): boolean {
  const parts = key.split(".");
  return parts.slice(1).some((_, index) => {
    const namespace = parts.slice(0, index + 1).join(".");
    const rest = parts.slice(index + 1).join(".");
    return source.includes(`useTranslations("${namespace}")`) && (source.includes(`"${rest}"`) || source.includes(`\`${rest}`));
  });
}

export function problemsOf(name: string, entry: ToolEntry | undefined): string[] {
  if (!entry) return [`${name}: no manual path registered`];
  if ("pending" in entry) return entry.pending.trim() === "" ? [`${name}: pending without a reason`] : [];
  if ("perception" in entry) return entry.perception.trim() === "" ? [`${name}: perception without a reason`] : [];
  if (entry.paths.length === 0) return [`${name}: no manual path listed`];
  return entry.paths.flatMap((path) => {
    const file = join(SRC, path.file);
    if (!existsSync(file)) return [`${name}: ${path.file} does not exist`];
    const missing = Object.entries(LOCALES).flatMap(([locale, messages]) => (typeof message(messages, path.control) === "string" ? [] : [`${name}: ${path.control} has no ${locale} text`]));
    const used = readsKey(readFileSync(file, "utf8"), path.control);
    return used ? missing : [...missing, `${name}: ${path.file} never uses ${path.control}`];
  });
}

export function audit(names: readonly string[], registry: Readonly<Record<string, ManualEntry>>): string[] {
  return names.flatMap((name) => problemsOf(name, registry[name]));
}
