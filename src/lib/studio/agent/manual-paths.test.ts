import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { IMAGE_OPERATIONS } from "./image-ops";
import { ELO_TOOL_PATHS, IMAGE_MANUAL_PATHS, STUDIO_TOOL_PATHS, VIDEO_MANUAL_PATHS, type ManualEntry, type StudioToolEntry } from "./manual-paths";
import { VIDEO_OPERATIONS } from "./video-ops";

const SRC = join(__dirname, "..", "..", "..");
const TOOLS_DIR = join(SRC, "..", "..", "vozko-back", "usecases", "copilot", "copilottools", "studiotools");
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

function problemsOf(name: string, entry: StudioToolEntry | undefined): string[] {
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

function audit(names: readonly string[], registry: Readonly<Record<string, ManualEntry>>): string[] {
  return names.flatMap((name) => problemsOf(name, registry[name]));
}

function goToolNames(): string[] {
  const sources = readdirSync(TOOLS_DIR)
    .filter((file) => file.startsWith("studio_") && file.endsWith(".go") && !file.endsWith("_test.go"))
    .map((file) => readFileSync(join(TOOLS_DIR, file), "utf8"));
  const pattern = /(?:[Dd]efinition\(|name:\s*)"(studio_[a-z_]+)"/g;
  return [...new Set(sources.flatMap((source) => [...source.matchAll(pattern)].map((match) => match[1])))];
}

describe("manual paths for Elo operations", () => {
  it("gives every video operation a manual path a person can find", () => {
    expect(audit(VIDEO_OPERATIONS, VIDEO_MANUAL_PATHS)).toEqual([]);
  });

  it("gives every image operation a manual path a person can find", () => {
    expect(audit(IMAGE_OPERATIONS, IMAGE_MANUAL_PATHS)).toEqual([]);
  });

  it("covers every studio tool Elo has on the server", () => {
    const names = goToolNames();
    expect(names).toEqual(expect.arrayContaining(["studio_export", "studio_listen", "studio_edit_video"]));
    expect(names.flatMap((name) => problemsOf(name, STUDIO_TOOL_PATHS[name]))).toEqual([]);
  });

  it("gives the ad placement look, the new project and the question card a manual path", () => {
    const copilotTools = join(TOOLS_DIR, "..");
    const sources = ["adtools/ad_placement_look_tool.go", "studiotools/new_project_tool.go", "platformtools/ask_user_tool.go"].map((file) => readFileSync(join(copilotTools, file), "utf8")).join("\n");
    for (const name of Object.keys(ELO_TOOL_PATHS)) {
      expect(sources, name).toContain(`Definition("${name}"`);
    }
    expect(Object.keys(ELO_TOOL_PATHS).flatMap((name) => problemsOf(name, ELO_TOOL_PATHS[name]))).toEqual([]);
  });

  it("registers no operation Elo does not have", () => {
    const known = new Set<string>([...VIDEO_OPERATIONS, ...IMAGE_OPERATIONS]);
    expect([...Object.keys(VIDEO_MANUAL_PATHS), ...Object.keys(IMAGE_MANUAL_PATHS)].filter((name) => !known.has(name))).toEqual([]);
  });
});
