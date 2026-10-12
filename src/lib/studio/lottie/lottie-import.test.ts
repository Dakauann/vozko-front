import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { VIDEO_ASPECT_SIZES } from "../document";
import { importLottieBytes, lottieName } from "./lottie-import";

const FIXTURES = join(process.cwd(), "..", "vozko-back", "domain", "studio", "testdata", "lottie");
const OPTIONS = { canvas: VIDEO_ASPECT_SIZES.story, atMs: 1500, name: "Selo" };

describe("importing a Lottie file", () => {
  it("turns a dotLottie file into one group clip at the playhead", async () => {
    const result = await importLottieBytes(new Uint8Array(readFileSync(join(FIXTURES, "static-shapes.lottie"))), OPTIONS);
    if (!result.ok) throw new Error(JSON.stringify(result));
    expect(result.clip).toMatchObject({ type: "group", startMs: 1500, name: "Selo" });
  });

  it("answers the file fault or the list of gaps", async () => {
    expect(await importLottieBytes(new TextEncoder().encode("{}"), OPTIONS)).toEqual({ ok: false, fault: "notLottie" });
    const refused = await importLottieBytes(new Uint8Array(readFileSync(join(FIXTURES, "unsupported.json"))), OPTIONS);
    expect(refused.ok).toBe(false);
    expect("gaps" in refused && refused.gaps.length).toBeGreaterThan(0);
  });

  it("names the clip after the file without its extension", () => {
    expect(lottieName("Logo animado.lottie")).toBe("Logo animado");
    expect(lottieName("seta.JSON")).toBe("seta");
  });
});
