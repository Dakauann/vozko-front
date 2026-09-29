import { describe, expect, it } from "vitest";

import { appendDictation, nextSentences, pickVoice, speakableText, speechLang } from "@/lib/voice/speech-text";

function voice(name: string, lang: string, localService = true): SpeechSynthesisVoice {
  return { name, lang, localService, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

describe("speakableText", () => {
  it("reads markdown the way a person would say it", () => {
    const markdown = [
      "## Resumo",
      "- **12** conversas abertas",
      "1. Veja a [campanha de março](campaign:5f0c2b1e-8d2a-4c61-9b7e-1a2b3c4d5e6f) e o `funil`",
      "| Coluna | Valor |",
      "|---|---|",
      "| a | 1 |",
      "---",
      "Fim.",
    ].join("\n");
    expect(speakableText(markdown)).toBe("Resumo 12 conversas abertas Veja a campanha de março e o funil Fim.");
  });

  it("never reads code or bare identifiers aloud", () => {
    expect(speakableText("Antes\n```json\n{\"a\":1}\n```\nDepois 5f0c2b1e-8d2a-4c61-9b7e-1a2b3c4d5e6f")).toBe("Antes Depois");
  });
});

describe("nextSentences", () => {
  it("hands over whole sentences as the answer streams and keeps the unfinished tail", () => {
    const first = nextSentences("Olá, tudo bem? Hoje você tem 3 conv", 0, false);
    expect(first.sentences).toEqual(["Olá, tudo bem?"]);
    const second = nextSentences("Olá, tudo bem? Hoje você tem 3 conversas. E mais", first.next, false);
    expect(second.sentences).toEqual(["Hoje você tem 3 conversas."]);
    const last = nextSentences("Olá, tudo bem? Hoje você tem 3 conversas. E mais nada", second.next, true);
    expect(last.sentences).toEqual(["E mais nada"]);
  });

  it("does not split numbers or money", () => {
    expect(nextSentences("Saldo de R$ 1.234,56 hoje. ", 0, false).sentences).toEqual(["Saldo de R$ 1.234,56 hoje."]);
  });

  it("treats line breaks as pauses and skips what cannot be spoken", () => {
    const text = "Resumo:\n| a | b |\n| 1 | 2 |\nPronto.\n";
    expect(nextSentences(text, 0, false).sentences).toEqual(["Resumo:", "Pronto."]);
  });

  it("stays silent inside a code block even while it streams", () => {
    const text = "Veja:\n```\nlinha um.\nlinha dois.\n";
    expect(nextSentences(text, 0, false).sentences).toEqual(["Veja:"]);
  });
});

describe("speechLang", () => {
  it("maps the app locale to a speech language", () => {
    expect(speechLang("pt")).toBe("pt-BR");
    expect(speechLang("en")).toBe("en-US");
    expect(speechLang("es")).toBe("es-ES");
    expect(speechLang("de")).toBe("de-DE");
    expect(speechLang("fr")).toBe("pt-BR");
  });
});

describe("pickVoice", () => {
  it("prefers a natural voice in the exact language", () => {
    const voices = [
      voice("Microsoft Maria", "pt-BR"),
      voice("Google português do Brasil", "pt-BR", false),
      voice("Microsoft Francisca Online (Natural)", "pt-BR", false),
      voice("Joana", "pt-PT"),
    ];
    expect(pickVoice(voices, "pt-BR")?.name).toBe("Microsoft Francisca Online (Natural)");
  });

  it("falls back to the same language family, then to nothing", () => {
    expect(pickVoice([voice("Joana", "pt-PT"), voice("Samantha", "en-US")], "pt-BR")?.name).toBe("Joana");
    expect(pickVoice([voice("Samantha", "en-US")], "pt-BR")).toBeNull();
  });
});

describe("appendDictation", () => {
  it("adds what was said after what was typed", () => {
    expect(appendDictation("", " quantas conversas ")).toBe("quantas conversas");
    expect(appendDictation("Resuma o dia  ", "e mande no chat")).toBe("Resuma o dia e mande no chat");
    expect(appendDictation("Resuma", "   ")).toBe("Resuma");
  });
});
