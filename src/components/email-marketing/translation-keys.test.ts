import { readdirSync, readFileSync } from "fs";
import { join, relative, sep } from "path";
import { describe, expect, it } from "vitest";

import pt from "@/i18n/messages/pt.json";
import { flattenCatalog } from "@/test/message-catalog";
import { literalTranslationUsages } from "@/test/translation-usages";

const SRC = join(__dirname, "..", "..");
const DASHBOARD = join(SRC, "app", "[locale]", "dashboard");
const SCANNED_DIRS = [join(SRC, "components", "email-marketing"), join(DASHBOARD, "email", "senders"), join(DASHBOARD, "admin", "email")];
const SCANNED_FILES = [join(DASHBOARD, "email", "page.tsx")];
const LEAVES = new Set(flattenCatalog(pt).keys());

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => join(dir, file));
}

describe("email marketing translation keys", () => {
  const files = [...SCANNED_DIRS.flatMap(sourceFiles), ...SCANNED_FILES];
  const usages = files.flatMap((file) =>
    literalTranslationUsages(readFileSync(file, "utf8")).map((usage) => ({ ...usage, where: `${relative(SRC, file).split(sep).join("/")}:${usage.line}` })),
  );

  it("finds the literal keys the email screens use", () => {
    expect(usages.length).toBeGreaterThan(150);
  });

  it("has every literal key in pt.json", () => {
    expect(usages.filter((usage) => !LEAVES.has(usage.key)).map((usage) => `${usage.where} ${usage.key}`)).toEqual([]);
  });
});
