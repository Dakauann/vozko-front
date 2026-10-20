import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Media } from "@/lib/medias/types";

const { getMediaAction } = vi.hoisted(() => ({ getMediaAction: vi.fn<(id: string) => Promise<Media | null>>() }));

vi.mock("@/app/actions/medias", () => ({ getMediaAction }));

import { renderMessageContentPreview, renderMessageGlance } from "./index";

function libraryMedia(id: string, type = "image", previewUrl = ""): Media {
  return { id, description: id, url: `https://cdn.test/${id}`, previewUrl, createdAt: "2026-10-01T00:00:00Z", type };
}

const TABLE = { media_id: "tabela", _display_media_id: "tabela.jpg", _media_preview_url: "https://cdn.test/tabela-preview.jpg", _media_type: "image", caption: "Planos de outubro" };

describe("send media preview", () => {
  it("draws the picture in a fixed box, decoded off the main thread, so nodes never resize when it loads", () => {
    render(<>{renderMessageContentPreview("action_send_media", TABLE)}</>);
    const image = screen.getByRole("img", { name: "tabela.jpg" });
    expect(image).toHaveAttribute("src", TABLE._media_preview_url);
    expect(image).toHaveAttribute("width");
    expect(image).toHaveAttribute("height");
    expect(image).toHaveAttribute("decoding", "async");
    expect(screen.getByText("Planos de outubro")).toBeInTheDocument();
  });

  it("keeps the same thumbnail when zoomed out, fetched at low priority and without the caption", () => {
    render(<>{renderMessageGlance("action_send_media", TABLE)}</>);
    const image = screen.getByRole("img", { name: "tabela.jpg" });
    expect(image).toHaveAttribute("src", TABLE._media_preview_url);
    expect(image).toHaveAttribute("fetchpriority", "low");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(screen.queryByText("Planos de outubro")).toBeNull();
  });

  it("shows a zoomed out video as a paused frame that never plays", async () => {
    getMediaAction.mockResolvedValueOnce(libraryMedia("tour-video", "video"));
    const { container } = render(<>{renderMessageGlance("action_send_media", { media_id: "tour-video" })}</>);
    await waitFor(() => expect(container.querySelector("video")).not.toBeNull());
    const video = container.querySelector("video")!;
    expect(video).not.toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("preload", "metadata");
  });

  it("reads a library media once for every node that shows it", async () => {
    getMediaAction.mockClear();
    getMediaAction.mockResolvedValue(libraryMedia("arte-compartilhada", "image"));
    const config = { media_id: "arte-compartilhada", _display_media_id: "arte.jpg" };
    render(
      <>
        {renderMessageContentPreview("action_send_media", config)}
        {renderMessageContentPreview("action_send_media", config)}
        {renderMessageGlance("action_send_media", config)}
      </>,
    );
    await waitFor(() => expect(screen.getAllByRole("img", { name: "arte.jpg" })).toHaveLength(3));
    expect(getMediaAction).toHaveBeenCalledTimes(1);
  });

  it("has nothing to glance at for nodes without media", () => {
    expect(renderMessageGlance("action_send_text", { message: "Oi" })).toBeUndefined();
  });
});
