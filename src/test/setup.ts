import "@testing-library/jest-dom/vitest";

/**
 * jsdom ships no ResizeObserver, and Radix's popper-based primitives (Popover,
 * Select, Tooltip, DropdownMenu) construct one on open. Without it, any test
 * that opens one dies with "ResizeObserver is not defined" — a jsdom gap, not a
 * product bug, so it belongs here rather than re-stubbed in each test file.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Same story: Radix guards several interactions behind these, and jsdom
// implements neither on Element.
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}
