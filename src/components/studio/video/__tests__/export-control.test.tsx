import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import type { LocalExport } from "@/lib/studio/export";

import { ExportControl } from "../export/export-control";
import { createVideoExporter } from "../export/video-exporter";
import { VideoExportContext } from "../use-video-export";
import { renderInEditor } from "./harness";

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks[0].clips = [{ ...newMediaClip("image", "img", 0, 3000), id: "c" }];
  d.durationMs = 3000;
  return d;
}

function mount(local: () => Promise<LocalExport>) {
  const document = film();
  const asked = vi.fn();
  const exporter = createVideoExporter({
    document: () => document,
    commit: () => undefined,
    flush: async () => undefined,
    committed: () => ({ version: 1, settled: true }),
    lutReadable: async () => true,
    local: async (_, request) => {
      asked(request);
      return local();
    },
    refreshLibrary: () => undefined,
  });
  renderInEditor(
    document,
    <VideoExportContext.Provider value={exporter}>
      <ExportControl />
    </VideoExportContext.Provider>,
  );
  return { asked, exporter };
}

function popover() {
  return within(screen.getByRole("dialog"));
}

describe("the video export popover", () => {
  it("opens with the formats instead of starting, and exports an MP4 by default", async () => {
    const { asked } = mount(async () => ({ status: "done", result: { mediaId: "m-1", mediaUrl: "https://x/m-1.mp4" } }));
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    expect(asked).not.toHaveBeenCalled();
    expect(popover().getByRole("group", { name: "Formato" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(popover().getByRole("button", { name: "Exportar agora" }));
    });
    expect(asked).toHaveBeenCalledWith({ format: "mp4" });
    expect(await popover().findByText("Vídeo pronto")).toBeInTheDocument();
  });

  it("sets up a gif by hand and shows the animation when it is ready", async () => {
    const { asked } = mount(async () => ({ status: "done", result: { mediaId: "g-1", mediaUrl: "https://x/g-1.gif" } }));
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    fireEvent.click(popover().getByRole("button", { name: "GIF" }));
    expect(popover().getByText("480 x 853 px")).toBeInTheDocument();
    fireEvent.click(within(popover().getByRole("group", { name: "Largura" })).getByRole("button", { name: "320" }));
    fireEvent.click(within(popover().getByRole("group", { name: "Quadros por segundo" })).getByRole("button", { name: "10" }));
    fireEvent.click(within(popover().getByRole("group", { name: "Pontilhado" })).getByRole("button", { name: "Ordenado" }));
    fireEvent.click(within(popover().getByRole("group", { name: "Repetição" })).getByRole("button", { name: "Contada" }));
    const plays = popover().getByLabelText("Vezes");
    fireEvent.change(plays, { target: { value: "4" } });
    fireEvent.blur(plays);
    fireEvent.change(popover().getByLabelText("Cores"), { target: { value: "64" } });
    await act(async () => {
      fireEvent.click(popover().getByRole("button", { name: "Exportar agora" }));
    });
    expect(asked).toHaveBeenCalledWith({ format: "gif", width: 320, fps: 10, loop: 4, colors: 64, dither: "ordered" });
    expect(await popover().findByText("Animação pronta")).toBeInTheDocument();
    expect(popover().getByRole("img", { name: "Animação exportada" })).toHaveAttribute("src", "https://x/g-1.gif");
  });

  it("explains an animation failure in its own words and retries with the same settings", async () => {
    const { asked } = mount(async () => ({ status: "failed", reason: "no_encoder" }));
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    fireEvent.click(popover().getByRole("button", { name: "WebP" }));
    fireEvent.change(popover().getByLabelText("Qualidade"), { target: { value: "60" } });
    await act(async () => {
      fireEvent.click(popover().getByRole("button", { name: "Exportar agora" }));
    });
    expect(await popover().findByText(/não consegue gerar esse formato/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(popover().getByRole("button", { name: "Tentar de novo" }));
    });
    expect(asked).toHaveBeenLastCalledWith({ format: "webp", width: 480, fps: 15, loop: 0, quality: 0.6 });
    expect(asked).toHaveBeenCalledTimes(2);
  });
});
