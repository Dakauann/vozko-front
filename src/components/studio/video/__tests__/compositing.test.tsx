import { fireEvent, screen } from "@testing-library/react";
import { useMemo } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, type VideoDocument } from "@/lib/studio/document";
import { LUMA_DEFAULTS } from "@/lib/studio/luma-key";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState } from "../editor-context";
import { ClipInspector } from "../inspector/clip-inspector";
import { LumaKeyFields } from "../inspector/luma-key-fields";
import { MaskFields } from "../inspector/mask-fields";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 2000), id: "c" }] },
    { id: "s", kind: "visual", clips: [{ ...newOverlayClip(newShapeLayer("rect"), 0, 2000), id: "o" }] },
  ];
  d.durationMs = 2000;
  return d;
}

function Luma() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(["c"]);
  return <LumaKeyFields clip={clip} disabled={false} editor={editor} />;
}

function Masks() {
  const clip = useEditorState((s) => findClip(s.document, "o")!.clip);
  const editor = useSelectionEditor(["o"]);
  return <MaskFields clip={clip} disabled={false} editor={editor} />;
}

function Inspector() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const track = useEditorState((s) => findClip(s.document, "c")!.track);
  const locations = useMemo(() => [{ clip, track, trackIndex: 0, clipIndex: 0 }], [clip, track]);
  return <ClipInspector locations={locations} />;
}

describe("compositing by hand", () => {
  it("removes the dark of a clip, switches to light, keys a value, shows the matte and turns it off", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Luma />);
    const key = () => findClip(editor.store.getState().document, "c")!.clip.lumaKey;
    fireEvent.click(screen.getByRole("button", { name: "Remover o escuro" }));
    expect(key()).toEqual({ mode: "dark", ...LUMA_DEFAULTS });
    fireEvent.click(screen.getByRole("button", { name: "Claro" }));
    expect(key()?.mode).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: "Chave de Suavidade no cursor" }));
    expect(key()?.keyframes?.softness).toEqual([{ atMs: 0, value: LUMA_DEFAULTS.softness, easing: "linear" }]);
    fireEvent.click(screen.getByRole("button", { name: "Recorte" }));
    expect(editor.view.getState().chromaView).toEqual({ clipId: "c", mode: "matte" });
    fireEvent.click(screen.getByRole("button", { name: "Desligar o recorte por brilho" }));
    expect(key()).toBeUndefined();
  });

  it("clips a shape by the brightness of the clip below, inverts it and turns it off", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Masks />);
    const clip = () => findClip(editor.store.getState().document, "o")!.clip;
    fireEvent.click(screen.getByRole("checkbox", { name: "Recortar pelo clipe de baixo" }));
    expect(clip().matte).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Brilho" }));
    expect(clip().matteChannel).toBe("luma");
    fireEvent.click(screen.getByRole("checkbox", { name: "Inverter o recorte" }));
    expect(clip().matteInvert).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Recortar pelo clipe de baixo" }));
    expect([clip().matte, clip().matteChannel, clip().matteInvert]).toEqual([undefined, undefined, undefined]);
  });

  it("sets the blend mode of a video clip in the frame section", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    fireEvent.change(screen.getByLabelText("Mistura"), { target: { value: "add" } });
    expect(findClip(editor.store.getState().document, "c")!.clip.blendMode).toBe("add");
    fireEvent.change(screen.getByLabelText("Mistura"), { target: { value: "normal" } });
    expect(findClip(editor.store.getState().document, "c")!.clip.blendMode).toBeUndefined();
  });
});
