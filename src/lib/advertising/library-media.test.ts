import { describe, expect, it } from "vitest";

import type { Media } from "@/lib/medias/types";

import { libraryChoices } from "./library-media";

function media(overrides: Partial<Media>): Media {
  return { id: "m-1", description: "", url: "https://cdn.example.com/m-1", previewUrl: "", createdAt: "2026-10-05T10:00:00Z", type: "image", ...overrides };
}

const library = [
  media({ id: "img-1", type: "image", url: "https://cdn.example.com/a.jpg" }),
  media({ id: "vid-1", type: "video", url: "https://cdn.example.com/b.mp4" }),
  media({ id: "aud-1", type: "audio", url: "https://cdn.example.com/c.m4a" }),
  media({ id: "doc-1", type: "document_pdf", url: "https://cdn.example.com/d.pdf" }),
  media({ id: "vid-2", type: "video", url: "" }),
];

describe("libraryChoices", () => {
  it("offers only the videos when the slot takes a video", () => {
    expect(libraryChoices(library, "video")).toEqual([{ kind: "video", mediaId: "vid-1", url: "https://cdn.example.com/b.mp4" }]);
  });

  it("offers only the images when the slot takes an image", () => {
    expect(libraryChoices(library, "image")).toEqual([{ kind: "image", mediaId: "img-1", url: "https://cdn.example.com/a.jpg" }]);
  });

  it("offers images and videos, never audio or documents, when the slot takes either", () => {
    expect(libraryChoices(library, "any").map((choice) => choice.mediaId)).toEqual(["img-1", "vid-1"]);
  });

  it("leaves out media without a url", () => {
    expect(libraryChoices(library, "video").some((choice) => choice.mediaId === "vid-2")).toBe(false);
  });
});
