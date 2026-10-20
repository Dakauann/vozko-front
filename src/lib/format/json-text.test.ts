import { describe, expect, it } from "vitest";

import { prettyJsonText } from "./json-text";

describe("prettyJsonText", () => {
  it("indents a JSON body so a response can be read", () => {
    expect(prettyJsonText('{"a":1,"b":[true]}')).toBe('{\n  "a": 1,\n  "b": [\n    true\n  ]\n}');
  });

  it("returns text that is not JSON as it came", () => {
    expect(prettyJsonText("<html>erro</html>")).toBe("<html>erro</html>");
  });
});
