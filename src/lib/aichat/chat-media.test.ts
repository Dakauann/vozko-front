import { describe, expect, it } from "vitest";

import { chatMediaKind } from "./chat-media";

const media = { url: "https://cdn.example.com/m.bin", mediaId: "m-1", alt: "jingle da padaria" };

describe("chatMediaKind", () => {
  it("reads the kind the server sent", () => {
    expect(chatMediaKind({ ...media, kind: "audio" })).toBe("audio");
    expect(chatMediaKind({ ...media, kind: "video" })).toBe("video");
    expect(chatMediaKind({ ...media, kind: "image" })).toBe("image");
  });

  it("treats media from older threads, which carry no kind, as images", () => {
    expect(chatMediaKind(media)).toBe("image");
  });

  it("treats a kind it does not know as an image", () => {
    expect(chatMediaKind({ ...media, kind: "hologram" as never })).toBe("image");
  });
});
