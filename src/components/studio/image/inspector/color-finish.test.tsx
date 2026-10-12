import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }),
  listLibraryAction: vi.fn().mockResolvedValue({ data: [{ id: "look-1", description: "Quente", url: "", previewUrl: "", createdAt: "", type: "lut" }] }),
  uploadMediaAction: vi.fn(),
}));

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { emptyArtboard, imageDocument, newImageLayer, type Layer } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";

import { createImageCommands } from "../commands";
import { createEditorUiStore, ImageEditorContext } from "../editor-state";
import { Inspector } from "./inspector";

const pt = ptMessages.studio;

function setup() {
  const photo = { ...newImageLayer("img", { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }), id: "p" };
  const store = createStudioStore(imageDocument([{ ...emptyArtboard({ width: 800, height: 800 }), layers: [photo] }]));
  store.getState().select(["p"]);
  const ui = createEditorUiStore();
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn().mockResolvedValue({ width: 10, height: 10 }) });
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-1", projectName: "Projeto" }}>
        <TooltipProvider>
          <Inspector />
        </TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("tab", { name: pt.inspector.groups.color }));
  return () => store.getState().document.artboards[0].layers.find((layer) => layer.id === "p") as Layer;
}

describe("color finish on image layers", () => {
  it("shapes curves, keeps one color, picks a library LUT and keeps them through a look", { timeout: 15_000 }, async () => {
    const photo = setup();
    fireEvent.click(within(screen.getByRole("group", { name: pt.color.curves.presets })).getByRole("button", { name: pt.color.curves.presetNames.fade }));
    expect(photo().color?.curves?.master?.[0]).toEqual({ x: 0, y: 0.12 });
    fireEvent.click(screen.getByRole("switch", { name: pt.color.hsl.toggle }));
    fireEvent.keyDown(screen.getByRole("slider", { name: pt.color.hsl.hue }), { key: "ArrowRight", shiftKey: true });
    expect(photo().color?.hsl?.hue).toBe(10);
    const choose = await screen.findByRole("option", { name: "Quente" });
    fireEvent.change(choose.closest("select")!, { target: { value: "look-1" } });
    expect(photo().color?.lut).toEqual({ assetId: "look-1" });
    fireEvent.click(within(screen.getByRole("group", { name: pt.grade.title })).getByRole("button", { name: pt.grade.lookNames.warm }));
    expect(photo().color).toMatchObject({ temperature: 35, lut: { assetId: "look-1" } });
    expect(photo().color?.curves).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: pt.color.curves.reset }));
    expect(photo().color?.curves).toBeUndefined();
  });
});
