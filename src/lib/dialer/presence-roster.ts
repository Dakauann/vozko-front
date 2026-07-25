import type { DialerPresenceEntry } from "@/hooks/use-dialer-ws";
import type { WorkspaceMember } from "@/lib/workspace/types";

// Shared roster model so the presence panel and the transfer picker render the
// exact same names, statuses, and endpoint badges. Divergence here is what
// produced the "Agente" fallback: the picker resolved names from `username`
// only, while members carry their identity in `email` when username is blank.

export type PresenceStatus = "available" | "busy" | "offline";

export interface RosterMember {
  userId: string;
  name: string;
  status: PresenceStatus;
  hasBrowser: boolean;
  hasBranch: boolean;
  isSelf: boolean;
}

export function memberDisplayName(m: {
  username?: string;
  email?: string;
}): string {
  const username = m.username?.trim();
  if (username) return username;
  const email = m.email?.trim();
  if (email) return email;
  return "—";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts[0] === "—") return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function buildDialerRoster(
  presence: DialerPresenceEntry[],
  members: WorkspaceMember[],
  selfUserId: string,
): RosterMember[] {
  const online = new Map(presence.map((p) => [p.userId, p]));
  const byId = new Map<string, RosterMember>();

  // Members are the source of names and the offline roster; live status is
  // layered on from the presence push.
  for (const m of members) {
    const p = online.get(m.userId);
    byId.set(m.userId, {
      userId: m.userId,
      name: memberDisplayName(m),
      status: p ? (p.busy ? "busy" : "available") : "offline",
      hasBrowser: p?.hasBrowser ?? false,
      hasBranch: p?.hasBranch ?? false,
      isSelf: m.userId === selfUserId,
    });
  }
  // A member can appear online before the member list refreshes; never hide
  // someone who is demonstrably connected.
  for (const p of presence) {
    if (byId.has(p.userId)) continue;
    byId.set(p.userId, {
      userId: p.userId,
      name: memberDisplayName({ username: p.username }),
      status: p.busy ? "busy" : "available",
      hasBrowser: p.hasBrowser,
      hasBranch: p.hasBranch,
      isSelf: p.userId === selfUserId,
    });
  }
  return Array.from(byId.values());
}

const STATUS_RANK: Record<PresenceStatus, number> = {
  available: 0,
  busy: 1,
  offline: 2,
};

// Self first (most relevant to the operator), then by name. Used within a
// status group whose members already share a status.
export function sortWithinGroup(list: RosterMember[]): RosterMember[] {
  return [...list].sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// Full priority sort: self, then available > busy > offline, then name.
export function sortRoster(list: RosterMember[]): RosterMember[] {
  return [...list].sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) {
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    }
    return a.name.localeCompare(b.name);
  });
}
