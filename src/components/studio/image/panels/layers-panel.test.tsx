import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { emptyImageDocument, newShapeLayer, newTextLayer, type Layer, type StudioGroup } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";

import { createImageCommands } from "../commands";
import { createEditorUiStore, ImageEditorContext } from "../editor-state";
import { LayersPanel } from "./layers-panel";

const pt = ptMessages.studio.image.panels.layers;

function setup(layers: Layer[], groups?: StudioGroup[]) {
  const store = createStudioStore({ ...emptyImageDocument({ width: 100, height: 100 }), layers, ...(groups ? { groups } : {}) });
  const ui = createEditorUiStore();
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn() });
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectName: "Projeto" }}>
        <TooltipProvider><LayersPanel /></TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  return Object.assign(store, { ui });
}

describe("LayersPanel", () => {
  const rect = { ...newShapeLayer("rect"), id: "r" };
  const text = { ...newTextLayer("Oferta"), id: "t" };

  it("lists layers top first and selects on click", () => {
    const store = setup([rect, text]);
    const rows = screen.getAllByRole("button", { pressed: false }).filter((b) => b.getAttribute("aria-label")?.includes("camada"));
    expect(rows.map((r) => r.textContent)).toEqual(["Oferta", "Retângulo"]);
    fireEvent.click(rows[1]);
    expect(store.getState().selection).toEqual(["r"]);
  });

  it("locks, hides and reorders from the keyboard", () => {
    const store = setup([rect, text]);
    fireEvent.click(screen.getAllByRole("button", { name: pt.lock })[0]);
    expect(store.getState().document.layers[1].locked).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: pt.hide })[1]);
    expect(store.getState().document.layers[0].hidden).toBe(true);
    fireEvent.keyDown(screen.getByRole("button", { name: "Retângulo, camada 2 de 2" }), { key: "ArrowUp", altKey: true });
    expect(store.getState().document.layers.map((l) => l.id)).toEqual(["t", "r"]);
  });

  it("renames a layer and clears the name when left blank", () => {
    const store = setup([rect]);
    fireEvent.doubleClick(screen.getByRole("button", { name: "Retângulo, camada 1 de 1" }));
    const input = screen.getByRole("textbox", { name: pt.rename });
    fireEvent.change(input, { target: { value: "Fundo" } });
    fireEvent.blur(input);
    expect(store.getState().document.layers[0].name).toBe("Fundo");
    fireEvent.doubleClick(screen.getByRole("button", { name: "Fundo, camada 1 de 1" }));
    const again = screen.getByRole("textbox", { name: pt.rename });
    fireEvent.change(again, { target: { value: "  " } });
    fireEvent.blur(again);
    expect(store.getState().document.layers[0].name).toBeUndefined();
  });

  const row = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}, camada`) });

  it("selects ranges with Shift and toggles with Ctrl", () => {
    const store = setup([{ ...rect, id: "a" }, { ...rect, id: "b" }, { ...rect, id: "c" }, { ...text, id: "d" }]);
    const rows = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-label")?.includes(", camada"));
    fireEvent.click(rows[0]);
    fireEvent.click(rows[2], { shiftKey: true });
    expect(store.getState().selection).toEqual(["d", "c", "b"]);
    fireEvent.click(rows[1], { ctrlKey: true });
    expect(store.getState().selection).toEqual(["d", "b"]);
  });

  it("shows nested groups that collapse, and selects a whole group from its header", () => {
    const store = setup([{ ...rect, id: "a", groupId: "inner" }, { ...rect, id: "b", groupId: "inner" }, { ...text, id: "c", groupId: "outer" }], [{ id: "outer", name: "Cabeçalho" }, { id: "inner", parentId: "outer" }]);
    fireEvent.click(screen.getByRole("button", { name: /^Cabeçalho/ }));
    expect(store.getState().selection).toEqual(["c", "b", "a"]);
    fireEvent.click(screen.getByRole("button", { name: pt.collapse.replace("{name}", pt.groupName) }));
    expect(screen.queryAllByRole("button").filter((b) => b.getAttribute("aria-label")?.startsWith("Retângulo, camada"))).toHaveLength(0);
    expect(store.ui.getState().collapsedGroups).toEqual(["inner"]);
  });

  it("sets blend mode, opacity and clipping for the selection", () => {
    const store = setup([rect, text]);
    fireEvent.click(row("Oferta"));
    fireEvent.change(screen.getByRole("combobox", { name: pt.blendMode }), { target: { value: "multiply" } });
    expect(store.getState().document.layers[1].blendMode).toBe("multiply");
    const opacity = screen.getByLabelText(pt.opacity);
    fireEvent.change(opacity, { target: { value: "40" } });
    fireEvent.keyDown(opacity, { key: "Enter" });
    expect(store.getState().document.layers[1].transform.opacity).toBeCloseTo(0.4);
    fireEvent.click(screen.getByRole("button", { name: pt.clip }));
    expect(store.getState().document.layers[1].clip).toBe(true);
    fireEvent.change(screen.getByRole("combobox", { name: pt.blendMode }), { target: { value: "normal" } });
    expect(store.getState().document.layers[1].blendMode).toBeUndefined();
  });

  it("outlines the hovered layer on the canvas", () => {
    const store = setup([rect]);
    fireEvent.mouseEnter(row("Retângulo").closest("li") as HTMLElement);
    expect(store.ui.getState().hoverLayerId).toBe("r");
    fireEvent.mouseLeave(row("Retângulo").closest("li") as HTMLElement);
    expect(store.ui.getState().hoverLayerId).toBeNull();
  });
});
