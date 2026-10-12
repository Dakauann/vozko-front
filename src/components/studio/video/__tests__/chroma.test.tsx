import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

const sampleKeyColor = vi.fn();
vi.mock("../clip-key-color", () => ({ sampleKeyColor: (...args: unknown[]) => sampleKeyColor(...args) }));

import { CHROMA_DEFAULTS } from "@/lib/studio/chroma-key";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState } from "../editor-context";
import { ChromaKeyFields } from "../inspector/chroma-key-fields";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { renderInEditor } from "./harness";

const IDS = ["c"];

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 2000), id: "c" }] }];
  d.durationMs = 2000;
  return d;
}

function Chroma() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return <ChromaKeyFields clip={clip} disabled={false} editor={editor} />;
}

describe("green screen by hand", () => {
  it("removes a green screen, switches to blue, keys a value, shows the matte and turns it off", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Chroma />);
    const key = () => findClip(editor.store.getState().document, "c")!.clip.chromaKey;
    fireEvent.click(screen.getByRole("button", { name: "Remover fundo verde" }));
    expect(key()).toEqual({ color: "#00ff00", ...CHROMA_DEFAULTS });
    fireEvent.click(screen.getByRole("button", { name: "Fundo azul" }));
    expect(key()?.color).toBe("#0099ff");
    fireEvent.click(screen.getByRole("button", { name: "Chave de Semelhança no cursor" }));
    expect(key()?.keyframes?.similarity).toEqual([{ atMs: 0, value: CHROMA_DEFAULTS.similarity, easing: "linear" }]);
    fireEvent.click(screen.getByRole("button", { name: "Recorte" }));
    expect(editor.view.getState().chromaView).toEqual({ clipId: "c", mode: "matte" });
    fireEvent.click(screen.getByRole("button", { name: "Resultado" }));
    expect(editor.view.getState().chromaView).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Desligar o recorte" }));
    expect(key()).toBeUndefined();
  });

  it("detects the screen color in the frame under the playhead and says so when there is none", { timeout: 15_000 }, async () => {
    sampleKeyColor.mockReset();
    sampleKeyColor.mockResolvedValueOnce("#30c050").mockResolvedValueOnce(null);
    const { editor } = renderInEditor(doc(), <Chroma />);
    const key = () => findClip(editor.store.getState().document, "c")!.clip.chromaKey;
    fireEvent.click(screen.getByRole("button", { name: "Detectar o fundo" }));
    await waitFor(() => expect(key()?.color).toBe("#30c050"));
    expect(sampleKeyColor.mock.calls[0][0]).toEqual({ assetId: "vid", sourceMs: 0, still: false });
    fireEvent.click(screen.getByRole("button", { name: "Detectar" }));
    expect(await screen.findByText(/Não achei um fundo verde ou azul/)).toBeTruthy();
    expect(key()?.color).toBe("#30c050");
  });
});
