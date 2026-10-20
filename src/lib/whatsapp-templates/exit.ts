export const MARKETING_TEMPLATE_NEEDS_EXIT = "marketing_template_needs_exit";

export const BUTTON_ACTION_KINDS = [
  "opt_out",
  "consent_grant",
  "hand_off",
  "delegate",
  "start_workflow",
  "call_list",
  "classify",
  "create_deal",
] as const;

export type ButtonActionKind = (typeof BUTTON_ACTION_KINDS)[number];

export const EXIT_KINDS: readonly ButtonActionKind[] = ["opt_out", "consent_grant"];

export const ROUTE_KINDS: readonly ButtonActionKind[] = BUTTON_ACTION_KINDS.filter((kind) => !EXIT_KINDS.includes(kind));

export function isExitKind(kind: string): boolean {
  return EXIT_KINDS.some((exit) => exit === kind);
}

export const EXIT_WORD_PREFIX = "/";

export function exitWordLabel(word: string): string {
  const bare = word.startsWith(EXIT_WORD_PREFIX) ? word.slice(EXIT_WORD_PREFIX.length) : word;
  return `${EXIT_WORD_PREFIX}${bare}`;
}

export function exitWordsLabel(words: readonly string[]): string {
  return words.map(exitWordLabel).join(", ");
}

export interface ButtonActionParams {
  purpose?: string;
  departmentId?: string;
  userId?: string;
  agentId?: string;
  workflowId?: string;
  callListId?: string;
  fieldKey?: string;
  option?: string;
  pipelineId?: string;
  stageId?: string;
}

export interface ButtonActionChoice {
  kind: ButtonActionKind;
  params: ButtonActionParams;
  confirmation: string;
}

export interface ButtonActionInput extends ButtonActionChoice {
  buttonIndex: number;
  buttonText: string;
}

export interface ButtonActionView extends ButtonActionInput {
  stale: boolean;
  version: number;
  updatedBy?: string;
  updatedAt?: string;
}

export type ButtonActionSource = "template" | "campaign" | "";

export interface ButtonRoute {
  index: number;
  text: string;
  action: ButtonActionView | null;
  source?: ButtonActionSource;
  stale: boolean;
}

export interface ExitRiskAcknowledgementRecord {
  by: string;
  at: string;
}

export interface TemplateRef {
  name: string;
  language: string;
}

export interface TemplateButtonActions {
  templateId: string;
  template: TemplateRef;
  version: number;
  updatedBy?: string;
  updatedAt?: string;
  buttons: ButtonRoute[];
  actions: ButtonActionView[];
  exitConfirmation: string;
  allowedKinds: string[];
}

export interface TemplateActionsChange {
  actions: ButtonActionInput[];
  exitConfirmation: string;
}

export type ExitVerdictState = "ok" | "none";

interface ExitGates {
  templateExitRequired: boolean;
  campaignAcknowledgementRequired: boolean;
}

export interface ExitVerdict extends ExitGates {
  state: ExitVerdictState;
  buttons: ButtonRoute[];
  exitWords: string[];
}

export function templateExitMissing(verdict: ExitVerdict): boolean {
  return verdict.state === "none" && verdict.templateExitRequired !== false;
}

export interface DraftExitVerdict {
  verdict: ExitVerdict;
  allowedKinds: string[];
}

export interface AudienceExits {
  optedOut: number;
  blocked: number;
  notReceiving: number;
}

export interface CampaignButtonRoutes {
  campaignId: string;
  templateId: string;
  template: TemplateRef;
  version: number;
  updatedBy?: string;
  updatedAt?: string;
  routes: ButtonActionView[];
  buttons: ButtonRoute[];
  exitRiskAcknowledgement: ExitRiskAcknowledgementRecord | null;
}

export type ButtonChoices = Record<number, ButtonActionChoice | null>;

function inputOf(action: ButtonActionInput): ButtonActionInput {
  return { buttonIndex: action.buttonIndex, buttonText: action.buttonText, kind: action.kind, params: action.params, confirmation: action.confirmation };
}

type SeenTexts = Record<number, string>;

export function seenTexts(buttons: readonly ButtonRoute[], actions: readonly ButtonActionView[], confirmed: ReadonlySet<number>): SeenTexts {
  const shown: SeenTexts = Object.fromEntries(buttons.map((button) => [button.index, button.text]));
  for (const action of actions) {
    const current = shown[action.buttonIndex];
    if (action.stale && (current === undefined || !confirmed.has(action.buttonIndex))) shown[action.buttonIndex] = action.buttonText;
  }
  return shown;
}

export function changeOf(current: TemplateButtonActions): TemplateActionsChange {
  return {
    actions: current.actions.map(inputOf),
    exitConfirmation: current.exitConfirmation,
  };
}

export function withButtonAction(
  change: TemplateActionsChange,
  buttonIndex: number,
  buttonText: string,
  choice: ButtonActionChoice | null,
): TemplateActionsChange {
  const others = change.actions.filter((action) => action.buttonIndex !== buttonIndex);
  return { ...change, actions: choice ? [...others, { buttonIndex, buttonText, ...choice }] : others };
}

export function actionInputs(choices: ButtonChoices, shown: SeenTexts): ButtonActionInput[] {
  return Object.entries(choices).flatMap(([index, choice]) =>
    choice ? [{ buttonIndex: Number(index), buttonText: shown[Number(index)] ?? "", ...choice }] : [],
  );
}

export function exitRiskFields(acknowledged: boolean): { exitRiskAcknowledged?: true } {
  return acknowledged ? { exitRiskAcknowledged: true } : {};
}

export function offeredKinds(kinds: readonly ButtonActionKind[], allowed: readonly string[]): ButtonActionKind[] {
  return kinds.filter((kind) => allowed.includes(kind));
}

export function choicesOf(actions: readonly ButtonActionInput[]): ButtonChoices {
  return Object.fromEntries(actions.map((action) => [action.buttonIndex, { kind: action.kind, params: action.params, confirmation: action.confirmation }]));
}
