import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";

import { MAX_BUILDER_BUTTONS } from "./builder";
import { exitWordLabel, type ButtonActionChoice, type ButtonActionInput, type ButtonActionView, type ButtonActionKinds } from "./exit";

export type LeadExitPlan =
  | { mode: "button"; text: string; action: ButtonActionChoice }
  | { mode: "word"; word: string; footerText: string; confirmation: string };

interface ExitSetup {
  buttonActions: ButtonActionInput[];
  exitConfirmation: string;
}

type BuilderButton = NonNullable<DraggableComponent["data"]["buttons"]>[number];
type MakeId = (prefix: string) => string;

function buttonsOf(components: DraggableComponent[]): BuilderButton[] {
  return components.find((c) => c.type === "BUTTONS")?.data.buttons ?? [];
}

function withQuickReply(buttons: BuilderButton[], button: BuilderButton): BuilderButton[] {
  const lastQuickReply = buttons.map((b) => b.type).lastIndexOf("QUICK_REPLY");
  const at = lastQuickReply >= 0 ? lastQuickReply + 1 : buttons.length;
  return [...buttons.slice(0, at), button, ...buttons.slice(at)];
}

function placeButton(components: DraggableComponent[], holder: DraggableComponent, button: BuilderButton): DraggableComponent[] {
  const placed = { ...holder, data: { ...holder.data, buttons: withQuickReply(holder.data.buttons ?? [], button) } };
  const present = components.some((c) => c.id === holder.id);
  return present ? components.map((c) => (c.id === holder.id ? placed : c)) : [...components, placed];
}

function placeFooter(components: DraggableComponent[], data: DraggableComponent["data"], makeId: MakeId): DraggableComponent[] {
  const existing = components.find((c) => c.type === "FOOTER");
  if (existing) return components.map((c) => (c.id === existing.id ? { ...c, data: { ...c.data, ...data } } : c));
  const footer: DraggableComponent = { id: makeId("footer"), type: "FOOTER", data };
  const trailing = components.findIndex((c) => c.type === "BUTTONS" || c.type === "CALL_PERMISSION_REQUEST");
  if (trailing < 0) return [...components, footer];
  return [...components.slice(0, trailing), footer, ...components.slice(trailing)];
}

export function applyLeadExit(components: DraggableComponent[], plan: LeadExitPlan, makeId: MakeId): DraggableComponent[] {
  if (plan.mode === "button") {
    const holder = components.find((c) => c.type === "BUTTONS") ?? { id: makeId("buttons"), type: "BUTTONS" as const, data: { buttons: [] } };
    const button: BuilderButton = { id: makeId("btn"), type: "QUICK_REPLY", text: plan.text, action: plan.action, exitPiece: true };
    return placeButton(components, holder, button);
  }
  return placeFooter(
    components,
    { text: plan.footerText, exitConfirmation: plan.confirmation, exitPiece: true },
    makeId,
  );
}

export function leadExitPieceUsed(components: DraggableComponent[]): boolean {
  const footer = components.find((c) => c.type === "FOOTER");
  const footerExit = Boolean(footer?.data.exitPiece) && (footer?.data.text ?? "").trim() !== "";
  return footerExit || buttonsOf(components).some((b) => b.exitPiece && b.action);
}

export function leadExitRoom(components: DraggableComponent[]): { button: boolean } {
  const callPermission = components.some((c) => c.type === "CALL_PERMISSION_REQUEST");
  return { button: !callPermission && buttonsOf(components).length < MAX_BUILDER_BUTTONS };
}

export function withoutExitSetup(component: DraggableComponent): DraggableComponent {
  const { exitConfirmation, exitPiece, ...rest } = component.data;
  if (exitConfirmation === undefined && exitPiece === undefined) return component;
  return { ...component, data: rest };
}

export function collectExitSetup(components: DraggableComponent[]): ExitSetup {
  const buttonActions = buttonsOf(components).flatMap((button, buttonIndex) =>
    button.type === "QUICK_REPLY" && button.action ? [{ buttonIndex, buttonText: button.text ?? "", ...button.action }] : [],
  );
  const footer = components.find((c) => c.type === "FOOTER")?.data;
  return { buttonActions, exitConfirmation: footer?.exitConfirmation ?? "" };
}

export interface SavedExit {
  actions: readonly ButtonActionView[];
  exitConfirmation: string;
}

function foldForMatch(text: string): string {
  return text.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function savedActionFor(saved: SavedExit, button: BuilderButton, buttonIndex: number): ButtonActionChoice | undefined {
  if (button.type !== "QUICK_REPLY") return undefined;
  const action = saved.actions.find(
    (candidate) => candidate.buttonIndex === buttonIndex && foldForMatch(candidate.buttonText) === foldForMatch(button.text ?? ""),
  );
  return action ? { kind: action.kind, params: action.params, confirmation: action.confirmation } : undefined;
}

export function withSavedExit(components: DraggableComponent[], saved: SavedExit): DraggableComponent[] {
  return components.map((component) => {
    if (component.type === "FOOTER") return { ...component, data: { ...component.data, exitConfirmation: saved.exitConfirmation } };
    if (component.type !== "BUTTONS" || !component.data.buttons) return component;
    const linked = component.data.buttons.map((button, index) => {
      const action = savedActionFor(saved, button, index);
      return action ? { ...button, action } : button;
    });
    return { ...component, data: { ...component.data, buttons: linked } };
  });
}

export function editExitSetup(components: DraggableComponent[], savedConfirmation: string): ExitSetup {
  const setup = collectExitSetup(components);
  const holdsConfirmation = components.some((c) => c.type === "FOOTER");
  return holdsConfirmation ? setup : { ...setup, exitConfirmation: savedConfirmation };
}

export interface DraftVerdictRequest {
  category: string;
  header: string;
  body: string;
  footer: string;
  buttons: { type: string; text: string }[];
  buttonActions: ButtonActionInput[];
}

function textOf(components: DraggableComponent[], type: DraggableComponent["type"]): string {
  return components.find((c) => c.type === type)?.data.text ?? "";
}

function headerTextOf(components: DraggableComponent[]): string {
  const header = components.find((c) => c.type === "HEADER");
  const format = header?.data.format ?? "TEXT";
  return format === "TEXT" ? (header?.data.text ?? "") : "";
}

export function draftVerdictRequest(components: DraggableComponent[], category: string): DraftVerdictRequest {
  return {
    category,
    header: headerTextOf(components),
    body: textOf(components, "BODY"),
    footer: textOf(components, "FOOTER"),
    buttons: buttonsOf(components).map((button) => ({ type: button.type, text: button.text ?? "" })),
    buttonActions: collectExitSetup(components).buttonActions,
  };
}

const UNKNOWN_KINDS: readonly string[] = [];

export function allowedKindsOf(kinds: ButtonActionKinds | null): readonly string[] {
  return kinds?.allowedKinds ?? UNKNOWN_KINDS;
}

export function exitSetupFields(setup: ExitSetup): Partial<ExitSetup> {
  return {
    ...(setup.buttonActions.length > 0 ? { buttonActions: setup.buttonActions } : {}),
    ...(setup.exitConfirmation.trim() !== "" ? { exitConfirmation: setup.exitConfirmation } : {}),
  };
}

export type LeadExitMode = "button" | "word";

export interface LeadExitDraft {
  mode: LeadExitMode | null;
  text: string;
  action: ButtonActionChoice | null;
  word: string;
  footerText: string;
  confirmation: string;
}

export const EMPTY_LEAD_EXIT_DRAFT: LeadExitDraft = { mode: null, text: "", action: null, word: "", footerText: "", confirmation: "" };

export function planOf(draft: LeadExitDraft): LeadExitPlan | null {
  if (draft.mode === "button") {
    const text = draft.text.trim();
    return text && draft.action ? { mode: "button", text, action: draft.action } : null;
  }
  if (draft.mode === "word") {
    const word = draft.word.trim();
    const footerText = draft.footerText.trim();
    return word && footerShowsCommand(footerText, word) ? { mode: "word", word, footerText, confirmation: draft.confirmation } : null;
  }
  return null;
}

export function footerShowsCommand(footerText: string, word: string): boolean {
  return word.trim() !== "" && footerText.toLowerCase().includes(exitWordLabel(word.trim()).toLowerCase());
}

export function withExitWord(draft: LeadExitDraft, word: string, sentence: (command: string) => string): LeadExitDraft {
  const footerFor = (candidate: string) => (candidate.trim() === "" ? "" : sentence(exitWordLabel(candidate.trim())));
  const followsWord = draft.footerText === "" || draft.footerText === footerFor(draft.word);
  return { ...draft, word, footerText: followsWord ? footerFor(word) : draft.footerText };
}
