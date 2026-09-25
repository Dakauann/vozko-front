import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useInView } from "./use-in-view";

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void;

class FakeObserver {
  static instances: FakeObserver[] = [];
  readonly options: IntersectionObserverInit | undefined;
  readonly callback: Callback;
  disconnected = false;

  constructor(callback: Callback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeObserver.instances.push(this);
  }

  observe() {}
  disconnect() {
    this.disconnected = true;
  }
  emit(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

function Probe() {
  const [ref, inView] = useInView<HTMLDivElement>();
  return <div ref={ref}>{inView ? "visible" : "hidden"}</div>;
}

describe("useInView", () => {
  afterEach(() => {
    FakeObserver.instances = [];
    vi.unstubAllGlobals();
  });

  it("stays hidden until the element approaches the viewport", () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<Probe />);
    expect(screen.getByText("hidden")).toBeInTheDocument();
    expect(FakeObserver.instances[0].options?.rootMargin).toBe("400px 0px");

    act(() => FakeObserver.instances[0].emit(true));
    expect(screen.getByText("visible")).toBeInTheDocument();
  });

  it("stays visible after scrolling away, so a loaded section is never torn down", () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<Probe />);
    act(() => FakeObserver.instances[0].emit(true));
    expect(FakeObserver.instances[0].disconnected).toBe(true);
    expect(screen.getByText("visible")).toBeInTheDocument();
  });

  it("treats a browser without IntersectionObserver as visible", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getByText("visible")).toBeInTheDocument();
  });
});
