import { documentFields } from "./document-edit";
import type { Answer, Answers, Document, Field, FieldKind, Screen } from "./types";

export interface ResponseColumn {
  key: string;
  label: string;
  kind: FieldKind;
  field: Field;
}

export interface AnswerWords {
  yes: string;
  no: string;
  range: (start: string, end: string) => string;
  date: (iso: string) => string;
}

export interface ScreenAnswers {
  screen: Screen;
  items: { field: Field; answer: Answer | undefined }[];
}

export function fieldPrompt(field: Field): string {
  const question = field.question?.trim();
  return question ? question : field.label.trim();
}

export function responseColumns(document: Document): ResponseColumn[] {
  return documentFields(document).map(({ field }) => ({ key: field.key, label: fieldPrompt(field) || field.key, kind: field.kind, field }));
}

export function answerText(answer: Answer | undefined, field: Field, words: AnswerWords): string {
  if (!answer) return "";
  if (answer.optionIds && answer.optionIds.length > 0) {
    return answer.optionIds.map((id) => field.options?.find((option) => option.id === id)?.title ?? id).join(", ");
  }
  if (answer.checked !== undefined) return answer.checked ? words.yes : words.no;
  if (answer.range) return words.range(words.date(answer.range.start), words.date(answer.range.end));
  if (answer.files && answer.files.length > 0) return answer.files.map((file) => file.name || file.id).join(", ");
  if (answer.kind === "date" && answer.text) return words.date(answer.text);
  return answer.text ?? "";
}

export function answersByScreen(document: Document, answers: Answers): ScreenAnswers[] {
  return document.screens
    .map((screen) => ({
      screen,
      items: screen.blocks.flatMap((block) => (block.field ? [{ field: block.field, answer: answers.values[block.field.key] }] : [])),
    }))
    .filter((group) => group.items.length > 0);
}
