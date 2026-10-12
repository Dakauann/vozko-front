import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveGestureContext, useColorDrag, type LiveGesture } from "./live-gesture";

function Swatch({ apply }: { apply: (raw: string) => void }) {
  return <input type="color" aria-label="cor" ref={useColorDrag("#000000", apply)} />;
}

function drag(input: HTMLElement, value: string) {
  (input as HTMLInputElement).value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("dragging a color", () => {
  let frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    frames = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => void (frames[id - 1] = () => undefined));
  });

  afterEach(() => vi.restoreAllMocks());

  const nextFrame = () => act(() => frames.splice(0).forEach((callback) => callback(0)));

  it("applies at most one color per frame and groups the whole drag into one gesture", () => {
    const apply = vi.fn();
    const gesture: LiveGesture = { begin: vi.fn(), end: vi.fn() };
    render(
      <LiveGestureContext.Provider value={gesture}>
        <Swatch apply={apply} />
      </LiveGestureContext.Provider>,
    );
    const input = screen.getByLabelText("cor");
    drag(input, "#100000");
    drag(input, "#200000");
    drag(input, "#300000");
    expect(apply).not.toHaveBeenCalled();
    nextFrame();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenLastCalledWith("#300000");
    drag(input, "#400000");
    fireEvent.change(input, { target: { value: "#500000" } });
    expect(apply).toHaveBeenLastCalledWith("#500000");
    expect(apply).toHaveBeenCalledTimes(2);
    expect(gesture.begin).toHaveBeenCalledTimes(1);
    expect(gesture.end).toHaveBeenCalledTimes(1);
  });

  it("applies a single pick right away and closes an open gesture when the field goes away", () => {
    const apply = vi.fn();
    const gesture: LiveGesture = { begin: vi.fn(), end: vi.fn() };
    const view = render(
      <LiveGestureContext.Provider value={gesture}>
        <Swatch apply={apply} />
      </LiveGestureContext.Provider>,
    );
    fireEvent.change(screen.getByLabelText("cor"), { target: { value: "#00ff00" } });
    expect(apply).toHaveBeenCalledWith("#00ff00");
    drag(screen.getByLabelText("cor"), "#0000ff");
    view.unmount();
    expect(apply).toHaveBeenLastCalledWith("#0000ff");
    expect(gesture.end).toHaveBeenCalledTimes(1);
  });
});
