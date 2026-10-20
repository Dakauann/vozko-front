import { describe, expect, it } from "vitest";

import {
  BURST_GROUP_LIMIT,
  BURST_WINDOW_MS,
  INITIAL_ATTENTION,
  SOUND_GAP_MS,
  planAttention,
  type AttentionSignal,
  type AttentionView,
} from "./rules";

function signal(overrides: Partial<AttentionSignal> = {}): AttentionSignal {
  return { id: "s-1", source: "team_message", group: "t-1", title: "Bia", body: "oi", ...overrides };
}

function view(overrides: Partial<AttentionView> = {}): AttentionView {
  return { now: 10_000, focused: false, visible: false, viewing: {}, soundMuted: false, desktopAllowed: true, ...overrides };
}

describe("planAttention", () => {
  it("plays a sound and shows a desktop notice when the page is in the background", () => {
    const plan = planAttention(INITIAL_ATTENTION, signal(), view());
    expect(plan.sound).toBe("chime");
    expect(plan.desktop).toMatchObject({ tag: "team_message:t-1", title: "Bia", body: "oi", requireInteraction: false });
  });

  it("keeps the customer message sound for customer messages", () => {
    expect(planAttention(INITIAL_ATTENTION, signal({ source: "customer_message" }), view()).sound).toBe("message");
  });

  it("stays silent for what the person is already looking at", () => {
    const plan = planAttention(INITIAL_ATTENTION, signal(), view({ focused: true, visible: true, viewing: { team_message: "t-1" } }));
    expect(plan.sound).toBeNull();
    expect(plan.desktop).toBeNull();
  });

  it("plays the sound but skips the desktop notice while the page has focus", () => {
    const plan = planAttention(INITIAL_ATTENTION, signal(), view({ focused: true, visible: true, viewing: { team_message: "t-2" } }));
    expect(plan.sound).toBe("chime");
    expect(plan.desktop).toBeNull();
  });

  it("never alerts for a quiet signal", () => {
    const plan = planAttention(INITIAL_ATTENTION, signal({ quiet: true }), view());
    expect(plan.sound).toBeNull();
    expect(plan.desktop).toBeNull();
  });

  it("honours the sound mute and the desktop choice separately", () => {
    expect(planAttention(INITIAL_ATTENTION, signal(), view({ soundMuted: true })).sound).toBeNull();
    expect(planAttention(INITIAL_ATTENTION, signal(), view({ desktopAllowed: false })).desktop).toBeNull();
  });

  it("plays one sound per burst", () => {
    const first = planAttention(INITIAL_ATTENTION, signal(), view());
    const second = planAttention(first.state, signal({ id: "s-2" }), view({ now: 10_000 + SOUND_GAP_MS - 1 }));
    const third = planAttention(second.state, signal({ id: "s-3" }), view({ now: 10_000 + SOUND_GAP_MS }));
    expect([first.sound, second.sound, third.sound]).toEqual(["chime", null, "chime"]);
  });

  it("collapses many conversations at once into one summary per source", () => {
    let state = INITIAL_ATTENTION;
    const notices = [];
    for (let i = 0; i <= BURST_GROUP_LIMIT; i++) {
      const plan = planAttention(state, signal({ id: `s-${i}`, group: `t-${i}` }), view({ now: 10_000 + i }));
      state = plan.state;
      notices.push(plan.desktop);
    }
    expect(notices.slice(0, BURST_GROUP_LIMIT).every((n) => n?.tag.startsWith("team_message:"))).toBe(true);
    expect(notices[BURST_GROUP_LIMIT]).toMatchObject({ tag: "summary:team_message", summary: { source: "team_message", count: BURST_GROUP_LIMIT + 1 } });
    const later = planAttention(state, signal({ id: "late", group: "t-9" }), view({ now: 10_000 + BURST_WINDOW_MS + 10 }));
    expect(later.desktop?.tag).toBe("team_message:t-9");
  });

  it("keeps critical notifications individual and on screen", () => {
    let state = INITIAL_ATTENTION;
    for (let i = 0; i <= BURST_GROUP_LIMIT; i++) {
      state = planAttention(state, signal({ id: `n-${i}`, source: "notification", group: `n-${i}` }), view({ now: 10_000 + i })).state;
    }
    const critical = planAttention(state, signal({ id: "c", source: "notification", group: "c", critical: true }), view({ now: 10_010 }));
    expect(critical.desktop).toMatchObject({ tag: "notification:c", requireInteraction: true });
  });
});
