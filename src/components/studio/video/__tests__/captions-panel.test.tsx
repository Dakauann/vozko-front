import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { fetchMediaFile } = vi.hoisted(() => ({ fetchMediaFile: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: (mediaId: string) => fetchMediaFile(mediaId),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";

import { CaptionsPanel } from "../panels/captions-panel";
import { renderInEditor } from "./harness";

const SRT = ["1", "00:00:00,500 --> 00:00:02,000", "Olá", "", "2", "00:00:02,000 --> 00:00:03,500", "Tudo bem?", ""].join("\r\n");
const VTT = ["WEBVTT", "", "00:00:01.000 --> 00:00:02.000", "Da biblioteca", ""].join("\n");

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 1000, 4000), id: "a" }] }];
  d.durationMs = 5000;
  return d;
}

function captionsOf(editor: ReturnType<typeof renderInEditor>["editor"]): [string | undefined, number][] {
  const track = editor.store.getState().document.tracks.find((t) => t.name === "Legendas");
  return track ? track.clips.map((c) => [c.layer?.text, c.startMs]) : [];
}

function pick(file: File) {
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
}

describe("captions from a file", () => {
  it("places an SRT file as caption clips from the start of the video, as one undo step", async () => {
    const { editor } = renderInEditor(doc(), <CaptionsPanel />);
    pick(new File([SRT], "legenda.srt", { type: "application/x-subrip" }));
    await waitFor(() => expect(captionsOf(editor)).toEqual([["Olá", 500], ["Tudo bem?", 2000]]));
    expect(editor.view.getState().notice?.key).toBe("captionsPlaced");
    act(() => editor.store.getState().undo());
    expect(captionsOf(editor)).toEqual([]);
  });

  it("times the captions from the chosen clip", async () => {
    const { editor } = renderInEditor(doc(), <CaptionsPanel />);
    const align = screen.getByLabelText("Tempos a partir de");
    fireEvent.change(align, { target: { value: "a" } });
    pick(new File([SRT], "legenda.srt"));
    await waitFor(() => expect(captionsOf(editor)).toEqual([["Olá", 1500], ["Tudo bem?", 3000]]));
  });

  it("refuses a file without captions and changes nothing", async () => {
    const { editor } = renderInEditor(doc(), <CaptionsPanel />);
    pick(new File(["lista de compras"], "notas.srt"));
    await waitFor(() => expect(editor.view.getState().notice).toEqual({ key: "captionsFileUnreadable", tone: "error" }));
    expect(editor.store.getState().canUndo).toBe(false);
  });

  it("places a caption file that is already in the library", async () => {
    fetchMediaFile.mockResolvedValue({ data: { blob: new Blob([VTT]), contentType: "text/vtt" }, error: null });
    const { editor } = renderInEditor(doc(), <CaptionsPanel />);
    act(() =>
      editor.assets.store.setState({
        library: {
          status: "ready",
          medias: [
            { id: "cap-1", description: "Legendas", url: "https://cdn.example/captions/w/cap-1.vtt", previewUrl: "", createdAt: "2026-10-08T12:00:00Z", type: "document" },
            { id: "pdf-1", description: "Contrato", url: "https://cdn.example/files/contrato.pdf", previewUrl: "", createdAt: "2026-10-08T12:00:00Z", type: "document" },
          ],
        },
      }),
    );
    expect(screen.queryByRole("button", { name: /Contrato/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Colocar Legendas/ }));
    await waitFor(() => expect(captionsOf(editor)).toEqual([["Da biblioteca", 1000]]));
    expect(fetchMediaFile).toHaveBeenCalledWith("cap-1");
  });
});
