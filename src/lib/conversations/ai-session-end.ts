import type { ConversationActorKind } from "./events";

export interface AiSessionEndInput {
  reason: string;
  enderKind: ConversationActorKind;
  ender: string | null;
  to: string | null;
}

export interface AiSessionEndLine {
  key: string;
  values: Record<string, string>;
}

function line(key: string, values: Record<string, string> = {}): AiSessionEndLine {
  return { key, values };
}

function handoff(input: AiSessionEndInput): AiSessionEndLine {
  if (input.enderKind === "human" && input.ender) {
    return input.to ? line("operatorHandoff", { actor: input.ender, to: input.to }) : line("operatorHandoffTeam", { actor: input.ender });
  }
  const who = input.enderKind === "workflow" ? "workflow" : "ai";
  return input.to ? line(`${who}Handoff`, { to: input.to }) : line(`${who}HandoffTeam`);
}

export function aiSessionEndLine(input: AiSessionEndInput): AiSessionEndLine | null {
  const person = input.enderKind === "human" ? input.ender : null;
  switch (input.reason) {
    case "manual_assignment":
      return person && input.to ? line("manualAssignment", { actor: person, to: input.to }) : input.to ? line("assignedTo", { to: input.to }) : null;
    case "human_reply": {
      const replier = person ?? input.to;
      return replier ? line("humanReply", { actor: replier }) : line("humanReplyAnonymous");
    }
    case "automation_paused":
      return person ? line("paused", { actor: person }) : line("pausedAnonymous");
    case "automation_handoff":
      return handoff(input);
    case "conversation_finished":
      return person ? line("finishedBy", { actor: person }) : line("finished");
  }
  return null;
}
