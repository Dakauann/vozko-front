import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SOUND_FILES } from "./sound-player";

describe("sound files", () => {
    it.each(Object.entries(SOUND_FILES))("ships %s", (_, url) => {
        const file = path.join(process.cwd(), "public", url);
        expect(existsSync(file)).toBe(true);
        expect(statSync(file).size).toBeGreaterThan(1_000);
    });
});
