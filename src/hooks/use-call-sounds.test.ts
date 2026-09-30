import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const player = vi.hoisted(() => {
  const stop = vi.fn();
  return { stop, play: vi.fn(), loop: vi.fn(() => stop), unlock: vi.fn() };
});
vi.mock("@/lib/sounds/sound-player", () => ({ soundPlayer: player }));

import type { CallSoundStatus } from "@/lib/sounds/rules";
import { useCallSounds } from "./use-call-sounds";

function mount() {
  return renderHook(({ status, offered }: { status: CallSoundStatus; offered: boolean }) => useCallSounds(status, offered), {
    initialProps: { status: null as CallSoundStatus, offered: false },
  });
}

describe("useCallSounds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rings while a call is offered and stops once it is answered", () => {
    const hook = mount();
    hook.rerender({ status: null, offered: true });
    expect(player.loop).toHaveBeenCalledWith("incomingCall");
    hook.rerender({ status: null, offered: true });
    expect(player.loop).toHaveBeenCalledTimes(1);

    hook.rerender({ status: "answered", offered: false });
    expect(player.stop).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledWith("callConnected");
  });

  it("stops ringing when the offer is withdrawn", () => {
    const hook = mount();
    hook.rerender({ status: null, offered: true });
    hook.rerender({ status: null, offered: false });
    expect(player.stop).toHaveBeenCalledTimes(1);
    expect(player.play).not.toHaveBeenCalled();
  });

  it("marks the end of a live call", () => {
    const hook = mount();
    hook.rerender({ status: "ringing", offered: false });
    hook.rerender({ status: "ended", offered: false });
    expect(player.play).toHaveBeenCalledWith("callEnded");
  });

  it("never rings over a call in progress", () => {
    const hook = mount();
    hook.rerender({ status: "answered", offered: false });
    hook.rerender({ status: "answered", offered: true });
    expect(player.loop).not.toHaveBeenCalled();
  });

  it("stops ringing when the page goes away", () => {
    const hook = mount();
    hook.rerender({ status: null, offered: true });
    hook.unmount();
    expect(player.stop).toHaveBeenCalledTimes(1);
  });

  it("unlocks audio on the operator's first gesture", () => {
    mount();
    document.dispatchEvent(new Event("pointerdown"));
    expect(player.unlock).toHaveBeenCalled();
  });
});
