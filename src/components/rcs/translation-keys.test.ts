import { readdirSync, readFileSync } from "fs";
import { join, relative, sep } from "path";
import { describe, expect, it } from "vitest";

import pt from "@/i18n/messages/pt.json";
import { flattenCatalog } from "@/test/message-catalog";
import { literalTranslationUsages } from "@/test/translation-usages";

const ROOT = join(__dirname, "..");
const SCANNED = [join(ROOT, "rcs"), join(ROOT, "sms")];
const LEAVES = new Set(flattenCatalog(pt).keys());

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => join(dir, file));
}

describe("rcs and sms component translation keys", () => {
  const usages = SCANNED.flatMap(sourceFiles).flatMap((file) =>
    literalTranslationUsages(readFileSync(file, "utf8")).map((usage) => ({ ...usage, where: `${relative(ROOT, file).split(sep).join("/")}:${usage.line}` })),
  );

  it("finds the literal keys the components use", () => {
    expect(usages.length).toBeGreaterThan(180);
  });

  it("has every literal key in pt.json", () => {
    expect(usages.filter((usage) => !LEAVES.has(usage.key)).map((usage) => `${usage.where} ${usage.key}`)).toEqual([]);
  });
});
