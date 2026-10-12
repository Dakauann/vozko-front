import { readdirSync, readFileSync } from "fs";
import { join, relative, sep } from "path";
import { describe, expect, it } from "vitest";

import pt from "./messages/pt.json";
import { flattenCatalog } from "@/test/message-catalog";
import { literalTranslationUsages } from "@/test/translation-usages";

const SRC = join(__dirname, "..");
const SCANNED = [join(SRC, "components", "studio"), join(SRC, "components", "ai-chat")];
const LEAVES = new Set(flattenCatalog(pt).keys());
const NODES = new Set([...LEAVES].flatMap((key) => key.split(".").map((_, index, parts) => parts.slice(0, index + 1).join("."))));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.split(sep).includes("__tests__"))
    .map((file) => join(dir, file));
}

function usagesUnder(dirs: string[]) {
  return dirs.flatMap(sourceFiles).flatMap((file) =>
    literalTranslationUsages(readFileSync(file, "utf8")).map((usage) => ({
      ...usage,
      where: `${relative(SRC, file).split(sep).join("/")}:${usage.line}`,
    })),
  );
}

describe("literalTranslationUsages", () => {
  it("joins literal keys to the namespace of the translator they call", () => {
    const source = [
      'const t = useTranslations("studio.video");',
      'const tCommon = useTranslations("common");',
      't("title"); tCommon.rich("save", { b }); t.raw("list");',
    ].join("\n");
    expect(literalTranslationUsages(source)).toEqual([
      { line: 3, key: "common.save", raw: false },
      { line: 3, key: "studio.video.list", raw: true },
      { line: 3, key: "studio.video.title", raw: false },
    ]);
  });

  it("uses the closest translator above the call when a name is declared twice", () => {
    const source = [
      'function A() { const t = useTranslations("a"); return t("one"); }',
      'function B() { const t = useTranslations("b"); return t("two"); }',
    ].join("\n");
    expect(literalTranslationUsages(source).map((usage) => usage.key)).toEqual(["a.one", "b.two"]);
  });

  it("reads both literal branches of a conditional key", () => {
    const source = ['const t = useTranslations("path");', 't(side === "in" ? "handleIn" : "handleOut", { time });'].join("\n");
    expect(literalTranslationUsages(source).map((usage) => usage.key)).toEqual(["path.handleIn", "path.handleOut"]);
  });

  it("skips dynamic keys, dynamic namespaces and guards", () => {
    const source = [
      'const t = useTranslations("a");',
      "const d = useTranslations(namespace);",
      "t(`kind.${kind}`); t(key); t(\"x\" + y); t.has(\"maybe\"); d(\"z\");",
    ].join("\n");
    expect(literalTranslationUsages(source)).toEqual([]);
  });
});

describe("studio and ai-chat translation keys", () => {
  const usages = usagesUnder(SCANNED);

  it("finds the literal keys the components use", () => {
    expect(usages.length).toBeGreaterThan(500);
  });

  it("has every literal key in pt.json", () => {
    const missing = usages
      .filter((usage) => !(usage.raw ? NODES.has(usage.key) : LEAVES.has(usage.key)))
      .map((usage) => `${usage.where} ${usage.key}`);
    expect(missing).toEqual([]);
  });
});
