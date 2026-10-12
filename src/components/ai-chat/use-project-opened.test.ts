import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatView } from "@/lib/aichat/types";

const bridge = vi.hoisted(() => ({ announceProjectOpened: vi.fn() }));
const turns = vi.hoisted(() => ({ openThread: vi.fn() }));

vi.mock("./screen-bridge", () => bridge);
vi.mock("./chat-turns", () => turns);

import { useProjectOpenedNotice } from "./use-project-opened";

const editor: ChatView = { surface: "studio", projectId: "p1", projectKind: "image" };
const otherEditor: ChatView = { surface: "studio", projectId: "p2", projectKind: "image" };

interface Props {
  threadId: string | null;
  view?: ChatView;
  bound: string | null;
}

function mount(initial: Props) {
  return renderHook((props: Props) => useProjectOpenedNotice(props.threadId, props.view, "edit", props.bound), { initialProps: initial });
}

describe("useProjectOpenedNotice", () => {
  beforeEach(() => {
    bridge.announceProjectOpened.mockReset().mockResolvedValue("ignored");
    turns.openThread.mockReset().mockResolvedValue("loaded");
  });

  it("tells Elo once when the editor of the conversation's project is on screen", async () => {
    const hook = mount({ threadId: "th1", view: editor, bound: "p1" });
    await waitFor(() => expect(bridge.announceProjectOpened).toHaveBeenCalledTimes(1));
    expect(bridge.announceProjectOpened.mock.calls[0][0]).toBe("th1");
    expect(bridge.announceProjectOpened.mock.calls[0][1]).toMatchObject({ view: editor, mode: "edit" });
    hook.rerender({ threadId: "th1", view: { ...editor }, bound: "p1" });
    expect(bridge.announceProjectOpened).toHaveBeenCalledTimes(1);
  });

  it("stays quiet for another project, a conversation without one, or outside the studio", () => {
    const hook = mount({ threadId: "th1", view: otherEditor, bound: "p1" });
    hook.rerender({ threadId: "th1", view: editor, bound: null });
    hook.rerender({ threadId: "th1", view: undefined, bound: "p1" });
    hook.rerender({ threadId: null, view: editor, bound: "p1" });
    expect(bridge.announceProjectOpened).not.toHaveBeenCalled();
  });

  it("tells Elo again when the person comes back to the editor", async () => {
    const hook = mount({ threadId: "th1", view: editor, bound: "p1" });
    hook.rerender({ threadId: "th1", view: undefined, bound: "p1" });
    hook.rerender({ threadId: "th1", view: editor, bound: "p1" });
    await waitFor(() => expect(bridge.announceProjectOpened).toHaveBeenCalledTimes(2));
  });

  it("tells Elo again each time the tab with the editor becomes visible, and never while it is hidden", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    try {
      const hook = mount({ threadId: "th1", view: editor, bound: "p1" });
      await waitFor(() => expect(bridge.announceProjectOpened).toHaveBeenCalledTimes(1));
      visibility.mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      expect(bridge.announceProjectOpened).toHaveBeenCalledTimes(1);
      visibility.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      await waitFor(() => expect(bridge.announceProjectOpened).toHaveBeenCalledTimes(2));
      expect(bridge.announceProjectOpened.mock.calls[1][1]).toMatchObject({ view: editor, mode: "edit" });
      hook.rerender({ threadId: "th1", view: otherEditor, bound: "p1" });
      document.dispatchEvent(new Event("visibilitychange"));
      expect(bridge.announceProjectOpened).toHaveBeenCalledTimes(2);
      hook.unmount();
      document.dispatchEvent(new Event("visibilitychange"));
      expect(bridge.announceProjectOpened).toHaveBeenCalledTimes(2);
    } finally {
      visibility.mockRestore();
    }
  });

  it("follows the Elo answer that resumes when the tab becomes visible again", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      const hook = mount({ threadId: "th1", view: editor, bound: "p1" });
      await waitFor(() => expect(bridge.announceProjectOpened).toHaveBeenCalledTimes(1));
      bridge.announceProjectOpened.mockResolvedValue("resumed");
      document.dispatchEvent(new Event("visibilitychange"));
      await waitFor(() => expect(turns.openThread).toHaveBeenCalledWith("th1"));
      hook.unmount();
    } finally {
      visibility.mockRestore();
    }
  });

  it("follows the answer Elo resumes because the editor opened", async () => {
    bridge.announceProjectOpened.mockResolvedValue("resumed");
    mount({ threadId: "th1", view: editor, bound: "p1" });
    await waitFor(() => expect(turns.openThread).toHaveBeenCalledWith("th1"));
  });

  it("starts nothing when Elo only took the news inside her running answer", async () => {
    bridge.announceProjectOpened.mockResolvedValue("delivered");
    mount({ threadId: "th1", view: editor, bound: "p1" });
    await waitFor(() => expect(bridge.announceProjectOpened).toHaveBeenCalled());
    expect(turns.openThread).not.toHaveBeenCalled();
  });
});
