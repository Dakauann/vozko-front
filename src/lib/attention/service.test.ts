import { describe, expect, it, vi } from "vitest";

import { createAttention, type AttentionEnvironment } from "./service";
import type { AttentionSignal } from "./rules";

function environment(overrides: Partial<AttentionEnvironment> = {}): AttentionEnvironment {
  return {
    now: () => 50_000,
    view: () => ({ focused: false, visible: false, viewing: {}, soundMuted: false, desktopAllowed: true }),
    claim: vi.fn(() => Promise.resolve(true)),
    play: vi.fn(),
    show: vi.fn(),
    ...overrides,
  };
}

const signal: AttentionSignal = { id: "m-1", source: "team_message", group: "t-1", title: "Bia", body: "oi" };

describe("createAttention", () => {
  it("acts only after this tab claims the signal", async () => {
    const env = environment({ claim: vi.fn(() => Promise.resolve(false)) });
    await createAttention(env)(signal);
    expect(env.play).not.toHaveBeenCalled();
    expect(env.show).not.toHaveBeenCalled();
  });

  it("claims eagerly from a focused tab and lazily from a background one", async () => {
    const focused = environment({ view: () => ({ focused: true, visible: true, viewing: {}, soundMuted: false, desktopAllowed: true }) });
    await createAttention(focused)(signal);
    expect(focused.claim).toHaveBeenCalledWith("m-1", true);
    const background = environment();
    await createAttention(background)(signal);
    expect(background.claim).toHaveBeenCalledWith("m-1", false);
  });

  it("plays and shows what the rules plan, keeping the throttle between signals", async () => {
    const env = environment();
    const attend = createAttention(env);
    await attend(signal);
    await attend({ ...signal, id: "m-2" });
    expect(env.play).toHaveBeenCalledTimes(1);
    expect(env.play).toHaveBeenCalledWith("chime");
    expect(env.show).toHaveBeenCalledTimes(2);
    expect(vi.mocked(env.show).mock.calls[0][0]).toMatchObject({ tag: "team_message:t-1", signal });
  });
});
