import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { CENTERED_RADIAL, newIconLayer, newShapeLayer, newTextLayer, type Layer } from "@/lib/studio/document";
import { DEFAULT_GRADIENT, DEFAULT_HIGHLIGHT } from "@/lib/studio/layer-effects";

import { LayerStyleFields, type LayerChange } from "./layer-style-fields";

const pt = ptMessages.studio;

function setup(initial: Layer[]) {
  let layers = initial;
  const onChange = (change: LayerChange) => {
    layers = layers.map((layer) => ({ ...layer, ...change(layer) }));
    view.rerender(ui());
    return true;
  };
  const ui = () => (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <TooltipProvider>
        <LayerStyleFields layers={layers} onChange={onChange} />
      </TooltipProvider>
    </NextIntlClientProvider>
  );
  const view = render(ui());
  return { layers: () => layers };
}

describe("video layer style fields", () => {
  it("turns a text fill into a gradient that starts from its color, with a middle color and a radial center", () => {
    const editor = setup([{ ...newTextLayer("Oferta"), id: "t", fill: "#112233" }]);
    fireEvent.click(screen.getByRole("checkbox", { name: pt.image.inspector.gradient.toggle }));
    expect(editor.layers()[0].gradient).toEqual({ from: "#112233", to: DEFAULT_GRADIENT.to, angle: DEFAULT_GRADIENT.angle });
    expect(screen.queryByRole("textbox", { name: pt.video.layer.fill })).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: pt.video.layer.gradientVia }));
    expect(editor.layers()[0].gradient?.via).toMatch(/^#[0-9a-f]{6}$/);

    fireEvent.change(screen.getByRole("combobox", { name: pt.image.inspector.gradient.kind }), { target: { value: "radial" } });
    expect(editor.layers()[0].gradient).toMatchObject({ kind: "radial", ...CENTERED_RADIAL });
    expect(screen.getByRole("textbox", { name: pt.image.inspector.gradient.radius })).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: pt.image.inspector.gradient.toggle }));
    expect(editor.layers()[0].gradient).toBeUndefined();
  });

  it("curves text and gives it a highlight box, which a curved text cannot use", () => {
    const editor = setup([{ ...newTextLayer("Oferta"), id: "t" }]);
    fireEvent.click(screen.getByRole("checkbox", { name: pt.image.inspector.text.highlight }));
    expect(editor.layers()[0].highlight).toEqual(DEFAULT_HIGHLIGHT);

    const curve = screen.getByRole("textbox", { name: pt.image.inspector.text.curve });
    fireEvent.change(curve, { target: { value: "40" } });
    fireEvent.blur(curve);
    expect(editor.layers()[0].curve).toBeCloseTo(0.4, 5);
    expect(screen.getByRole("checkbox", { name: pt.image.inspector.text.highlight })).toHaveProperty("disabled", true);
    expect(screen.getByText(pt.image.inspector.text.highlightCurved)).toBeTruthy();
  });

  it("blends any overlay with what is underneath, and normal clears the mode", () => {
    const editor = setup([{ ...newIconLayer("heart"), id: "i" }]);
    const blend = screen.getByRole("combobox", { name: pt.image.panels.layers.blendMode });
    fireEvent.change(blend, { target: { value: "screen" } });
    expect(editor.layers()[0].blendMode).toBe("screen");
    fireEvent.change(blend, { target: { value: "normal" } });
    expect(editor.layers()[0].blendMode).toBeUndefined();
    expect(screen.queryByRole("checkbox", { name: pt.image.inspector.gradient.toggle })).toBeNull();
  });

  it("shows a mixed gradient state for a selection that disagrees and applies one change to all", () => {
    const editor = setup([
      { ...newShapeLayer("rect"), id: "a", fill: "#ff0000", gradient: { from: "#ff0000", to: "#000000", angle: 45 } },
      { ...newShapeLayer("rect"), id: "b", fill: "#00ff00" },
    ]);
    const toggle = screen.getByRole("checkbox", { name: pt.image.inspector.gradient.toggle }) as HTMLInputElement;
    expect(toggle.indeterminate).toBe(true);
    fireEvent.click(toggle);
    expect(editor.layers().map((l) => l.gradient?.from)).toEqual(["#ff0000", "#00ff00"]);
  });
});
