/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  buildDialerRoster,
  initials,
  memberDisplayName,
  sortWithinGroup,
  type RosterMember,
} from "../presence-roster";
import type { DialerPresenceEntry } from "@/hooks/use-dialer-ws";
import type { WorkspaceMember } from "@/lib/workspace/types";

function member(
  userId: string,
  username: string,
  email: string,
): WorkspaceMember {
  return {
    id: `m-${userId}`,
    workspaceId: "ws-1",
    userId,
    role: "member" as WorkspaceMember["role"],
    email,
    username,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

describe("memberDisplayName", () => {
  it("prefers username", () => {
    expect(memberDisplayName({ username: "Ana", email: "ana@x.com" })).toBe("Ana");
  });
  it("falls back to email when username is blank (the 'Agente' bug)", () => {
    expect(memberDisplayName({ username: "", email: "ana@x.com" })).toBe("ana@x.com");
    expect(memberDisplayName({ username: "   ", email: "ana@x.com" })).toBe("ana@x.com");
    expect(memberDisplayName({ username: undefined, email: "ana@x.com" })).toBe("ana@x.com");
  });
  it("falls back to a dash when nothing is known", () => {
    expect(memberDisplayName({})).toBe("—");
  });
});

describe("initials", () => {
  it("uses first+last initials", () => {
    expect(initials("Ana Beatriz Costa")).toBe("AC");
  });
  it("uses two letters for a single token", () => {
    expect(initials("Ana")).toBe("AN");
  });
  it("degrades to ? for the unknown placeholder", () => {
    expect(initials("—")).toBe("?");
    expect(initials("")).toBe("?");
  });
});

describe("buildDialerRoster", () => {
  const members: WorkspaceMember[] = [
    member("u-ana", "Ana", "ana@x.com"),
    member("u-bru", "", "bru@x.com"), // blank username -> email fallback
    member("u-caio", "Caio", "caio@x.com"),
  ];
  const presence: DialerPresenceEntry[] = [
    { userId: "u-ana", username: "Ana", busy: false, hasBrowser: true, hasBranch: true },
    { userId: "u-bru", username: "", busy: true, hasBrowser: true, hasBranch: false },
    // u-caio absent -> offline
  ];

  it("derives status: online->available/busy, absent->offline", () => {
    const r = buildDialerRoster(presence, members, "u-ana");
    const byId = new Map(r.map((m) => [m.userId, m]));
    expect(byId.get("u-ana")?.status).toBe("available");
    expect(byId.get("u-bru")?.status).toBe("busy");
    expect(byId.get("u-caio")?.status).toBe("offline");
  });

  it("resolves names consistently (email fallback for blank username)", () => {
    const r = buildDialerRoster(presence, members, "u-ana");
    const byId = new Map(r.map((m) => [m.userId, m]));
    expect(byId.get("u-ana")?.name).toBe("Ana");
    expect(byId.get("u-bru")?.name).toBe("bru@x.com");
  });

  it("carries endpoint flags and marks self", () => {
    const r = buildDialerRoster(presence, members, "u-ana");
    const ana = r.find((m) => m.userId === "u-ana")!;
    expect(ana.hasBrowser).toBe(true);
    expect(ana.hasBranch).toBe(true);
    expect(ana.isSelf).toBe(true);
    expect(r.find((m) => m.userId === "u-caio")!.hasBrowser).toBe(false);
  });

  it("includes an online user missing from the member list", () => {
    const r = buildDialerRoster(
      [{ userId: "u-ghost", username: "Ghost", busy: false, hasBrowser: true, hasBranch: false }],
      [],
      "u-me",
    );
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("Ghost");
    expect(r[0].status).toBe("available");
  });
});

describe("sortWithinGroup", () => {
  it("pins self first, then sorts by name", () => {
    const list: RosterMember[] = [
      { userId: "c", name: "Caio", status: "available", hasBrowser: false, hasBranch: false, isSelf: false },
      { userId: "a", name: "Ana", status: "available", hasBrowser: false, hasBranch: false, isSelf: false },
      { userId: "me", name: "Zeca", status: "available", hasBrowser: false, hasBranch: false, isSelf: true },
    ];
    expect(sortWithinGroup(list).map((m) => m.userId)).toEqual(["me", "a", "c"]);
  });
});
