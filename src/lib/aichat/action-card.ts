import type { ActionCard, CapabilityBlocker } from "./types";

export type CardState = "ready" | CapabilityBlocker;

export interface LiveCapacity {
  used: number;
  total: number;
  canAdd: boolean;
}

export interface CardContext {
  permitted: boolean;
  live?: LiveCapacity;
}

export interface CardView {
  state: CardState;
  usage?: { used: number; total: number };
}

export function cardState(card: ActionCard, context: CardContext): CardView {
  if (!context.permitted) return { state: "no_permission", usage: card.status?.usage };
  if (context.live) {
    const usage = { used: context.live.used, total: context.live.total };
    return { state: context.live.canAdd ? "ready" : "at_limit", usage };
  }
  if (!card.status) return { state: "ready" };
  if (card.status.canAdd) return { state: "ready", usage: card.status.usage };
  return { state: card.status.blocker ?? "unavailable", usage: card.status.usage };
}
