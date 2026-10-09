import { describe, expect, it } from "vitest";

import { GLIDE_MS } from "@/lib/studio/agent/follow";

import { AgentFollower } from "./agent-follow";
import { createVideoViewStore } from "./view-store";

function setup(reduceMotion = false) {
  const view = createVideoViewStore();
  let now = 0;
  let queued: (() => void)[] = [];
  const follower = new AgentFollower({
    view,
    seek: (ms) => view.setState({ playheadMs: Math.round(ms) }),
    frames: {
      request: (callback) => queued.push(callback),
      cancel: (handle) => {
        queued[handle - 1] = () => undefined;
      },
    },
    now: () => now,
    reduceMotion: () => reduceMotion,
  });
  const detach = follower.attach();
  const frame = (ms: number) => {
    now += ms;
    const run = queued;
    queued = [];
    run.forEach((callback) => callback());
  };
  return { view, follower, frame, detach };
}

describe("following Elo's edits", () => {
  it("glides the playhead to where she works and keeps the timeline on it while gliding", () => {
    const { view, follower, frame } = setup();
    follower.toward(3000);
    frame(GLIDE_MS / 3);
    const midway = view.getState().playheadMs;
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(3000);
    expect(view.getState().agentFollowing).toBe(true);
    frame(GLIDE_MS);
    expect(view.getState()).toMatchObject({ playheadMs: 3000, agentFollowing: false });
  });

  it("jumps straight there when motion is reduced", () => {
    const { view, follower } = setup(true);
    follower.toward(2000);
    expect(view.getState().playheadMs).toBe(2000);
  });

  it("stops following once the person moves the playhead or plays, until the next reply", () => {
    const { view, follower, frame } = setup();
    follower.toward(3000);
    frame(GLIDE_MS / 3);
    view.setState({ playheadMs: 500 });
    frame(GLIDE_MS);
    expect(view.getState()).toMatchObject({ playheadMs: 500, agentFollowing: false });
    follower.toward(8000);
    frame(GLIDE_MS);
    expect(view.getState().playheadMs).toBe(500);
    follower.resume();
    follower.toward(8000);
    frame(GLIDE_MS * 2);
    expect(view.getState().playheadMs).toBe(8000);
    view.setState({ playing: true });
    follower.toward(1000);
    frame(GLIDE_MS * 2);
    expect(view.getState().playheadMs).toBe(8000);
  });

  it("lets go of the view when detached", () => {
    const { view, follower, frame, detach } = setup();
    follower.toward(3000);
    detach();
    frame(GLIDE_MS * 2);
    expect(view.getState().playheadMs).toBeLessThan(3000);
    expect(view.getState().agentFollowing).toBe(false);
  });
});
