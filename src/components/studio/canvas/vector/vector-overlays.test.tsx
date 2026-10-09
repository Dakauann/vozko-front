import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { Layer } from "@/lib/studio/document";
import { layerSubpaths } from "@/lib/studio/vector-layer";

import { DrawOverlay } from "./draw-overlay";
import { PathEditOverlay } from "./path-edit-overlay";
import { PenOverlay } from "./pen-overlay";

const canvas = { width: 1000, height: 500 };
const flat = { scale: 1, x: 0, y: 0 };

function wrap(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

function tap(target: Element, x: number, y: number) {
  fireEvent.pointerDown(target, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  fireEvent.pointerUp(target, { clientX: x, clientY: y, pointerId: 1, button: 0 });
}

describe("PenOverlay", () => {
  it("collects clicks in canvas pixels and finishes on Enter", () => {
    const onCreate = vi.fn();
    const { container } = wrap(<PenOverlay view={{ scale: 2, x: 10, y: 20 }} onCreate={onCreate} onCancel={vi.fn()} />);
    const surface = container.querySelector("svg")!;
    tap(surface, 30, 40);
    tap(surface, 230, 40);
    tap(surface, 230, 240);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onCreate).toHaveBeenCalledWith({ closed: false, nodes: [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 110 }] });
  });

  it("closes on the first point and cancels when nothing was drawn", () => {
    const onCreate = vi.fn();
    const onCancel = vi.fn();
    const { container } = wrap(<PenOverlay view={flat} onCreate={onCreate} onCancel={onCancel} />);
    const surface = container.querySelector("svg")!;
    tap(surface, 0, 0);
    tap(surface, 100, 0);
    tap(surface, 50, 80);
    tap(surface, 1, 1);
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ closed: true }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("DrawOverlay", () => {
  it("turns a stroke into a path in canvas pixels", () => {
    const onCreate = vi.fn();
    const { container } = wrap(<DrawOverlay view={flat} onCreate={onCreate} />);
    const surface = container.querySelector("svg")!;
    fireEvent.pointerDown(surface, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    for (let x = 10; x <= 100; x += 10) fireEvent.pointerMove(surface, { clientX: x, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 100, clientY: 0, pointerId: 1 });
    expect(onCreate).toHaveBeenCalledWith({ closed: false, nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
  });
});

describe("PathEditOverlay", () => {
  const square: Layer = { id: "p", type: "shape", shape: "path", path: "M0 0 L1 0 L1 1 L0 1 Z", fill: "#000000", transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.4, rotation: 0, opacity: 1 } };
  const point = ptMessages.studio.vectors.edit.node;

  function setup(layer: Layer = square) {
    const calls = { begin: vi.fn(), change: vi.fn(), end: vi.fn(), exit: vi.fn() };
    wrap(<PathEditOverlay layer={layer} canvas={canvas} view={flat} onBegin={calls.begin} onChange={calls.change} onEnd={calls.end} onExit={calls.exit} />);
    return calls;
  }

  it("drags a point and refits the box around the new shape", () => {
    const calls = setup();
    const corner = screen.getByLabelText(point.replace("{index}", "2"));
    fireEvent.pointerDown(corner, { clientX: 550, clientY: 150, pointerId: 1, button: 0 });
    fireEvent.pointerMove(corner, { clientX: 650, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(corner, { clientX: 650, clientY: 150, pointerId: 1 });
    expect(calls.begin).toHaveBeenCalledTimes(1);
    expect(calls.end).toHaveBeenCalledTimes(1);
    const patch = calls.change.mock.calls.at(-1)![0];
    expect(patch.transform.w).toBeCloseTo(0.3);
    expect(layerSubpaths({ ...square, ...patch })[0].nodes).toHaveLength(4);
  });

  it("deletes the selected point with Delete and leaves on Escape", () => {
    const calls = setup();
    fireEvent.pointerDown(screen.getByLabelText(point.replace("{index}", "3")), { clientX: 550, clientY: 350, pointerId: 1, button: 0 });
    fireEvent.pointerUp(screen.getByLabelText(point.replace("{index}", "3")), { clientX: 550, clientY: 350, pointerId: 1 });
    fireEvent.keyDown(window, { key: "Delete" });
    const patch = calls.change.mock.calls.at(-1)![0];
    expect(layerSubpaths({ ...square, ...patch })[0].nodes).toHaveLength(3);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(calls.exit).toHaveBeenCalled();
  });

  it("turns a corner into a curve on double click", () => {
    const calls = setup();
    fireEvent.doubleClick(screen.getByLabelText(point.replace("{index}", "1")));
    const patch = calls.change.mock.calls.at(-1)![0];
    const node = layerSubpaths({ ...square, ...patch })[0].nodes[0];
    expect(node.in && node.out).toBeTruthy();
  });
});
