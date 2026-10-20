import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import rules from "./message-text-rules.json";
import { MERCADOLIVRE_MAX_MESSAGE_CHARACTERS, offendingMessageCharacters, validateMessageText } from "./message-text";

const SERVER_RULES = resolve(__dirname, "../../../../vozko-back/domain/mercadolivre/message_text_rules.json");
const REFRESH = "bun scripts/mercadolivre-text-rules.ts";

interface ServerRules {
  maxRunes: number;
  emojiSource: string;
  emoji: { sequence: string; fitzpatrick: boolean }[];
  cases: { name: string; text: string; repeat?: number; valid: boolean; error: string; offending: string[] }[];
}

const server = JSON.parse(readFileSync(SERVER_RULES, "utf8")) as ServerRules;

describe("Mercado Livre message text rules", () => {
  it("carries the exact emoji list and limit the server validates", () => {
    expect(rules, `${REFRESH} refreshes the copy`).toEqual({ maxRunes: server.maxRunes, emojiSource: server.emojiSource, emoji: server.emoji });
    expect(MERCADOLIVRE_MAX_MESSAGE_CHARACTERS).toBe(server.maxRunes);
  });

  it.each(server.cases.map((c) => [c.name, c] as const))("%s", (_, c) => {
    const text = c.repeat ? c.text.repeat(c.repeat) : c.text;
    const result = validateMessageText(text);
    expect(result.valid).toBe(c.valid);
    expect(result.error ?? "").toBe(c.error);
    expect(result.offending.map((o) => o.character)).toEqual(c.error === "charset" ? c.offending : []);
  });

  it("accepts every listed emoji, with a skin tone where the list allows one", () => {
    for (const e of server.emoji) {
      expect(validateMessageText(e.sequence).valid, e.sequence).toBe(true);
      if (e.fitzpatrick) expect(validateMessageText(`${e.sequence}\u{1F3FD}`).valid, e.sequence).toBe(true);
    }
  });

  it("refuses a lone surrogate the way the server refuses invalid text", () => {
    expect(offendingMessageCharacters("ok \uD83D").map((o) => o.character)).toEqual(["\uD83D"]);
  });

  it("counts characters as code points and reports how often each offending character appears", () => {
    const result = validateMessageText("€ ok € “x”");
    expect(result.length).toBe(10);
    expect(result.max).toBe(350);
    expect(result.offending).toEqual([
      { character: "€", occurrences: 2 },
      { character: "“", occurrences: 1 },
      { character: "”", occurrences: 1 },
    ]);
  });

  it("treats blank text exactly as the server trims it", () => {
    expect(validateMessageText("\u0085 　").error).toBe("empty");
    expect(validateMessageText("﻿").error).toBe("charset");
  });

  it("measures length even when the charset refuses first", () => {
    const result = validateMessageText("€".repeat(400));
    expect(result.error).toBe("charset");
    expect(result.length).toBe(400);
  });
});
