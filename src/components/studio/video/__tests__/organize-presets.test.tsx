import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

const presetApi = vi.hoisted(() => ({
  list: vi.fn(async () => ({
    data: {
      items: [
        {
          id: "builtin.slideIn",
          name: "Deslizar",
          names: { pt: "Deslizar", en: "Slide", es: "Deslizar", de: "Gleiten" },
          builtIn: true,
          animation: { scope: "visual", durationMs: 1000, keyframes: { x: [{ atMs: 0, value: -0.2, easing: "easeOut" }, { atMs: 500, value: 0, easing: "linear" }] } },
        },
      ],
    },
  })),
  create: vi.fn(async (input: { name: string; animation: unknown }) => ({ data: { id: "p-1", builtIn: false, ...input } })),
}));

vi.mock("@/app/actions/studio-presets", () => ({
  listAnimationPresetsAction: presetApi.list,
  createAnimationPresetAction: presetApi.create,
  renameAnimationPresetAction: vi.fn(),
  deleteAnimationPresetAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { Inspector } from "../inspector/inspector";
import { renderInEditor } from "./harness";

const organize = ptMessages.studio.video.organize;
const presets = ptMessages.studio.video.presets;

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 4000), id: "photo", transform: { x: 0.5, y: 0.5, w: 0.3, h: 0.2, rotation: 0, opacity: 1 } }] },
    { id: "a1", kind: "audio", clips: [] },
  ];
  d.durationMs = 4000;
  return d;
}

function photo(rendered: ReturnType<typeof renderInEditor>) {
  return findClip(rendered.editor.store.getState().document, "photo")!.clip;
}

describe("organization and presets by hand", () => {
  it("names, labels and guides a clip and adds a marker on it at the playhead", { timeout: 15_000 }, () => {
    const rendered = renderInEditor(doc(), <Inspector />);
    act(() => rendered.editor.store.getState().select(["photo"]));
    const section = screen.getByRole("region", { name: organize.title });
    const name = within(section).getByLabelText(organize.name);
    fireEvent.change(name, { target: { value: "  Foto da loja " } });
    fireEvent.keyDown(name, { key: "Enter" });
    fireEvent.click(within(section).getByRole("radio", { name: organize.colors.green }));
    fireEvent.click(within(section).getByLabelText(organize.guide));
    act(() => rendered.editor.view.setState({ playheadMs: 1500 }));
    fireEvent.click(within(section).getByRole("button", { name: organize.addMarker }));
    expect(photo(rendered)).toMatchObject({ name: "Foto da loja", labelColor: "green", guide: true, markers: [expect.objectContaining({ atMs: 1500 })] });
  });

  it("applies a preset from the gallery and saves the clip animation as a new preset", { timeout: 15_000 }, async () => {
    const rendered = renderInEditor(doc(), <Inspector />);
    act(() => rendered.editor.store.getState().select(["photo"]));
    fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.inspector.groups.animation }));
    const section = screen.getByRole("region", { name: presets.title });
    const gallery = await within(section).findByRole("list", { name: presets.gallery });
    await waitFor(() => expect(within(gallery).getByText("Deslizar")).toBeTruthy());
    fireEvent.click(within(gallery).getByRole("button", { name: presets.apply }));
    expect(photo(rendered).keyframes?.x?.map((key) => [key.atMs, Number(key.value.toFixed(3))])).toEqual([
      [0, 0.3],
      [2000, 0.5],
    ]);
    fireEvent.change(within(section).getByLabelText(presets.newName), { target: { value: "Minha entrada" } });
    fireEvent.click(within(section).getByRole("button", { name: presets.save }));
    await waitFor(() => expect(presetApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Minha entrada", animation: expect.objectContaining({ scope: "visual", durationMs: 4000 }) })));
  });
});
