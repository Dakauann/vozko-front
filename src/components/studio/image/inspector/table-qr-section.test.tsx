import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import enMessages from "@/i18n/messages/en.json";
import ptMessages from "@/i18n/messages/pt.json";
import { imageDocument, type Artboard, type ImageDocument, type Layer } from "@/lib/studio/document";
import { settleImage } from "@/lib/studio/image-settle";
import { newQrSpec } from "@/lib/studio/qr";
import { createStudioStore } from "@/lib/studio/store";
import { newTableSpec, tableInk } from "@/lib/studio/table";

const links = vi.hoisted(() => ({
  createLink: vi.fn(),
  listLinks: vi.fn(),
}));

vi.mock("@/app/actions/links", () => links);
vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({ fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }), listLibraryAction: vi.fn().mockResolvedValue({ data: [] }), uploadMediaAction: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../trace/layer-raster", () => ({ layerRaster: vi.fn() }));
vi.mock("../../canvas/key-color", () => ({ assetKeyColor: vi.fn(), eyeDropper: () => null }));

import { createImageCommands } from "../commands";
import { createEditorUiStore, ImageEditorContext } from "../editor-state";
import { Inspector } from "./inspector";

const LINK_ID = "3f2c8a1e-9b4d-4c2a-8e1f-5a6b7c8d9e0f";
const box = { x: 0.5, y: 0.5, w: 0.6, h: 0.4, rotation: 0, opacity: 1 };

function tableLayer(): Layer {
  return { id: "prices", type: "table", transform: box, table: newTableSpec([["Plano", "Preço"], ["Básico", "R$ 49"]], tableInk("#111111")) };
}

function qrLayer(): Layer {
  return { id: "code", type: "qr", transform: { ...box, w: 0.3, h: 0.3 }, qr: newQrSpec({ kind: "text", text: "Seu link aqui" }) };
}

function host(layers: Layer[]): Artboard {
  return { id: "post", x: 0, y: 0, canvas: { width: 1000, height: 1000, background: "#ffffff" }, layers };
}

function setup(doc: ImageDocument, selected: string, messages: typeof ptMessages = ptMessages, fresh = false) {
  links.listLinks.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 50, totalPages: 1, totalItems: 0 } });
  const store = createStudioStore(doc, { settle: settleImage });
  store.getState().select([selected]);
  const ui = createEditorUiStore();
  ui.setState({ artboardId: "post", ...(fresh ? { dataEditorFor: selected } : {}) });
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

function layerIn(store: ReturnType<typeof setup>["store"], id: string): Layer | undefined {
  return store.getState().document.artboards[0].layers.find((layer) => layer.id === id);
}

describe("table inspector", () => {
  it("changes borders, header and a column alignment by hand", { timeout: 15_000 }, () => {
    const { store } = setup(imageDocument([host([tableLayer()])]), "prices");
    const t = ptMessages.studio.tables;
    expect(screen.getByRole("heading", { level: 2, name: ptMessages.studio.image.inspector.types.table })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(t.borders), { target: { value: "all" } });
    expect(layerIn(store, "prices")?.table?.style.borders).toBe("all");
    fireEvent.change(screen.getByLabelText(t.columnAlign.replace("{column}", "2")), { target: { value: "right" } });
    expect(layerIn(store, "prices")?.table?.columns[1].align).toBe("right");
    fireEvent.click(screen.getByRole("switch", { name: t.header }));
    expect(layerIn(store, "prices")?.table?.header).toBe(false);
  });

  it("edits the cells in the shared grid and applies once", { timeout: 15_000 }, () => {
    const { store } = setup(imageDocument([host([tableLayer()])]), "prices");
    const t = ptMessages.studio.tables.data;
    fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.tables.editCells }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(t.cell.replace("{row}", "2").replace("{column}", "2")), { target: { value: "R$ 59" } });
    fireEvent.click(within(dialog).getByRole("button", { name: t.addRow }));
    fireEvent.change(within(dialog).getByLabelText(t.cell.replace("{row}", "3").replace("{column}", "1")), { target: { value: "Pro" } });
    expect(layerIn(store, "prices")?.table?.rows[1][1].text).toBe("R$ 49");
    fireEvent.click(within(dialog).getByRole("button", { name: t.apply }));
    expect(layerIn(store, "prices")?.table?.rows.map((row) => row.map((cell) => cell.text))).toEqual([["Plano", "Preço"], ["Básico", "R$ 59"], ["Pro", ""]]);
  });

  it("types one cell and makes part of it bold with the run toolbar, in English too", { timeout: 15_000 }, () => {
    const { store } = setup(imageDocument([host([tableLayer()])]), "prices", enMessages as typeof ptMessages);
    const t = enMessages.studio.tables.cell;
    fireEvent.change(screen.getByLabelText(t.row), { target: { value: "1" } });
    const area = screen.getByLabelText(t.text.replace("{row}", "2").replace("{column}", "1")) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: "Básico mensal" } });
    expect(layerIn(store, "prices")?.table?.rows[1][0].text).toBe("Básico mensal");
    area.setSelectionRange(0, 6);
    fireEvent.select(area);
    fireEvent.change(screen.getByLabelText(enMessages.studio.textRuns.weight), { target: { value: "700" } });
    expect(layerIn(store, "prices")?.table?.rows[1][0].runs).toEqual([{ start: 0, end: 6, fontWeight: 700 }]);
    expect(screen.queryByLabelText(enMessages.studio.textRuns.size)).toBeNull();
  });
});

describe("qr code inspector", () => {
  it("creates a Vozko short link through the links endpoint and points the code at it", { timeout: 15_000 }, async () => {
    links.createLink.mockResolvedValue({ link: { id: LINK_ID, code: "aB3dE9", shortUrl: "https://vzk.to/aB3dE9", status: "active", targetUrl: "https://loja.com" } });
    const { store, ui } = setup(imageDocument([host([qrLayer()])]), "code", ptMessages, true);
    const t = ptMessages.studio.qr;
    expect((screen.getByLabelText(t.mode) as HTMLSelectElement).value).toBe("shortLink");
    fireEvent.change(screen.getByLabelText(t.shortLink.target), { target: { value: "https://loja.com" } });
    fireEvent.click(screen.getByRole("button", { name: t.shortLink.create }));
    await waitFor(() => expect(layerIn(store, "code")?.qr?.link).toEqual({ kind: "shortLink", shortLinkId: LINK_ID, url: "https://vzk.to/aB3dE9" }));
    expect(links.createLink).toHaveBeenCalledWith({ targetUrl: "https://loja.com", title: t.shortLink.title });
    expect(ui.getState().dataEditorFor).toBeNull();
  });

  it("shows why the backend refused the short link and keeps the code as it was", { timeout: 15_000 }, async () => {
    links.createLink.mockResolvedValue({ error: "insufficient permissions" });
    const { store } = setup(imageDocument([host([qrLayer()])]), "code", ptMessages, true);
    const t = ptMessages.studio.qr;
    fireEvent.change(screen.getByLabelText(t.shortLink.target), { target: { value: "https://loja.com" } });
    fireEvent.click(screen.getByRole("button", { name: t.shortLink.create }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("insufficient permissions"));
    expect(layerIn(store, "code")?.qr?.link.kind).toBe("text");
  });

  it("builds a WhatsApp code and refuses a low contrast color with the reason", { timeout: 15_000 }, () => {
    const { store } = setup(imageDocument([host([qrLayer()])]), "code");
    const t = ptMessages.studio.qr;
    fireEvent.change(screen.getByLabelText(t.mode), { target: { value: "whatsapp" } });
    const phone = screen.getByLabelText(t.phone);
    fireEvent.change(phone, { target: { value: "+55 11 99999-8888" } });
    fireEvent.blur(phone);
    expect(layerIn(store, "code")?.qr?.link).toEqual({ kind: "whatsapp", phone: "5511999998888" });
    const dark = screen.getAllByLabelText(t.dark).find((element) => (element as HTMLInputElement).type === "text")!;
    fireEvent.change(dark, { target: { value: "#f97316" } });
    fireEvent.blur(dark);
    expect(layerIn(store, "code")?.qr?.dark).toBe("#111111");
    expect(screen.getByRole("alert").textContent).toContain(t.problems.contrast);
  });
});
