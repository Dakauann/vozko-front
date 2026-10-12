import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

vi.mock("../preview/overlay-stage", () => ({
  OverlayStage: ({ items }: { items: { clipId: string }[] }) => (
    <div data-overlay-stage>
      {items.map((item) => (
        <span key={item.clipId} data-drawn-clip={item.clipId} />
      ))}
    </div>
  ),
}));

import { placeSelection } from "@/components/studio/canvas/rich-text-dom";
import ptMessages from "@/i18n/messages/pt.json";
import type { Counter } from "@/lib/studio/counter";
import { emptyVideoDocument, newOverlayClip, newTextLayer, type Clip, type Layer, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { Inspector } from "../inspector/inspector";
import { Preview } from "../preview/preview";
import { renderInEditor, stubPreviewLayout } from "./harness";

const AREA = { width: 498, height: 848 };
const FRAME = { width: 450, height: 800 };
const runs = ptMessages.studio.textRuns;

function textClip(layer: Partial<Layer> = {}, extra: Partial<Clip> = {}): Clip {
  return { ...newOverlayClip({ ...newTextLayer("Frete grátis"), fontId: "inter", fontWeight: 400, fontSize: 0.05, ...layer }, 0, 3000), id: "c", ...extra };
}

function doc(clip: Clip): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v", kind: "visual", clips: [clip] }];
  d.durationMs = 3000;
  return d;
}

function select(editor: HTMLElement, start: number, end: number) {
  act(() => {
    placeSelection(editor, start, end);
    document.dispatchEvent(new Event("selectionchange"));
  });
}

function openByDoubleClick(container: HTMLElement) {
  const frame = container.querySelector<HTMLElement>("[data-studio-preview-frame]")!;
  fireEvent.doubleClick(frame, { clientX: 0.5 * FRAME.width, clientY: 0.5 * FRAME.height });
  return screen.getByRole("textbox", { name: runs.edit });
}

let restore: () => void = () => undefined;

beforeAll(() => {
  restore = stubPreviewLayout({ area: AREA, frame: FRAME });
});

afterAll(() => restore());

describe("editing a text clip in the preview", () => {
  it("opens on double click, hides the drawn clip, underlines a selection and closes with Escape", { timeout: 15_000 }, () => {
    const { editor, container } = renderInEditor(doc(textClip()), <Preview />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;
    expect(container.querySelector('[data-drawn-clip="c"]')).not.toBeNull();

    const box = openByDoubleClick(container);
    expect(editor.view.getState().editingTextClipId).toBe("c");
    expect(box.textContent).toBe("Frete grátis");
    expect(container.querySelector('[data-drawn-clip="c"]')).toBeNull();

    select(box, 6, 12);
    fireEvent.click(within(screen.getByRole("toolbar", { name: runs.label })).getByLabelText(runs.underline));
    expect(clip().layer?.runs).toEqual([{ start: 6, end: 12, underline: true }]);
    expect(clip().layer?.text).toBe("Frete grátis");

    fireEvent.keyDown(box, { key: "Escape" });
    expect(editor.view.getState().editingTextClipId).toBeNull();
    expect(screen.queryByRole("textbox", { name: runs.edit })).toBeNull();
    expect(container.querySelector('[data-drawn-clip="c"]')).not.toBeNull();
  });

  it("commits typed text with its runs when the editor closes", { timeout: 15_000 }, () => {
    const { editor, container } = renderInEditor(doc(textClip()), <Preview />);
    const box = openByDoubleClick(container);
    select(box, 0, 5);
    fireEvent.keyDown(box, { key: "b", ctrlKey: true });
    const first = box.querySelector("span")!.firstChild as Text;
    first.data = "Fretes";
    fireEvent.input(box);
    fireEvent.blur(box);
    const clip = findClip(editor.store.getState().document, "c")!.clip;
    expect(clip.layer?.text).toBe("Fretes grátis");
    expect(clip.layer?.runs).toEqual([{ start: 0, end: 6, fontWeight: 700 }]);
  });

  it("styles the number of a counter through its single slot and keeps the text read only", { timeout: 15_000 }, () => {
    const counter: Counter = { value: 1500, decimals: 0, locale: "pt-BR", grouping: true, prefix: "R$ ", suffix: " mil" };
    const { editor, container } = renderInEditor(doc(textClip({}, { counter })), <Preview />);
    const box = openByDoubleClick(container);
    expect(box).toHaveAttribute("aria-readonly", "true");
    expect(box.textContent).toBe("R$ 1.500 mil");

    select(box, 4, 6);
    fireEvent.keyDown(box, { key: "b", ctrlKey: true });
    expect(findClip(editor.store.getState().document, "c")!.clip.layer?.runs).toEqual([{ start: 3, end: 4, fontWeight: 700 }]);

    (box.querySelector("span")!.firstChild as Text).data = "X";
    fireEvent.input(box);
    expect(box.textContent).toBe("R$ 1.500 mil");
  });
});

describe("the text clip inspector", () => {
  it("opens the preview editor from the inspector", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(textClip()), <Inspector />);
    act(() => editor.store.getState().select(["c"]));
    fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.video.layer.editOnPreview }));
    expect(editor.view.getState().editingTextClipId).toBe("c");
  });

  it("shows mixed values for styled runs and applies a whole text change over them", { timeout: 15_000 }, () => {
    const styled = textClip({ runs: [{ start: 6, end: 12, fontSize: 0.1, fill: "#ff0000" }] });
    const { editor } = renderInEditor(doc(styled), <Inspector />);
    act(() => editor.store.getState().select(["c"]));
    const size = screen.getByLabelText(ptMessages.studio.video.layer.size);
    expect(size).toHaveAttribute("placeholder", ptMessages.studio.video.inspector.mixed);
    expect(size).toHaveValue("");
    fireEvent.change(size, { target: { value: "8" } });
    fireEvent.blur(size);
    const layer = findClip(editor.store.getState().document, "c")!.clip.layer!;
    expect(layer.fontSize).toBeCloseTo(0.08);
    expect(layer.runs).toEqual([{ start: 6, end: 12, fill: "#ff0000" }]);
  });
});
