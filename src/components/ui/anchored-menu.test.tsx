
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";

import { AnchoredMenu } from "./anchored-menu";

function rectOf(r: {
  top: number;
  left: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: r.left,
    y: r.top,
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    right: r.left + r.width,
    bottom: r.top + r.height,
    toJSON: () => ({}),
  } as DOMRect;
}

function Harness({
  rect,
  open = true,
  onClose = () => {},
  align,
  width = 208,
}: {
  rect: DOMRect;
  open?: boolean;
  onClose?: () => void;
  align?: "start" | "end";
  width?: number;
}) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div data-testid="column" style={{ overflowY: "auto" }}>
      <div data-testid="card" style={{ willChange: "transform" }}>
        <button
          type="button"
          ref={(el) => {
            anchorRef.current = el;
            if (el) el.getBoundingClientRect = () => rect;
          }}
        >
          Ações
        </button>
        <AnchoredMenu
          open={open}
          anchorRef={anchorRef}
          onClose={onClose}
          align={align}
          width={width}
          label="Ações da conversa"
        >
          <button type="button" role="menuitem">
            Mover para outro funil…
          </button>
        </AnchoredMenu>
      </div>
    </div>
  );
}

const ANCHOR = rectOf({ top: 180, left: 400, width: 24, height: 24 });

describe("AnchoredMenu", () => {
  it("renders nothing while closed", () => {
    render(<Harness rect={ANCHOR} open={false} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("escapes the card and the scrolling column it was trapped in", () => {
    render(<Harness rect={ANCHOR} />);

    const menu = screen.getByRole("menu");
    expect(screen.getByTestId("card").contains(menu)).toBe(false);
    expect(screen.getByTestId("column").contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
  });

  it("sits at the overlay layer, detached from the card's stacking context", () => {
    render(<Harness rect={ANCHOR} />);

    const menu = screen.getByRole("menu");
    expect(menu).toHaveStyle({ position: "fixed" });
    expect(menu.className).toContain("z-[200]");
  });

  it("hangs below the anchor, right edges lined up", () => {
    render(<Harness rect={ANCHOR} />);

    const menu = screen.getByRole("menu");
    expect(menu.style.top).toBe("210px");
    expect(menu.style.left).toBe("216px");
    expect(menu.style.width).toBe("208px");
  });

  it("aligns to the anchor's left edge when asked", () => {
    render(<Harness rect={ANCHOR} align="start" />);

    expect(screen.getByRole("menu").style.left).toBe("400px");
  });

  it("flips above the anchor when the card sits at the bottom of the screen", () => {
    render(<Harness rect={rectOf({ top: 700, left: 400, width: 24, height: 24 })} />);

    const menu = screen.getByRole("menu");
    expect(menu.style.top).toBe("");
    expect(menu.style.bottom).toBe("74px");
  });

  it("stays inside the viewport when the anchor hugs the right edge", () => {
    render(<Harness rect={rectOf({ top: 180, left: 1010, width: 24, height: 24 })} />);

    expect(screen.getByRole("menu").style.left).toBe("808px");
  });

  it("closes on a click outside and on Escape", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness rect={ANCHOR} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("anchored-menu-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<Harness rect={ANCHOR} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not leak a click through to the card that owns it", () => {
    const onCardClick = vi.fn();
    function Wrapper() {
      const anchorRef = useRef<HTMLButtonElement | null>(null);
      return (
        <div onClick={onCardClick}>
          <button
            type="button"
            ref={(el) => {
              anchorRef.current = el;
              if (el) el.getBoundingClientRect = () => ANCHOR;
            }}
          >
            Ações
          </button>
          <AnchoredMenu
            open
            anchorRef={anchorRef}
            onClose={() => {}}
            label="Ações da conversa"
          >
            <span>item</span>
          </AnchoredMenu>
        </div>
      );
    }
    render(<Wrapper />);

    fireEvent.click(screen.getByTestId("anchored-menu-backdrop"));
    fireEvent.click(screen.getByRole("menu"));
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
