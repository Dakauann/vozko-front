import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

vi.mock("@/app/actions/media-generation", () => ({
  listMediaModelsAction: vi.fn(async () => ({ data: [{ id: "m1", name: "Modelo", default: true }] })),
  requestMediaGenerationAction: vi.fn(),
  getMediaGenerationAction: vi.fn(),
}));

const exportStudioVideo = vi.fn();
vi.mock("@/app/actions/studio", () => ({
  exportStudioVideoAction: (...args: unknown[]) => exportStudioVideo(...args),
}));

vi.mock("@/components/studio/canvas/rasterize", () => ({
  rasterizeLayer: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
  uploadRaster: vi.fn(async () => ({ data: { mediaId: "raster-1", mediaUrl: "https://cdn/raster.png" } })),
}));

vi.mock("react-konva", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return { Stage: Pass, Layer: Pass, Group: Pass, Rect: Pass, Text: Pass, Image: Pass, Ellipse: Pass, Line: Pass, Star: Pass, Arrow: Pass };
});

vi.mock("@/components/TourGuide", () => ({ default: () => null }));

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import type { StudioProject } from "@/lib/studio/project";

import { VideoEditor } from "../video-editor";
import { fakeStudio } from "./harness";

function project(): StudioProject<VideoDocument> {
  const document = emptyVideoDocument("story");
  document.tracks[0].clips = [{ ...newMediaClip("image", "img", 0, 3000), id: "c-img" }];
  document.durationMs = 3000;
  return { id: "p-1", kind: "video", name: "Vídeo", document, version: 4, createdAt: "", updatedAt: "" };
}

function mount() {
  const studio = fakeStudio();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <TooltipProvider>
        <VideoEditor project={project()} studio={studio} />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
  return studio;
}

describe("VideoEditor", () => {
  it("adds a text overlay from the elements panel and autosaves it", async () => {
    const studio = mount();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Texto" }));
    fireEvent.click(screen.getByRole("tab", { name: "Texto" }));
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar título" }));
    expect(studio.edit).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(studio.edit).mock.calls[0][0].document as VideoDocument;
    const overlay = saved.tracks.flatMap((t) => t.clips).find((c) => c.type === "overlay");
    expect(overlay?.layer?.text).toBe("Seu título");
    expect(screen.getByRole("heading", { name: "Sobreposição" })).toBeInTheDocument();
  });

  it("splits with S and undoes with Ctrl+Z", () => {
    const studio = mount();
    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(window, { key: "s" });
    const split = vi.mocked(studio.edit).mock.calls.at(-1)![0].document as VideoDocument;
    expect(split.tracks[0].clips.map((c) => [c.startMs, c.durationMs])).toEqual([
      [0, 1000],
      [1000, 2000],
    ]);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    const undone = vi.mocked(studio.edit).mock.calls.at(-1)![0].document as VideoDocument;
    expect(undone.tracks[0].clips).toHaveLength(1);
  });

  it("exports the saved version with the overlay rasters", async () => {
    exportStudioVideo.mockResolvedValue({ data: { id: "job-1", kind: "video", status: "queued", referenceMediaIds: [], createdAt: "", updatedAt: "" } });
    const studio = mount();
    fireEvent.click(screen.getByRole("tab", { name: "Texto" }));
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar título" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    });
    await waitFor(() => expect(exportStudioVideo).toHaveBeenCalled());
    expect(studio.flush).toHaveBeenCalled();
    const [projectId, version, rasters] = exportStudioVideo.mock.calls[0];
    expect(projectId).toBe("p-1");
    expect(version).toBe(1);
    expect(Object.values(rasters)).toEqual(["raster-1"]);
    expect(await screen.findByText("Na fila")).toBeInTheDocument();
  });
});
