import type { MessageReaction } from "./types";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export interface ReactionGroup {
  emoji: string;
  count: number;
  reactions: MessageReaction[];
}

export type Reactor = { kind: "self" } | { kind: "name"; name: string } | { kind: "team" } | { kind: "contact" };

export interface ReactorPeople {
  selfId: string | null;
  memberNames: ReadonlyMap<string, string>;
  contactName: string;
}

export function groupReactions(reactions: readonly MessageReaction[] | undefined): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();
  for (const reaction of reactions ?? []) {
    const emoji = reaction.emoji?.trim();
    if (!emoji) continue;
    const group = groups.get(emoji) ?? { emoji, count: 0, reactions: [] };
    group.count += 1;
    group.reactions.push(reaction);
    groups.set(emoji, group);
  }
  return [...groups.values()];
}

export function reactionToSend(reactions: readonly MessageReaction[] | undefined, chosen: string): string {
  const ours = reactions?.find((reaction) => reaction.direction === "outbound")?.emoji;
  return ours === chosen ? "" : chosen;
}

export function reactorOf(reaction: MessageReaction, people: ReactorPeople): Reactor {
  if (reaction.direction === "inbound") {
    const contact = people.contactName.trim();
    return contact ? { kind: "name", name: contact } : { kind: "contact" };
  }
  if (reaction.actor_id && reaction.actor_id === people.selfId) return { kind: "self" };
  const name = reaction.actor_id ? people.memberNames.get(reaction.actor_id)?.trim() : undefined;
  return name ? { kind: "name", name } : { kind: "team" };
}
