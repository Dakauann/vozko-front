import { afterEach, describe, expect, it, vi } from "vitest";

import { claimInBrowser, showInBrowser, type DesktopCopy } from "./browser";

const copy: DesktopCopy = {
  fallbackTitle: (source) => `novo:${source}`,
  summaryTitle: (source, count) => `${count} em ${source}`,
  summaryBody: (source) => `abra ${source}`,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("claimInBrowser", () => {
  it("lets every tab act when the browser has no Web Locks", async () => {
    vi.stubGlobal("navigator", {});
    expect(await claimInBrowser("a", true)).toBe(true);
  });

  it("lets exactly one tab claim a signal", async () => {
    const held = new Set<string>();
    const locks = {
      request: vi.fn((name: string, _options: unknown, callback: (lock: unknown) => unknown) => {
        if (held.has(name)) return Promise.resolve(callback(null));
        held.add(name);
        return Promise.resolve(callback({ name }));
      }),
    };
    vi.stubGlobal("navigator", { locks });
    const first = await claimInBrowser("m-1", true);
    const second = await claimInBrowser("m-1", true);
    expect([first, second]).toEqual([true, false]);
  });
});

describe("showInBrowser", () => {
  it("shows a silent notification tagged by group and opens the target on click", () => {
    const shown: { title: string; options: NotificationOptions; onclick?: () => void; close: () => void }[] = [];
    class FakeNotification {
      onclick?: () => void;
      close = vi.fn();
      constructor(public title: string, public options: NotificationOptions) {
        shown.push(this as never);
      }
    }
    vi.stubGlobal("Notification", FakeNotification);
    const focus = vi.spyOn(window, "focus").mockImplementation(() => undefined);
    const open = vi.fn();
    showInBrowser(
      { tag: "team_message:t-1", title: "Bia", body: "oi", requireInteraction: false, signal: { id: "m", source: "team_message", group: "t-1", title: "Bia", body: "oi", open } },
      copy,
      "/icon.png",
      (signal) => signal.open?.(),
    );
    expect(shown[0].title).toBe("Bia");
    expect(shown[0].options).toMatchObject({ body: "oi", tag: "team_message:t-1", silent: true, icon: "/icon.png" });
    shown[0].onclick?.();
    expect(focus).toHaveBeenCalled();
    expect(open).toHaveBeenCalled();
  });

  it("writes the summary copy for a burst and a fallback title when none came", () => {
    const titles: string[] = [];
    vi.stubGlobal(
      "Notification",
      class {
        close = vi.fn();
        constructor(title: string) {
          titles.push(title);
        }
      },
    );
    showInBrowser({ tag: "summary:team_message", title: "", body: "", requireInteraction: false, summary: { source: "team_message", count: 7 } }, copy, "");
    showInBrowser({ tag: "notification:n", title: "", body: "x", requireInteraction: false }, copy, "");
    expect(titles).toEqual(["7 em team_message", "novo:notification"]);
  });
});
