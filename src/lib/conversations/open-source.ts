export type ConversationOpenSource = "keyboard" | "pointer";

export function focusesComposerOnOpen(source: ConversationOpenSource | undefined): boolean {
  return source !== "keyboard";
}
