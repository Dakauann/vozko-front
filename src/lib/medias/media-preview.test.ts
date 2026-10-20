import { describe, expect, it } from "vitest";

import { mediaKindOf, mediaTypeFromUrl, mediaVisual } from "./media-preview";

describe("mediaKindOf", () => {
  it("groups library and node media types into what a preview can draw", () => {
    expect(mediaKindOf("image")).toBe("image");
    expect(mediaKindOf("IMAGE/PNG")).toBe("image");
    expect(mediaKindOf("sticker")).toBe("image");
    expect(mediaKindOf("video")).toBe("video");
    expect(mediaKindOf("audio")).toBe("audio");
    expect(mediaKindOf("document_pdf")).toBe("document");
    expect(mediaKindOf("")).toBe("document");
  });
});

describe("mediaTypeFromUrl", () => {
  it("reads the type from the file extension of a pasted link, ignoring the query", () => {
    expect(mediaTypeFromUrl("https://cdn.test/tabela.JPG?v=2")).toBe("image");
    expect(mediaTypeFromUrl("https://cdn.test/tour.mp4")).toBe("video");
    expect(mediaTypeFromUrl("https://cdn.test/audio.opus")).toBe("audio");
    expect(mediaTypeFromUrl("https://cdn.test/contrato.pdf")).toBe("document");
    expect(mediaTypeFromUrl("https://cdn.test/arquivo")).toBe("");
  });
});

const TABLE = { url: "https://cdn.test/tabela.jpg", previewUrl: "https://cdn.test/tabela-preview.jpg" };

describe("mediaVisual", () => {
  it("draws the stored thumbnail at every zoom, so crossing the detail threshold reuses the cached file", () => {
    expect(mediaVisual("glance", "image", TABLE)).toEqual({ element: "img", src: TABLE.previewUrl, priority: "low" });
    expect(mediaVisual("full", "image", TABLE)).toEqual({ element: "img", src: TABLE.previewUrl, priority: "auto" });
  });

  it("falls back to the original file when the library has no thumbnail", () => {
    expect(mediaVisual("glance", "image", { url: TABLE.url, previewUrl: "" })).toEqual({ element: "img", src: TABLE.url, priority: "low" });
  });

  it("shows a placeholder, never an empty image, when nothing can be drawn", () => {
    expect(mediaVisual("glance", "image", { url: "", previewUrl: "" })).toEqual({ element: "placeholder" });
    expect(mediaVisual("full", "video", { url: "", previewUrl: "" })).toEqual({ element: "placeholder" });
  });

  it("gives a zoomed out video its image thumbnail instead of a video element", () => {
    const clip = { url: "https://cdn.test/tour.mp4", previewUrl: "https://cdn.test/tour-preview.jpg" };
    expect(mediaVisual("glance", "video", clip)).toEqual({ element: "img", src: clip.previewUrl, priority: "low" });
    expect(mediaVisual("full", "video", clip)).toEqual({ element: "video", src: clip.url, poster: clip.previewUrl });
  });

  it("uses a paused first frame for a video without a thumbnail, and never takes the video link for an image", () => {
    const clip = { url: "https://cdn.test/tour.mp4", previewUrl: "https://cdn.test/tour.mp4" };
    expect(mediaVisual("glance", "video", clip)).toEqual({ element: "video", src: clip.url, poster: "" });
    expect(mediaVisual("full", "video", clip)).toEqual({ element: "video", src: clip.url, poster: "" });
  });

  it("keeps audio and documents as their compact rows", () => {
    expect(mediaVisual("glance", "audio", { url: "https://cdn.test/a.mp3", previewUrl: "" })).toEqual({ element: "audio" });
    expect(mediaVisual("full", "document", { url: "https://cdn.test/c.pdf", previewUrl: "" })).toEqual({ element: "document" });
  });
});
