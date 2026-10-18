import { describe, expect, it } from "vitest";

import {
  UNOFFICIAL_CAMPAIGN_NEEDS_EXIT,
  exitWordsShownIn,
  messageExitPending,
  messageShowsExit,
  withExitLine,
} from "./exit-line";
import type { UnofficialWhatsAppMessageSpec } from "./types";

const text = (...bodies: string[]): UnofficialWhatsAppMessageSpec => ({ kind: "text", bodies });

describe("exitWordsShownIn", () => {
  it("reads slash commands at the start, after a space or after an opening mark", () => {
    expect(exitWordsShownIn("/sair agora")).toEqual(["sair"]);
    expect(exitWordsShownIn("Responda /sair para não receber mais mensagens.")).toEqual(["sair"]);
    expect(exitWordsShownIn('Envie "/parar" ou (/stop)')).toEqual(["parar", "stop"]);
  });

  it("never reads a link path or a date", () => {
    expect(exitWordsShownIn("veja https://loja.com/sair")).toEqual([]);
    expect(exitWordsShownIn("até 12/10")).toEqual([]);
  });

  it("lists a repeated command once and skips one longer than thirty letters", () => {
    expect(exitWordsShownIn("/Sair ou /sair")).toEqual(["Sair"]);
    expect(exitWordsShownIn(`/${"a".repeat(31)}`)).toEqual([]);
  });
});

describe("messageShowsExit", () => {
  it("needs a command in every variant", () => {
    expect(messageShowsExit(text("Oi /sair", "Olá, envie /parar"))).toBe(true);
    expect(messageShowsExit(text("Oi /sair", "Olá"))).toBe(false);
    expect(messageShowsExit(text(""))).toBe(false);
    expect(messageShowsExit({ kind: "image", bodies: ["Promo /sair", ""], mediaId: "m-1" })).toBe(true);
  });

  it("reads an audio's exit from the text sent after it, never from its caption", () => {
    expect(messageShowsExit({ kind: "audio", bodies: [], mediaId: "m-1", exitText: "Responda /sair" })).toBe(true);
    expect(messageShowsExit({ kind: "audio", bodies: ["Responda /sair"], mediaId: "m-1" })).toBe(false);
    expect(messageShowsExit({ kind: "audio", bodies: [], mediaId: "m-1", exitText: "Responda sair" })).toBe(false);
  });

  it("ignores the menu footer, which the transcript does not keep", () => {
    expect(messageShowsExit({ kind: "menu", bodies: ["Escolha"], footer: "Responda /sair" })).toBe(false);
  });
});

describe("messageExitPending", () => {
  it("asks a new message for its exit", () => {
    expect(messageExitPending(text("Oi"))).toBe(true);
    expect(messageExitPending(text("Oi /sair"))).toBe(false);
  });

  it("lets a campaign keep the message it was created with", () => {
    const saved = text("Oi");
    expect(messageExitPending(text(" Oi "), saved)).toBe(false);
    expect(messageExitPending(text("Olá"), saved)).toBe(true);
  });

  it("treats a new exit text as a new message", () => {
    const saved = { kind: "audio" as const, bodies: [], mediaId: "m-1" };
    expect(messageExitPending({ ...saved }, saved)).toBe(false);
    expect(messageExitPending({ ...saved, exitText: "Responda sair" }, saved)).toBe(true);
  });
});

describe("withExitLine", () => {
  it("adds the line to every variant that lacks a command and keeps the others", () => {
    expect(withExitLine(text("Oi", "Olá /parar", ""), "Responda /sair").bodies).toEqual(["Oi\n\nResponda /sair", "Olá /parar", "Responda /sair"]);
  });

  it("writes the line when there is no text yet", () => {
    expect(withExitLine(text(), "Responda /sair").bodies).toEqual(["Responda /sair"]);
  });

  it("makes the line the exit text of an audio and leaves its caption alone", () => {
    const audio = withExitLine({ kind: "audio", bodies: ["legenda"], mediaId: "m-1" }, "Responda /sair");
    expect(audio).toEqual({ kind: "audio", bodies: ["legenda"], mediaId: "m-1", exitText: "Responda /sair" });
  });
});

describe("UNOFFICIAL_CAMPAIGN_NEEDS_EXIT", () => {
  it("is the code the server refuses with", () => {
    expect(UNOFFICIAL_CAMPAIGN_NEEDS_EXIT).toBe("unofficial_campaign_needs_exit");
  });
});
