import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";

import { Inspector } from "../inspector/inspector";
import { TransitionsPanel } from "../panels/transitions-panel";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 4000), id: "a" }] },
    {
      id: "au",
      kind: "audio",
      clips: [
        { ...newMediaClip("audio", "one", 0, 2000), id: "m1" },
        { ...newMediaClip("audio", "two", 2000, 2000), id: "m2" },
      ],
    },
  ];
  d.durationMs = 4000;
  return d;
}

describe("audio crossfades by hand", () => {
  it("adds a constant power crossfade on an audio cut and switches it to constant gain in the inspector", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(
      doc(),
      <>
        <Timeline />
        <Inspector />
      </>,
    );
    const audio = () => editor.store.getState().document.tracks[1];
    fireEvent.click(screen.getByRole("button", { name: "Adicionar transição neste corte" }));
    expect(audio().transitions).toMatchObject([{ fromClipId: "m1", toClipId: "m2", kind: "constantPower", durationMs: 1000, alignment: "center" }]);
    fireEvent.click(screen.getByRole("button", { name: "Transição: Cruzamento de som (potência constante)" }));
    const kind = screen.getByLabelText("Tipo") as HTMLSelectElement;
    expect([...kind.options].map((option) => option.value)).toEqual(["constantPower", "constantGain"]);
    fireEvent.change(kind, { target: { value: "constantGain" } });
    expect(audio().transitions?.[0].kind).toBe("constantGain");
  });

  it("applies an audio kind from the transitions panel on the selected audio clip's cut", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <TransitionsPanel />);
    editor.store.getState().select(["m1"]);
    fireEvent.click(within(screen.getByRole("group", { name: "Som" })).getByRole("button", { name: "Cruzamento de som (ganho constante)" }));
    expect(editor.store.getState().document.tracks[1].transitions).toMatchObject([{ fromClipId: "m1", toClipId: "m2", kind: "constantGain" }]);
  });
});
