import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import enMessages from "@/i18n/messages/en.json";
import ptMessages from "@/i18n/messages/pt.json";
import { chartInk, newChartSpec } from "@/lib/studio/chart";
import { imageDocument, type Artboard, type ImageDocument, type Layer } from "@/lib/studio/document";
import { settleImage } from "@/lib/studio/image-settle";
import { createStudioStore } from "@/lib/studio/store";

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({ fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }), listLibraryAction: vi.fn().mockResolvedValue({ data: [] }), uploadMediaAction: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../trace/layer-raster", () => ({ layerRaster: vi.fn() }));
vi.mock("../../canvas/key-color", () => ({ assetKeyColor: vi.fn(), eyeDropper: () => null }));

import { createImageCommands } from "../commands";
import { createEditorUiStore, ImageEditorContext } from "../editor-state";
import { Inspector } from "./inspector";

const box = { x: 0.5, y: 0.5, w: 0.8, h: 0.5, rotation: 0, opacity: 1 };

function chartLayer(): Layer {
  return { id: "chart", type: "chart", transform: box, chart: newChartSpec("bar", { labels: ["Jan", "Fev"], series: [{ name: "Vendas", values: [10, 20] }] }, "pt-BR", chartInk("#111111")) };
}

function host(layers: Layer[]): Artboard {
  return { id: "post", x: 0, y: 0, canvas: { width: 1000, height: 1000, background: "#ffffff" }, layers };
}

function setup(doc: ImageDocument, messages: typeof ptMessages = ptMessages) {
  const store = createStudioStore(doc, { settle: settleImage });
  store.getState().select(["chart"]);
  const ui = createEditorUiStore();
  ui.setState({ artboardId: "post" });
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn().mockResolvedValue({ width: 10, height: 10 }) });
  render(
    <NextIntlClientProvider locale={messages === ptMessages ? "pt" : "en"} messages={messages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-1", projectName: "Projeto" }}>
        <TooltipProvider>
          <Inspector />
        </TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  return { store, ui };
}

function chartIn(store: ReturnType<typeof setup>["store"]): Layer | undefined {
  return store.getState().document.artboards[0].layers.find((layer) => layer.id === "chart");
}

describe("chart inspector", () => {
  it("changes the kind, the legend and the number format by hand", { timeout: 15_000 }, () => {
    const { store } = setup(imageDocument([host([chartLayer()])]));
    const t = ptMessages.studio.chart;
    expect(screen.getByRole("heading", { level: 2, name: ptMessages.studio.image.inspector.types.chart })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(t.kind), { target: { value: "pie" } });
    expect(chartIn(store)?.chart).toMatchObject({ kind: "pie", style: { legend: "right", valueLabels: true }, format: { percent: true } });
    fireEvent.change(screen.getByLabelText(t.legend), { target: { value: "bottom" } });
    expect(chartIn(store)?.chart?.style.legend).toBe("bottom");
    const prefix = screen.getByLabelText(t.prefix);
    fireEvent.change(prefix, { target: { value: "R$ " } });
    fireEvent.blur(prefix);
    expect(chartIn(store)?.chart?.format.prefix).toBe("R$ ");
  });

  it("refuses a kind the data cannot draw and says why", { timeout: 15_000 }, () => {
    const { store } = setup(imageDocument([host([chartLayer()])]));
    const t = ptMessages.studio.chart;
    fireEvent.change(screen.getByLabelText(t.kind), { target: { value: "scatter" } });
    expect(chartIn(store)?.chart?.kind).toBe("bar");
    expect(screen.getByRole("alert").textContent).toContain(t.data.scatterNeedsTwo);
  });

  it("edits the data in the grid, takes pasted spreadsheet cells and applies once", { timeout: 15_000 }, () => {
    const { store, ui } = setup(imageDocument([host([chartLayer()])]));
    const t = ptMessages.studio.chart.data;
    fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.chart.editData }));
    expect(ui.getState().dataEditorFor).toBe("chart");
    const dialog = screen.getByRole("dialog", { name: t.title });
    const first = within(dialog).getByLabelText(t.cell.replace("{row}", "1").replace("{column}", "1"));
    fireEvent.change(first, { target: { value: "1.500,5" } });
    const label = within(dialog).getByLabelText(t.label.replace("{row}", "1"));
    fireEvent.paste(label, { clipboardData: { getData: () => "Mar\t30\nAbr\t40\n" } });
    fireEvent.click(within(dialog).getByRole("button", { name: t.apply }));
    expect(chartIn(store)?.chart?.data).toEqual({ labels: ["Mar", "Abr"], series: [{ name: "Vendas", values: [30, 40] }] });
    expect(store.getState().canUndo).toBe(true);
  });

  it("closes the data dialog with Escape and leaves the chart as it was", { timeout: 15_000 }, () => {
    const { store, ui } = setup(imageDocument([host([chartLayer()])]));
    const t = ptMessages.studio.chart.data;
    fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.chart.editData }));
    const dialog = screen.getByRole("dialog", { name: t.title });
    const first = within(dialog).getByLabelText(t.cell.replace("{row}", "1").replace("{column}", "1"));
    fireEvent.change(first, { target: { value: "99" } });
    fireEvent.keyDown(first, { key: "Escape", code: "Escape" });
    expect(ui.getState().dataEditorFor).toBeNull();
    expect(screen.queryByRole("dialog", { name: t.title })).toBeNull();
    expect(chartIn(store)?.chart?.data.series[0].values).toEqual([10, 20]);
    expect(store.getState().canUndo).toBe(false);
  });

  it("ungroups the chart into plain layers", { timeout: 15_000 }, () => {
    const { store } = setup(imageDocument([host([chartLayer()])]), enMessages as typeof ptMessages);
    fireEvent.click(screen.getByRole("button", { name: enMessages.studio.chart.expand }));
    const layers = store.getState().document.artboards[0].layers;
    expect(layers.some((layer) => layer.type === "chart")).toBe(false);
    expect(layers.some((layer) => layer.type === "text" && layer.text === "Jan")).toBe(true);
  });
});
