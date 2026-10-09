import { afterEach, describe, expect, it } from "vitest";

import { VIEWPORT_FILL_MIN_PX, documentTop, trailingInset, viewportFillHeight } from "./viewport-fill";

describe("viewportFillHeight", () => {
  it("takes the viewport height left under the offset above and the inset below, never under the minimum", () => {
    expect(viewportFillHeight({ top: 300, bottom: 25 }, 520)).toBe("max(520px, calc(100dvh - 325px))");
  });

  it("rounds the measured offsets up to whole pixels so the page never scrolls by a fraction", () => {
    expect(viewportFillHeight({ top: 300.2, bottom: 24.1 }, 520)).toBe("max(520px, calc(100dvh - 325px))");
  });

  it("never adds height for a negative offset", () => {
    expect(viewportFillHeight({ top: -40, bottom: 0 }, 520)).toBe("max(520px, calc(100dvh - 0px))");
  });

  it("keeps a sensible minimum by default", () => {
    expect(VIEWPORT_FILL_MIN_PX).toBe(520);
  });
});

describe("documentTop", () => {
  afterEach(() => {
    window.scrollY = 0;
  });

  it("measures from the top of the document, not of the scrolled viewport", () => {
    const element = document.createElement("div");
    element.getBoundingClientRect = () => ({ top: 120 }) as DOMRect;
    Object.defineProperty(window, "scrollY", { value: 80, configurable: true, writable: true });
    expect(documentTop(element)).toBe(200);
  });
});

describe("trailingInset", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("adds up the bottom padding, border and margin of every container around the element", () => {
    document.body.innerHTML = `
      <div style="padding-bottom: 24px">
        <main style="margin-bottom: 4px">
          <section style="border-bottom: 1px solid black">
            <div id="frame" style="padding-bottom: 100px"></div>
          </section>
        </main>
      </div>`;
    expect(trailingInset(document.getElementById("frame"))).toBe(29);
  });

  it("is zero for a detached element", () => {
    expect(trailingInset(null)).toBe(0);
  });
});
