import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CircuitBoard, CircuitTraces, CircuitTracesWide } from "./circuit";

let observed: { callback: IntersectionObserverCallback; target: Element | null }[] = [];
let fired: Element[] = [];

beforeEach(() => {
  observed = [];
  fired = [];
  (SVGElement.prototype as unknown as { beginElement: () => void }).beginElement = function (this: Element) {
    fired.push(this);
  };
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private entry: { callback: IntersectionObserverCallback; target: Element | null };
      constructor(callback: IntersectionObserverCallback) {
        this.entry = { callback, target: null };
        observed.push(this.entry);
      }
      observe(target: Element) {
        this.entry.target = target;
      }
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function sparkOf(animation: Element) {
  return animation.closest(".vz-spark");
}

function seen(visible: boolean) {
  act(() => observed[0].callback([{ isIntersecting: visible } as IntersectionObserverEntry], {} as IntersectionObserver));
}

function tracePaths(container: HTMLElement) {
  return Array.from(container.querySelectorAll("path")).map((path) => path.getAttribute("d"));
}

describe("circuit ornaments", () => {
  it("keeps one shape for as long as it is on screen", () => {
    vi.useFakeTimers();
    const { container } = render(<CircuitBoard seed={42} />);
    const before = tracePaths(container);
    act(() => {
      observed[0].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      vi.advanceTimersByTime(120_000);
    });
    expect(tracePaths(container)).toEqual(before);
  });

  it("drives every trace with one spark: a hot core radiating glow, travelling as one", () => {
    for (const Ornament of [CircuitBoard, CircuitTraces, CircuitTracesWide]) {
      for (const dynamic of [true, false]) {
        const { container, unmount } = render(<Ornament seed={7} dynamic={dynamic} />);
        const sparks = Array.from(container.querySelectorAll(".vz-spark"));
        const traces = container.querySelectorAll("svg > path, svg > g:not(.vz-spark) > path").length;
        expect(sparks.length).toBeGreaterThan(0);
        expect(sparks.length).toBe(traces);
        for (const spark of sparks) {
          expect(spark.querySelectorAll(".vz-spark-core")).toHaveLength(1);
          expect(spark.querySelectorAll(".vz-spark-halo, .vz-spark-bloom").length).toBeGreaterThanOrEqual(2);
          expect(spark.querySelector(".vz-spark-trail")).not.toBeNull();
        }
        unmount();
      }
    }
  });

  it("draws no sparks when the pulse is off", () => {
    const { container } = render(<CircuitBoard seed={3} pulse={false} />);
    expect(container.querySelector(".vz-spark")).toBeNull();
  });

  it("pauses the current while off screen and resumes when seen", () => {
    const { container } = render(<CircuitTraces seed={9} />);
    const svg = container.querySelector("svg")!;
    const report = (isIntersecting: boolean) =>
      act(() => observed[0].callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(observed[0].target).toBe(svg);
    report(false);
    expect(svg).toHaveAttribute("data-paused");
    report(true);
    expect(svg).not.toHaveAttribute("data-paused");
  });

  it("never loops a spark on its own clock", () => {
    const { container } = render(<CircuitBoard seed={5} />);
    const animations = Array.from(container.querySelectorAll(".vz-spark animate, .vz-spark animateMotion"));
    expect(animations.length).toBeGreaterThan(0);
    for (const animation of animations) {
      expect(animation).toHaveAttribute("begin", "indefinite");
      expect(animation).not.toHaveAttribute("repeatCount");
    }
  });

  it("fires one whole spark at a time at irregular moments, never the same trace twice running", () => {
    vi.useFakeTimers();
    const { container } = render(<CircuitBoard seed={5} />);
    seen(true);
    const firings: { spark: Element | null; at: number }[] = [];
    for (let ms = 0; ms < 60_000; ms += 50) {
      const before = fired.length;
      act(() => vi.advanceTimersByTime(50));
      if (fired.length > before) firings.push({ spark: sparkOf(fired[before]), at: ms });
    }
    const perSpark = container.querySelector(".vz-spark")!.querySelectorAll("animate, animateMotion").length;
    expect(fired.length).toBe(firings.length * perSpark);
    expect(firings.length).toBeGreaterThan(10);
    expect(firings.length).toBeLessThan(80);
    const gaps = firings.slice(1).map((firing, index) => firing.at - firings[index].at);
    expect(new Set(gaps).size).toBeGreaterThan(3);
    for (let index = 1; index < firings.length; index++) expect(firings[index].spark).not.toBe(firings[index - 1].spark);
  });

  it("fires nothing while off screen", () => {
    vi.useFakeTimers();
    render(<CircuitTraces seed={9} />);
    seen(false);
    act(() => vi.advanceTimersByTime(30_000));
    expect(fired).toHaveLength(0);
    seen(true);
    act(() => vi.advanceTimersByTime(30_000));
    expect(fired.length).toBeGreaterThan(0);
  });
});
