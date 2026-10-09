import { describe, expect, it } from "vitest";

import { emptyArtboard, type Layer } from "./document";
import { pathBounds } from "./path-nodes";
import { importSvg, isSvgText } from "./svg-import";
import { surfaceIssue } from "./validate";
import { layerSubpaths, unitToCanvas } from "./vector-layer";

const canvas = { width: 1000, height: 1000 };

function svg(body: string, attrs = 'viewBox="0 0 100 100"') {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
}

function imported(text: string) {
  const result = importSvg(text, canvas, { name: "logo" });
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

function canvasBounds(layer: Layer) {
  const subpaths = layerSubpaths(layer).map((s) => ({ ...s, nodes: s.nodes.map((n) => ({ ...n, ...unitToCanvas(layer.transform, canvas, n) })) }));
  return pathBounds(subpaths.map((s) => ({ closed: s.closed, nodes: s.nodes.map(({ x, y }) => ({ x, y })) })));
}

function close(a: number, b: number, digits = 3) {
  expect(a).toBeCloseTo(b, digits);
}

describe("importSvg", () => {
  it("turns each shape into a path layer, fitted into 60% of the canvas", () => {
    const { layers, groups, skipped } = imported(svg('<rect x="0" y="0" width="100" height="100" fill="#ff0000"/><circle cx="50" cy="50" r="25" fill="#00f"/>'));
    expect(layers).toHaveLength(2);
    expect(skipped).toBe(0);
    expect(layers.map((l) => l.fill)).toEqual(["#ff0000", "#0000ff"]);
    const square = canvasBounds(layers[0]);
    close(square.left, 200);
    close(square.right, 800);
    const dot = canvasBounds(layers[1]);
    close(dot.left, 350);
    close(dot.right, 650);
    expect(groups).toEqual([{ id: layers[0].groupId, name: "logo" }]);
    expect(surfaceIssue({ ...emptyArtboard(canvas), layers, groups })).toBeNull();
  });

  it("applies nested group transforms", () => {
    const { layers } = imported(svg('<g transform="translate(50 0)"><g transform="scale(0.5)"><rect width="100" height="100"/></g></g>'));
    const box = canvasBounds(layers[0]);
    close(box.left, 500);
    close(box.right, 800);
    close(box.bottom, 500);
  });

  it("reads styles from attributes, inline style, classes and inheritance", () => {
    const text = svg(
      '<style>.accent{fill:#e10600}.outline{fill:none;stroke:#111111;stroke-width:4}</style><g fill="#00ff00" opacity="0.5"><rect width="10" height="10"/><rect class="accent" x="20" width="10" height="10"/><path class="outline" d="M0 50 L100 50"/><rect x="40" width="10" height="10" style="fill:rgb(0, 0, 255);fill-opacity:0.5"/></g>',
    );
    const { layers } = imported(text);
    expect(layers.map((l) => l.fill)).toEqual(["#00ff00", "#e10600", undefined, "#0000ff80"]);
    expect(layers.every((l) => l.transform.opacity === 0.5)).toBe(true);
    expect(layers[2]).toMatchObject({ stroke: "#111111" });
    expect(layers[2].strokeWidth).toBeCloseTo(24);
  });

  it("keeps the even-odd rule, maps gradients and resolves use", () => {
    const text = svg(
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient><rect id="tile" width="10" height="10"/></defs><path fill-rule="evenodd" fill="url(#g)" d="M0 0 H100 V100 H0 Z M30 30 H70 V70 H30 Z"/><use href="#tile" x="80" y="80"/>',
    );
    const { layers } = imported(text);
    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatchObject({ fillRule: "evenodd", gradient: { from: "#ff0000", to: "#0000ff", angle: 0 } });
    close(canvasBounds(layers[1]).left, 680);
  });

  it("counts what it cannot import and refuses broken or empty files", () => {
    expect(imported(svg('<rect width="10" height="10"/><text x="0" y="0">Oi</text><image href="a.png"/>')).skipped).toBe(2);
    expect(importSvg("<svg", canvas)).toEqual({ ok: false, reason: "invalid" });
    expect(importSvg("<html></html>", canvas)).toEqual({ ok: false, reason: "invalid" });
    expect(importSvg(svg('<text x="0" y="0">Oi</text>'), canvas)).toEqual({ ok: false, reason: "empty" });
  });

  it("fits into a target box, so a trace lands exactly on its image", () => {
    const result = importSvg(svg('<rect width="200" height="100" fill="#000"/>', 'viewBox="0 0 200 100"'), canvas, { target: { center: { x: 300, y: 400 }, width: 400, height: 200, rotation: 0 } });
    if (!result.ok) throw new Error(result.reason);
    const box = canvasBounds(result.value.layers[0]);
    close(box.left, 100);
    close(box.right, 500);
    close(box.top, 300);
    close(box.bottom, 500);
  });

  it("uses width and height when there is no viewBox", () => {
    const { layers } = imported(svg('<rect width="50" height="50"/>', 'width="100" height="100"'));
    close(canvasBounds(layers[0]).right, 500);
  });
});

describe("isSvgText", () => {
  it("recognizes pasted svg code, with or without an xml prolog", () => {
    expect(isSvgText('  <svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe(true);
    expect(isSvgText('<?xml version="1.0"?>\n<svg></svg>')).toBe(true);
    expect(isSvgText("Promoção de sexta")).toBe(false);
    expect(isSvgText("<div><svg></svg></div>")).toBe(false);
  });
});
