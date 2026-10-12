import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDragResize, type ResizeEdge } from "./use-drag-resize";

function Handle({ edge, start, resizeTo, commit }: { edge: ResizeEdge; start: number; resizeTo: (next: number) => number; commit: (value: number) => void }) {
  const size = useRef(start);
  const { resizing, handleProps } = useDragResize({
    edge,
    step: 10,
    read: () => size.current,
    resizeTo: (next) => {
      size.current = resizeTo(next);
      return size.current;
    },
    commit,
  });
  return <div role="separator" tabIndex={0} aria-label="handle" data-resizing={String(resizing)} {...handleProps} />;
}

function mount(edge: ResizeEdge, resizeTo = (next: number) => next) {
  const spy = vi.fn(resizeTo);
  const commit = vi.fn();
  render(<Handle edge={edge} start={100} resizeTo={spy} commit={commit} />);
  return { handle: screen.getByRole("separator", { name: "handle" }), resizeTo: spy, commit };
}

afterEach(cleanup);

describe("useDragResize", () => {
  it("grows a top edge as the pointer moves up and saves once on release", () => {
    const { handle, resizeTo, commit } = mount("top");
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 0, clientY: 500 });
    expect(handle.dataset.resizing).toBe("true");
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300, clientY: 440 });
    expect(resizeTo).toHaveBeenLastCalledWith(160);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 530 });
    expect(resizeTo).toHaveBeenLastCalledWith(70);
    expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(70);
    expect(handle.dataset.resizing).toBe("false");
  });

  it("grows a left edge as the pointer moves left", () => {
    const { handle, resizeTo, commit } = mount("left");
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 800, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 760, clientY: 200 });
    expect(resizeTo).toHaveBeenLastCalledWith(140);
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(commit).toHaveBeenCalledWith(140);
  });

  it("saves the value the limits allowed, not the raw pointer distance", () => {
    const { handle, commit } = mount("top", (next) => Math.min(next, 120));
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 500 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(commit).toHaveBeenCalledWith(120);
  });

  it("ignores moves and releases without a press, and presses of other buttons", () => {
    const { handle, resizeTo, commit } = mount("top");
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerDown(handle, { pointerId: 1, button: 2, clientY: 500 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 });
    expect(resizeTo).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("steps with the arrow keys that point away from and toward the edge", () => {
    const top = mount("top");
    fireEvent.keyDown(top.handle, { key: "ArrowUp" });
    expect(top.commit).toHaveBeenLastCalledWith(110);
    fireEvent.keyDown(top.handle, { key: "ArrowDown" });
    fireEvent.keyDown(top.handle, { key: "ArrowDown" });
    expect(top.commit).toHaveBeenLastCalledWith(90);
    cleanup();
    const left = mount("left");
    fireEvent.keyDown(left.handle, { key: "ArrowLeft" });
    expect(left.commit).toHaveBeenLastCalledWith(110);
    fireEvent.keyDown(left.handle, { key: "ArrowRight" });
    expect(left.commit).toHaveBeenLastCalledWith(100);
  });

  it("leaves other keys alone", () => {
    const { handle, commit } = mount("top");
    const sideways = fireEvent.keyDown(handle, { key: "ArrowLeft" });
    const enter = fireEvent.keyDown(handle, { key: "Enter" });
    expect(sideways).toBe(true);
    expect(enter).toBe(true);
    expect(commit).not.toHaveBeenCalled();
  });
});
