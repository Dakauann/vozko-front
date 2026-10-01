import { render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThreadAnchor } from "./use-thread-anchor";

let resize: () => void = () => {};

class FakeResizeObserver {
  constructor(callback: () => void) {
    resize = callback;
  }
  observe() {}
  disconnect() {}
}

interface Layout {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  tops: Record<string, number>;
}

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

function Thread({ layout, onReady }: { layout: Layout; onReady: (track: () => void, pinned: { current: boolean }, locked: { current: boolean }) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const lockedRef = useRef(false);
  const track = useThreadAnchor({ containerRef, contentRef, pinnedRef, lockedRef, threadKey: "t1" });
  useEffect(() => {
    onReady(track, pinnedRef, lockedRef);
  }, [onReady, track]);
  return (
    <div
      data-testid="container"
      ref={(node) => {
        containerRef.current = node;
        if (!node) return;
        Object.defineProperties(node, {
          scrollTop: { get: () => layout.scrollTop, configurable: true },
          scrollHeight: { get: () => layout.scrollHeight, configurable: true },
          clientHeight: { get: () => layout.clientHeight, configurable: true },
        });
        node.getBoundingClientRect = () => rect(0, layout.clientHeight);
        node.scrollTo = ((options: ScrollToOptions) => {
          layout.scrollTop = options.top ?? layout.scrollTop;
        }) as typeof node.scrollTo;
      }}
    >
      <div ref={contentRef}>
        {Object.keys(layout.tops).map((id) => (
          <div
            key={id}
            data-msg-id={id}
            ref={(node) => {
              if (node) node.getBoundingClientRect = () => rect(layout.tops[id] - layout.scrollTop, 100);
            }}
          />
        ))}
      </div>
    </div>
  );
}

describe("useThreadAnchor", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays at the bottom while media above finishes loading", () => {
    const layout: Layout = { scrollTop: 500, scrollHeight: 1000, clientHeight: 500, tops: { a: 0, b: 400, c: 900 } };
    render(<Thread layout={layout} onReady={() => {}} />);
    layout.scrollHeight = 1300;
    resize();
    expect(layout.scrollTop).toBe(1300);
  });

  it("keeps the message the reader is looking at still when content above grows", () => {
    const layout: Layout = { scrollTop: 300, scrollHeight: 2000, clientHeight: 500, tops: { a: 0, b: 250, c: 400 } };
    let track = () => {};
    render(<Thread layout={layout} onReady={(t) => (track = t)} />);
    track();
    layout.tops = { a: 0, b: 250 + 600, c: 400 + 600 };
    layout.scrollHeight = 2600;
    resize();
    expect(layout.scrollTop).toBe(900);
  });

  it("does not fight a deliberate jump to a searched message", () => {
    const layout: Layout = { scrollTop: 100, scrollHeight: 2000, clientHeight: 500, tops: { a: 0, b: 250 } };
    let locked = { current: false };
    render(<Thread layout={layout} onReady={(_, __, l) => (locked = l)} />);
    locked.current = true;
    layout.scrollHeight = 2400;
    resize();
    expect(layout.scrollTop).toBe(100);
  });
});
