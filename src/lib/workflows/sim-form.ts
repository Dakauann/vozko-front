import { answerText, type AnswerWords } from "@/lib/whatsapp-forms/answers";
import { documentFields } from "@/lib/whatsapp-forms/document-edit";
import type { Answer, Document, Field } from "@/lib/whatsapp-forms/types";

export type SimFormDraft = Record<string, Answer>;

export const MASKED_FORM_ANSWER = "••••";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function shownDate(iso: string): string {
  const parts = ISO_DATE.exec(iso);
  return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : iso;
}

const RUN_WORDS: AnswerWords = {
  yes: "Sim",
  no: "Não",
  range: (start, end) => `${start} a ${end}`,
  date: shownDate,
};

export function isMaskedFormField(field: Field): boolean {
  return field.sensitive || field.kind === "photo" || field.kind === "document";
}

function isAnswered(answer: Answer | undefined): answer is Answer {
  if (!answer) return false;
  if (answer.checked !== undefined) return true;
  if (answer.optionIds && answer.optionIds.length > 0) return true;
  if (answer.range) return answer.range.start !== "" && answer.range.end !== "";
  if (answer.files && answer.files.length > 0) return true;
  return (answer.text ?? "").trim() !== "";
}

export function formRunAnswers(document: Document, draft: SimFormDraft): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const { field } of documentFields(document)) {
    const answer = draft[field.key];
    if (!isAnswered(answer)) continue;
    answers[field.key] = isMaskedFormField(field) ? MASKED_FORM_ANSWER : answerText(answer, field, RUN_WORDS);
  }
  return answers;
}
