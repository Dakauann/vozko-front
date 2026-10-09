import { describe, expect, it } from "vitest";

import { codedErrorMessage, type CodedTranslator } from "./coded-error";

function translator(messages: Record<string, string>): CodedTranslator {
  const t = ((key: string) => messages[key] ?? key) as CodedTranslator;
  t.has = (key: string) => key in messages;
  return t;
}

describe("codedErrorMessage", () => {
  const t = translator({ "errors.known_code": "Mensagem traduzida" });

  it("uses the translated message of a known code", () => {
    expect(codedErrorMessage(t, { code: "known_code", message: "server text" }, "fallback")).toBe(
      "Mensagem traduzida",
    );
  });

  it("falls back when the code has no translation", () => {
    expect(codedErrorMessage(t, { code: "other_code", message: "server text" }, "fallback")).toBe("fallback");
  });

  it("falls back when there is no code", () => {
    expect(codedErrorMessage(t, { message: "server text" }, "fallback")).toBe("fallback");
  });
});
