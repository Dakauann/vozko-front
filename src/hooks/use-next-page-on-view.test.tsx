import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNextPageOnView } from "./use-next-page-on-view";

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void;

class FakeObserver {
  static instances: FakeObserver[] = [];
  readonly callback: Callback;
  readonly options: IntersectionObserverInit | undefined;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: Callback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeObserver.instances.push(this);
  }

  observe(node: Element) {
    this.observed.push(node);
  }
  disconnect() {
    this.disconnected = true;
  }
  emit(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

interface ProbeProps {
  hasNextPage: boolean;
  busy: boolean;
  auto: boolean;
  pageCount: number;
  fetchNextPage: () => unknown;
}

function Probe(props: ProbeProps) {
  const ref = useNextPageOnView<HTMLDivElement>(props);
  return <div ref={ref} data-testid="sentinel" />;
}

const live = () => FakeObserver.instances.filter((observer) => !observer.disconnected);

describe("useNextPageOnView", () => {
  beforeEach(() => vi.stubGlobal("IntersectionObserver", FakeObserver));
  afterEach(() => {
    FakeObserver.instances = [];
    vi.unstubAllGlobals();
  });

  it("asks for the next page when the end of the list comes near, 400px ahead", () => {
    const fetchNextPage = vi.fn();
    render(<Probe hasNextPage busy={false} auto pageCount={1} fetchNextPage={fetchNextPage} />);

    expect(live()).toHaveLength(1);
    expect(live()[0].options?.rootMargin).toBe("400px 0px");
    act(() => live()[0].emit(false));
    expect(fetchNextPage).not.toHaveBeenCalled();
    act(() => live()[0].emit(true));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("asks only once per page, then again once the page has arrived and the end is still in sight", () => {
    const fetchNextPage = vi.fn();
    const { rerender } = render(<Probe hasNextPage busy={false} auto pageCount={1} fetchNextPage={fetchNextPage} />);
    act(() => live()[0].emit(true));
    rerender(<Probe hasNextPage busy auto pageCount={1} fetchNextPage={fetchNextPage} />);
    expect(live()).toHaveLength(0);

    rerender(<Probe hasNextPage busy={false} auto pageCount={2} fetchNextPage={fetchNextPage} />);
    expect(live()).toHaveLength(1);
    act(() => live()[0].emit(true));
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it("watches nothing when there is no next page, while loading, or when loading by itself is paused", () => {
    const fetchNextPage = vi.fn();
    const { rerender } = render(<Probe hasNextPage={false} busy={false} auto pageCount={1} fetchNextPage={fetchNextPage} />);
    expect(live()).toHaveLength(0);
    rerender(<Probe hasNextPage busy auto pageCount={1} fetchNextPage={fetchNextPage} />);
    expect(live()).toHaveLength(0);
    rerender(<Probe hasNextPage busy={false} auto={false} pageCount={1} fetchNextPage={fetchNextPage} />);
    expect(live()).toHaveLength(0);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("leaves paging to the button in a browser without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const fetchNextPage = vi.fn();
    render(<Probe hasNextPage busy={false} auto pageCount={1} fetchNextPage={fetchNextPage} />);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
