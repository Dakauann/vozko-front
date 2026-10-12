import type { ChatAttachment } from "./types";

export interface EloHandoff {
  projectId: string;
  prompt: string;
  attachments: ChatAttachment[];
}

export type HandoffListener = (handoff: EloHandoff) => void;

export interface HandoffChannel {
  send: (handoff: EloHandoff) => void;
  listen: (listener: HandoffListener) => () => void;
}

export function createHandoffChannel(): HandoffChannel {
  let pending: EloHandoff | null = null;
  let listener: HandoffListener | null = null;
  return {
    send: (handoff) => {
      if (listener) listener(handoff);
      else pending = handoff;
    },
    listen: (next) => {
      listener = next;
      const waiting = pending;
      pending = null;
      if (waiting) next(waiting);
      return () => {
        if (listener === next) listener = null;
      };
    },
  };
}

export function handoffPrompt(context: string, instruction = ""): string {
  return `${context}\n${instruction}`;
}

export function mergeDraft(current: string, prompt: string): string {
  return current.trim() ? `${current.trimEnd()}\n\n${prompt}` : prompt;
}
