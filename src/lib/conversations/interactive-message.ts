import type { ConversationMessage, InteractiveAction, InteractiveContent, InteractiveRow } from "./types";

export type InteractiveChoiceKind = "button" | "list";

export interface InteractiveChoice {
  kind: InteractiveChoiceKind;
  id: string;
  title: string;
}

export function buttonChoice(action: InteractiveAction): InteractiveChoice | null {
  return action.kind === "reply" && action.id ? { kind: "button", id: action.id, title: action.title } : null;
}

export function rowChoice(row: InteractiveRow): InteractiveChoice {
  return { kind: "list", id: row.id, title: row.title };
}

export function interactiveActions(content: InteractiveContent): InteractiveAction[] {
  return content.kind === "list" ? [] : (content.buttons ?? []);
}

export function chosenOptionId(promptId: string, messages: Iterable<ConversationMessage>): string | undefined {
  let chosen: ConversationMessage | undefined;
  for (const message of messages) {
    if (message.reply_to_message_id !== promptId || !message.interactive_reply) continue;
    if (!chosen || message.created_at > chosen.created_at) chosen = message;
  }
  return chosen?.interactive_reply?.option_id;
}

export function chosenRow(content: InteractiveContent | undefined, optionId: string | undefined): InteractiveRow | undefined {
  if (!content || !optionId) return undefined;
  for (const section of content.sections ?? []) {
    const row = section.rows.find((candidate) => candidate.id === optionId);
    if (row) return row;
  }
  return undefined;
}
