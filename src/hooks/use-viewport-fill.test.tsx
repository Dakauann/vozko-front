import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useViewportFill } from "./use-viewport-fill";

let frameTop = 300;

function Frame() {
  const fill = useViewportFill();
  const attach = (node: HTMLDivElement | null) => {
    if (node) node.getBoundingClientRect = () => ({ top: frameTop }) as DOMRect;
    fill.ref(node);
  };
  return <div data-testid="frame" ref={attach} data-height={fill.height} />;
}

describe("useViewportFill", () => {
  afterEach(() => {
    frameTop = 300;
  });

  it("sizes the element to the viewport left under it and the containers' bottom insets", () => {
    render(
      <div style={{ paddingBottom: "24px" }}>
        <section style={{ borderBottom: "1px solid black" }}>
          <Frame />
        </section>
      </div>,
    );
    expect(screen.getByTestId("frame").dataset.height).toBe("max(520px, calc(100dvh - 325px))");
  });

  it("measures again when the window resizes", () => {
    render(<Frame />);
    frameTop = 180;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("frame").dataset.height).toBe("max(520px, calc(100dvh - 180px))");
  });
});
