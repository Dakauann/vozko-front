import { describe, expect, it } from "vitest";

import { messageMedia } from "./message-media";

describe("messageMedia", () => {
  it("reads the media the server attached to the message", () => {
    expect(
      messageMedia({ mediaId: "m1", media: { url: "https://cdn/1.jpg", layout: { width: 800, height: 600, thumbhash: "abc" } } }),
    ).toEqual({ media_url: "https://cdn/1.jpg", media_layout: { width: 800, height: 600, thumbhash: "abc" } });
  });

  it("keeps an address already on the message", () => {
    expect(messageMedia({ media_url: "https://cdn/2.jpg" })).toEqual({ media_url: "https://cdn/2.jpg", media_layout: undefined });
  });

  it("ignores malformed layouts", () => {
    expect(messageMedia({ media: { url: "https://cdn/3.jpg", layout: { width: "wide", height: -1 } } })).toEqual({
      media_url: "https://cdn/3.jpg",
      media_layout: undefined,
    });
    expect(messageMedia({})).toEqual({ media_url: undefined, media_layout: undefined });
  });
});
