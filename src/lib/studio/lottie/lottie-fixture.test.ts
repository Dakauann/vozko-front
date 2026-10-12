import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseDocument } from "../validate";
import { LOTTIE_CONVERTED_FIXTURES, LOTTIE_FIXTURE_DIR, lottieFixtureJson } from "./lottie-fixture";

const ROOT = join(process.cwd(), "..");

describe("Lottie fixtures shared with the backend", () => {
  it.each(LOTTIE_CONVERTED_FIXTURES.map((name) => [name]))("keeps the expected clips of %s in step with the converter", (name) => {
    const animation = JSON.parse(readFileSync(join(ROOT, LOTTIE_FIXTURE_DIR, `${name}.json`), "utf8"));
    const expected = readFileSync(join(ROOT, LOTTIE_FIXTURE_DIR, `${name}.clips.json`), "utf8").replace(/\r\n/g, "\n");
    expect(lottieFixtureJson(animation, name)).toBe(expected);
    expect(parseDocument("video", JSON.parse(expected)).ok).toBe(true);
  });
});
