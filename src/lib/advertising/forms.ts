export type QuestionType =
  | "FULL_NAME"
  | "FIRST_NAME"
  | "LAST_NAME"
  | "EMAIL"
  | "PHONE"
  | "CITY"
  | "STATE"
  | "ZIP"
  | "COMPANY_NAME"
  | "JOB_TITLE"
  | "CUSTOM";

export type StandardQuestion = Exclude<QuestionType, "CUSTOM" | "FIRST_NAME" | "LAST_NAME">;

export const STANDARD_QUESTIONS: StandardQuestion[] = ["FULL_NAME", "EMAIL", "PHONE", "CITY", "STATE", "ZIP", "COMPANY_NAME", "JOB_TITLE"];

export const MAX_QUESTIONS = 15;
export const MAX_OPTIONS = 10;
export const MAX_LABEL = 80;
export const MAX_FORM_TEXT = 300;
export const MAX_PRIVACY_TEXT = 70;
export const MAX_BUTTON_TEXT = 60;
export const MAX_INTRO_TITLE = 60;
export const MAX_INTRO_ITEMS = 5;

export type IntroStyle = "PARAGRAPH" | "LIST";

export interface FormIntro {
  title: string;
  style: IntroStyle;
  content: string[];
}

export interface FormQuestion {
  type: QuestionType;
  key?: string;
  label?: string;
  options?: string[];
}

export type FormStatus = "ACTIVE" | "ARCHIVED";

export interface LeadForm {
  metaId: string;
  pageId: string;
  name: string;
  status: FormStatus | string;
  locale?: string;
  questions: FormQuestion[] | null;
  privacyUrl?: string;
  leadsCount: number;
  createdTime?: string;
}

export interface LeadFormDraft {
  adAccountId: string;
  pageId: string;
  name: string;
  locale?: string;
  intro?: FormIntro;
  questions: FormQuestion[];
  privacyUrl: string;
  privacyText?: string;
  thankYouTitle: string;
  thankYouBody?: string;
  thankYouUrl: string;
  thankYouButtonText: string;
  higherIntent?: boolean;
}

export interface FormLead {
  metaId: string;
  formMetaId: string;
  adMetaId?: string;
  pageId?: string;
  answers: Record<string, string> | null;
  leadId?: string;
  leadName?: string;
  createdTime: string;
}

export interface FormLeadsPage {
  items: FormLead[] | null;
  total: number;
}

export interface BuilderQuestion {
  id: string;
  type: QuestionType;
  label: string;
  options: string[];
}

export interface FormBuilderState {
  name: string;
  introOn: boolean;
  introTitle: string;
  introStyle: IntroStyle;
  introParagraph: string;
  introItems: string[];
  questions: BuilderQuestion[];
  privacyUrl: string;
  privacyText: string;
  thankYouTitle: string;
  thankYouBody: string;
  thankYouUrl: string;
  thankYouButtonText: string;
  higherIntent: boolean;
}

let nextQuestionId = 0;

function questionId(): string {
  nextQuestionId += 1;
  return `q${nextQuestionId}`;
}

export function standardQuestion(type: StandardQuestion): BuilderQuestion {
  return { id: questionId(), type, label: "", options: [] };
}

export function customQuestion(): BuilderQuestion {
  return { id: questionId(), type: "CUSTOM", label: "", options: [] };
}

export function emptyFormBuilder(buttonText = ""): FormBuilderState {
  return {
    name: "",
    introOn: false,
    introTitle: "",
    introStyle: "PARAGRAPH",
    introParagraph: "",
    introItems: [""],
    questions: [standardQuestion("FULL_NAME"), standardQuestion("PHONE"), standardQuestion("EMAIL")],
    privacyUrl: "",
    privacyText: "",
    thankYouTitle: "",
    thankYouBody: "",
    thankYouUrl: "",
    thankYouButtonText: buttonText,
    higherIntent: false,
  };
}

export function hasQuestion(questions: BuilderQuestion[], type: StandardQuestion): boolean {
  return questions.some((question) => question.type === type);
}

export function toggleStandard(questions: BuilderQuestion[], type: StandardQuestion): BuilderQuestion[] {
  if (hasQuestion(questions, type)) return questions.filter((question) => question.type !== type);
  return [...questions, standardQuestion(type)];
}

export function moveQuestion(questions: BuilderQuestion[], index: number, offset: -1 | 1): BuilderQuestion[] {
  const target = index + offset;
  if (index < 0 || index >= questions.length || target < 0 || target >= questions.length) return questions;
  const next = [...questions];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function hasContactQuestion(questions: Pick<BuilderQuestion, "type">[]): boolean {
  return questions.some((question) => question.type === "PHONE" || question.type === "EMAIL");
}

const ACCENTS = /[̀-ͯ]/g;

export function customQuestionKey(label: string, index: number): string {
  const slug = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(ACCENTS, "")
    .replace(/[ _-]/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+|_+$/g, "");
  return `${slug || "pergunta"}_${String.fromCharCode(97 + (index % 26))}`;
}

const STANDARD_KEYS: Record<Exclude<QuestionType, "CUSTOM">, string> = {
  FULL_NAME: "full_name",
  FIRST_NAME: "first_name",
  LAST_NAME: "last_name",
  EMAIL: "email",
  PHONE: "phone_number",
  CITY: "city",
  STATE: "state",
  ZIP: "zip_code",
  COMPANY_NAME: "company_name",
  JOB_TITLE: "job_title",
};

export function questionKey(question: Pick<BuilderQuestion, "type" | "label">, index: number): string {
  return question.type === "CUSTOM" ? customQuestionKey(question.label, index) : STANDARD_KEYS[question.type];
}

function trimmed(value: string): string | undefined {
  const clean = value.trim();
  return clean === "" ? undefined : clean;
}

export function introLines(state: Pick<FormBuilderState, "introStyle" | "introParagraph" | "introItems">): string[] {
  const lines = state.introStyle === "PARAGRAPH" ? [state.introParagraph] : state.introItems;
  return lines.map((line) => line.trim()).filter(Boolean);
}

export function buildIntro(state: FormBuilderState): FormIntro | undefined {
  if (!state.introOn) return undefined;
  return { title: state.introTitle.trim(), style: state.introStyle, content: introLines(state) };
}

export function buildFormDraft(state: FormBuilderState, adAccountId: string, pageId: string): LeadFormDraft {
  return {
    adAccountId,
    pageId,
    name: state.name.trim(),
    intro: buildIntro(state),
    questions: state.questions.map((question) =>
      question.type === "CUSTOM"
        ? {
            type: "CUSTOM",
            label: question.label.trim(),
            options: question.options.map((option) => option.trim()).filter(Boolean),
          }
        : { type: question.type },
    ),
    privacyUrl: state.privacyUrl.trim(),
    privacyText: trimmed(state.privacyText),
    thankYouTitle: state.thankYouTitle.trim(),
    thankYouBody: trimmed(state.thankYouBody),
    thankYouUrl: state.thankYouUrl.trim(),
    thankYouButtonText: state.thankYouButtonText.trim(),
    higherIntent: state.higherIntent,
  };
}

export function questionIssuePrefix(index: number): string {
  return `questions[${index}]`;
}

export interface LeadContactView {
  name: string | null;
  phone: string | null;
  email: string | null;
  others: { key: string; value: string }[];
}

const NAME_KEYS = ["full_name", "first_name", "last_name"];
const PHONE_KEYS = ["phone_number", "phone"];
const EMAIL_KEYS = ["email"];
const CONTACT_KEYS = new Set([...NAME_KEYS, ...PHONE_KEYS, ...EMAIL_KEYS]);

function present(value: string | undefined): string | null {
  const clean = (value ?? "").trim();
  return clean === "" ? null : clean;
}

export function leadContact(answers: Record<string, string> | null | undefined): LeadContactView {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(answers ?? {})) {
    normalized.set(key.trim().toLowerCase(), value);
  }
  const full = present(normalized.get("full_name"));
  const split = [present(normalized.get("first_name")), present(normalized.get("last_name"))].filter(Boolean).join(" ");
  const others = [...normalized.entries()]
    .filter(([key, value]) => !CONTACT_KEYS.has(key) && present(value) !== null)
    .map(([key, value]) => ({ key, value: value.trim() }));
  return {
    name: full ?? (split || null),
    phone: present(normalized.get("phone_number")) ?? present(normalized.get("phone")),
    email: present(normalized.get("email")),
    others,
  };
}

export function humanizeKey(key: string): string {
  const words = key.replace(/_[a-z]$/, "").replace(/_/g, " ").trim();
  return words === "" ? key : words.charAt(0).toUpperCase() + words.slice(1);
}
