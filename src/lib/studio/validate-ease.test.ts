import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { documentIssue } from "./validate";

const fixture = () => readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_ease.json"), "utf8");

describe("the ease contract shared with the backend", () => {
  it("accepts eased and smooth keys the backend accepts", () => {
    expect(documentIssue("video", JSON.parse(fixture()))).toBeNull();
  });

  it("refuses smooth on a color key and a flag that is not true or false", () => {
    const color = fixture().replace(`{ "atMs": 400, "color": "#ffcc00", "easing": "linear" }`, `{ "atMs": 400, "color": "#ffcc00", "easing": "linear", "smooth": true }`);
    const text = fixture().replace(`"easing": "linear", "smooth": true }`, `"easing": "linear", "smooth": "yes" }`);
    for (const changed of [color, text]) {
      expect(changed).not.toBe(fixture());
      expect(documentIssue("video", JSON.parse(changed))).not.toBeNull();
    }
  });
});
