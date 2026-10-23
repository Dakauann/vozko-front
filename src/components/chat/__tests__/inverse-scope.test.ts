import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { CHAT_OWN_CONTENT } from "../chat-styles";

const stylesheet = readFileSync(resolve(__dirname, "../../../app/globals.css"), "utf8");

function selectorsDeclaring(token: string, value: string): string[] {
  const selectors: string[] = [];
  const blocks = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of stylesheet.matchAll(blocks)) {
    if (new RegExp(String.raw`${token}:\s*${value};`).test(match[2])) selectors.push(match[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim());
  }
  return selectors;
}

describe("the inverted palette inside an own graphite bubble", () => {
  it("borrows the dark theme tokens on a light page, so rich content stays readable on graphite", () => {
    expect(selectorsDeclaring("--card", "210 12% 9%")).toContainEqual(expect.stringContaining(":root:not(.dark) .vz-inverse"));
  });

  it("borrows the light theme tokens on a dark page, where the own bubble turns light", () => {
    expect(selectorsDeclaring("--card", "0 0% 100%")).toContainEqual(expect.stringContaining(".dark .vz-inverse"));
  });

  it("is the scope the own bubble content wears", () => {
    expect(CHAT_OWN_CONTENT.split(" ")).toContain("vz-inverse");
  });
});
