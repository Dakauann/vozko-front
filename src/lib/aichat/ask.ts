import type { AskCard, AskQuestion } from "./types";
import type { UIMessage } from "./ui-message";

export type ChatAnswer = (text: string) => boolean;

export type AskTurn = { state: "open"; answer: ChatAnswer | null } | { state: "answered"; reply: string };

const PAIR_BREAK = "\n\n";

export function askQuestions(card: AskCard): AskQuestion[] {
  if (card.questions) return card.questions;
  if (!card.question) return [];
  return [{ text: card.question.text, options: card.question.options.map((label) => ({ label })) }];
}

export function composeAnswers(questions: AskQuestion[], answers: string[]): string {
  if (questions.length === 1) return answers[0];
  return questions.map((question, i) => `${question.text}\n${answers[i]}`).join(PAIR_BREAK);
}

export function readAnswers(questions: AskQuestion[], reply: string): string[] | null {
  const clean = reply.trim();
  if (questions.length === 1) return clean ? [clean] : null;
  const pairs = clean.split(PAIR_BREAK);
  if (pairs.length !== questions.length) return null;
  const answers: string[] = [];
  for (const [i, pair] of pairs.entries()) {
    const [text, ...rest] = pair.split("\n");
    const answer = rest.join("\n").trim();
    if (text.trim() !== questions[i].text || !answer) return null;
    answers.push(answer);
  }
  return answers;
}

export function nextOpenStep(answers: (string | null)[], from: number): number {
  for (let offset = 1; offset <= answers.length; offset++) {
    const step = (from + offset) % answers.length;
    if (answers[step] === null) return step;
  }
  return answers.length;
}

export function askTurn(next: UIMessage | undefined, answer: ChatAnswer | null): AskTurn {
  if (!next) return { state: "open", answer };
  if (next.role === "user") return { state: "answered", reply: next.content };
  return { state: "open", answer: null };
}
