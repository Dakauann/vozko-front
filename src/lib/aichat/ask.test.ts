import { describe, expect, it } from "vitest";

import { askQuestions, askTurn, composeAnswers, nextOpenStep, readAnswers } from "./ask";
import type { AskQuestion } from "./types";
import type { UIMessage } from "./ui-message";

const format: AskQuestion = { text: "Onde vai rodar?", options: [{ label: "Stories 9:16", detail: "vertical" }, { label: "Feed 4:5" }] };
const length: AskQuestion = { text: "Quanto tempo?", options: [{ label: "6 s" }, { label: "15 s" }] };

function message(role: UIMessage["role"], content: string): UIMessage {
  return { id: content, role, content, createdAt: "" };
}

describe("ask card questions", () => {
  it("reads the short form a card carries", () => {
    expect(askQuestions({ kind: "ask", questions: [format, length] })).toEqual([format, length]);
  });

  it("still reads the single question cards stored before forms existed", () => {
    expect(askQuestions({ kind: "ask", question: { text: "Qual o próximo passo?", options: ["Exportar", "Colocar música"] } })).toEqual([
      { text: "Qual o próximo passo?", options: [{ label: "Exportar" }, { label: "Colocar música" }] },
    ]);
  });

  it("finds nothing to ask in an empty card", () => {
    expect(askQuestions({ kind: "ask" })).toEqual([]);
  });
});

describe("ask card answers", () => {
  it("sends a single answer as the plain reply", () => {
    expect(composeAnswers([format], ["Stories 9:16"])).toBe("Stories 9:16");
  });

  it("sends every answer of a form together, each under its question", () => {
    expect(composeAnswers([format, length], ["Feed 4:5", "15 s"])).toBe("Onde vai rodar?\nFeed 4:5\n\nQuanto tempo?\n15 s");
  });

  it("reads the answers back from the reply that was sent", () => {
    expect(readAnswers([format, length], "Onde vai rodar?\nFeed 4:5\n\nQuanto tempo?\n15 s")).toEqual(["Feed 4:5", "15 s"]);
    expect(readAnswers([format], "  Stories 9:16 ")).toEqual(["Stories 9:16"]);
  });

  it("does not pretend a free reply answered the form", () => {
    expect(readAnswers([format, length], "faz como achar melhor")).toBeNull();
    expect(readAnswers([format, length], "Quanto tempo?\n15 s\n\nOnde vai rodar?\nFeed 4:5")).toBeNull();
  });

  it("moves to the next unanswered question and to the review when all are answered", () => {
    expect(nextOpenStep(["Feed 4:5", null, null], 0)).toBe(1);
    expect(nextOpenStep(["Feed 4:5", null, "Sim"], 2)).toBe(1);
    expect(nextOpenStep(["Feed 4:5", "15 s"], 1)).toBe(2);
  });
});

describe("ask turn", () => {
  const answer = () => true;

  it("stays open while nothing was said after the card", () => {
    expect(askTurn(undefined, answer)).toEqual({ state: "open", answer });
  });

  it("is answered by the next message the person sent", () => {
    expect(askTurn(message("user", "Feed 4:5"), answer)).toEqual({ state: "answered", reply: "Feed 4:5" });
  });

  it("closes without an answer when the conversation moved on otherwise", () => {
    expect(askTurn(message("assistant", "Pronto"), answer)).toEqual({ state: "open", answer: null });
  });
});
