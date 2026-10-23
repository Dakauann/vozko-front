import { readdirSync, readFileSync } from "fs";
import { join, relative, sep } from "path";
import { describe, expect, it } from "vitest";

import pt from "@/i18n/messages/pt.json";
import { flattenCatalog } from "@/test/message-catalog";
import { literalTranslationUsages } from "@/test/translation-usages";

const ROOT = join(__dirname, "..");
const SCANNED = ["rcs-senders", "sms-senders", "settings", "suppressions", "admin"].map((dir) => join(ROOT, dir));
const LEAVES = new Set(flattenCatalog(pt).keys());

function sourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => join(dir, file));
}

describe("carrier setup and admin page translation keys", () => {
  const usages = SCANNED.flatMap(sourceFiles).flatMap((file) =>
    literalTranslationUsages(readFileSync(file, "utf8")).map((usage) => ({ ...usage, where: `${relative(ROOT, file).split(sep).join("/")}:${usage.line}` })),
  );

  it("finds the literal keys the pages use", () => {
    expect(usages.length).toBeGreaterThan(150);
  });

  it("has every literal key in pt.json", () => {
    expect(usages.filter((usage) => !LEAVES.has(usage.key)).map((usage) => `${usage.where} ${usage.key}`)).toEqual([]);
  });

  it("has the keys built at run time", () => {
    const dynamic = [
      ...["submit", "pause", "resume"].map((kind) => `carrierMessaging.pages.rcsSenders.editor.done.${kind}`),
      ...["save", "pause", "resume", "delete"].map((kind) => `carrierMessaging.pages.smsSenders.done.${kind}`),
      ...["active", "paused"].map((status) => `carrierMessaging.pages.smsSenders.status.${status}`),
      ...["shared", "dedicated"].map((kind) => `carrierMessaging.pages.smsSenders.kinds.${kind}`),
      ...["keyword", "button", "operator"].map((source) => `carrierMessaging.pages.suppressions.sources.${source}`),
      ...["complaints", "opt_out_rate", "unpaid_balance", "manual"].map((reason) => `carrierMessaging.pages.admin.senders.reasons.${reason}`),
    ];
    expect(dynamic.filter((key) => !LEAVES.has(key))).toEqual([]);
  });
});
