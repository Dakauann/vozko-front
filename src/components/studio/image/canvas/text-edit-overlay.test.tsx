import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { placeSelection } from "@/components/studio/canvas/rich-text-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { emptyArtboard, imageDocument, newTextLayer, type ImageDocument, type Layer } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";

vi.mock("@/app/actions/medias", () => ({
  fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }),
  listLibraryAction: vi.fn().mockResolvedValue({ data: [] }),
  uploadMediaAction: vi.fn(),
}));

import { createImageCommands } from "../commands";
import { createEditorUiStore, ImageEditorContext } from "../editor-state";
import { TextEditOverlay } from "./text-edit-overlay";

const runs = ptMessages.studio.textRuns;
const canvas = { width: 1000, height: 500 };

function setup(layer: Layer) {
  const doc: ImageDocument = imageDocument([{ ...emptyArtboard(canvas), layers: [layer] }]);
  const store = createStudioStore(doc);
  const ui = createEditorUiStore();
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn().mockResolvedValue({ width: 10, height: 10 }) });
  commands.startTextEdit(layer.id);
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-1", projectName: "Projeto" }}>
        <TooltipProvider>
          <TextEditOverlay />
        </TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  const current = () => store.getState().document.artboards[0].layers[0];
  return { store, ui, current };
}

function text(value: string): Layer {
  return { ...newTextLayer(value), id: "t", fontId: "inter", fontWeight: 400, fontSize: 0.1, fill: "#111111" };
}

function select(editor: HTMLElement, start: number, end: number) {
  act(() => {
    placeSelection(editor, start, end);
    document.dispatchEvent(new Event("selectionchange"));
  });
}

describe("editing a text layer on the canvas", () => {
  it("makes a selected word bold, keeps it bold while typing and commits the runs", { timeout: 15_000 }, () => {
    const { store, ui, current } = setup(text("Compre agora"));
    const editor = screen.getByRole("textbox", { name: runs.edit });
    expect(editor).toHaveFocus();
    expect(editor.textContent).toBe("Compre agora");

    select(editor, 7, 12);
    fireEvent.keyDown(editor, { key: "b", ctrlKey: true });
    expect(current().runs).toEqual([{ start: 7, end: 12, fontWeight: 700 }]);
    expect(editor.querySelectorAll("span")).toHaveLength(2);

    const bold = editor.querySelectorAll("span")[1].firstChild as Text;
    bold.data = "agora!";
    fireEvent.input(editor);
    fireEvent.keyDown(editor, { key: "Escape" });

    expect(ui.getState().editingTextId).toBeNull();
    expect(current().text).toBe("Compre agora!");
    expect(current().runs).toEqual([{ start: 7, end: 13, fontWeight: 700 }]);
    act(() => store.getState().undo());
    expect(current()).toMatchObject({ text: "Compre agora", runs: [{ start: 7, end: 12, fontWeight: 700 }] });
  });

  it("styles a selection from the toolbar and the whole text with a caret", { timeout: 15_000 }, () => {
    const { current } = setup(text("Compre agora"));
    const editor = screen.getByRole("textbox", { name: runs.edit });
    const toolbar = screen.getByRole("toolbar", { name: runs.label });

    select(editor, 0, 6);
    const size = within(toolbar).getByLabelText(runs.size);
    fireEvent.change(size, { target: { value: "80" } });
    fireEvent.keyDown(size, { key: "Enter" });
    expect(current().fontSize).toBe(0.1);
    expect(current().runs).toEqual([{ start: 0, end: 6, fontSize: 0.16 }]);

    select(editor, 0, 12);
    expect(within(toolbar).getByLabelText(runs.size)).toHaveAttribute("placeholder", ptMessages.studio.video.inspector.mixed);

    select(editor, 3, 3);
    fireEvent.click(within(toolbar).getByRole("combobox", { name: runs.font }));
    fireEvent.click(screen.getByRole("option", { name: "Roboto" }));
    expect(current().fontId).toBe("roboto");
    fireEvent.change(within(toolbar).getByLabelText(runs.size), { target: { value: "30" } });
    fireEvent.keyDown(within(toolbar).getByLabelText(runs.size), { key: "Enter" });
    expect(current().fontSize).toBe(0.06);
    expect(current().runs).toBeUndefined();
  });

  it("removes every run with the clear action", { timeout: 15_000 }, () => {
    const { current } = setup({ ...text("Compre agora"), runs: [{ start: 7, end: 12, fill: "#ff0000" }] });
    fireEvent.click(screen.getByRole("button", { name: runs.clear }));
    expect(current().runs).toBeUndefined();
  });

  it("deletes a layer left blank", { timeout: 15_000 }, () => {
    const { store } = setup(text("Oi"));
    const editor = screen.getByRole("textbox", { name: runs.edit });
    (editor.querySelector("span")!.firstChild as Text).data = "";
    fireEvent.input(editor);
    fireEvent.blur(editor);
    expect(store.getState().document.artboards[0].layers).toEqual([]);
  });
});
