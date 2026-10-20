import { afterEach, describe, expect, it } from "vitest";

import { viewingNow } from "@/lib/attention/signal";

import { closeTeamChat, openTeamChat, showTeamChatList, startNewTeamChat, teamChatPanel, toggleTeamChat } from "./panel";

afterEach(() => closeTeamChat());

describe("team chat panel", () => {
  it("opens on the list, on a thread or on the new chat form", () => {
    openTeamChat();
    expect(teamChatPanel()).toEqual({ open: true, view: "list", threadId: null });
    openTeamChat("t-1");
    expect(teamChatPanel()).toEqual({ open: true, view: "thread", threadId: "t-1" });
    startNewTeamChat();
    expect(teamChatPanel()).toEqual({ open: true, view: "new", threadId: null });
    showTeamChatList();
    expect(teamChatPanel().view).toBe("list");
  });

  it("toggles closed and open", () => {
    toggleTeamChat();
    expect(teamChatPanel().open).toBe(true);
    toggleTeamChat();
    expect(teamChatPanel().open).toBe(false);
  });

  it("tells the attention service which thread is on screen", () => {
    openTeamChat("t-7");
    expect(viewingNow().team_message).toBe("t-7");
    showTeamChatList();
    expect(viewingNow().team_message).toBeNull();
    openTeamChat("t-7");
    closeTeamChat();
    expect(viewingNow().team_message).toBeNull();
  });
});
