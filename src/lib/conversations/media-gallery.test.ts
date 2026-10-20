import { describe, expect, it } from "vitest";

import { galleryIndexOf, galleryItems, stepGallery } from "./media-gallery";
import type { ConversationMessage } from "./types";

function msg(id: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id,
    entry_id: "e1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: "+5511999999999",
    to: "+5511888888888",
    text: "",
    sender_name: "Ana",
    read: true,
    read_at: null,
    read_by: null,
    created_at: "2026-10-18T10:00:00Z",
    updated_at: "2026-10-18T10:00:00Z",
    ...overrides,
  };
}

describe("gallery items", () => {
  const messages = [
    msg("photo", { media_type: "image", media_url: "https://cdn/p.jpg", text: "a cat" }),
    msg("text", { text: "hello" }),
    msg("clip", { media_type: "video", media_id: "m-2" }),
    msg("sticker", { media_type: "sticker", media_url: "https://cdn/s.webp" }),
    msg("voice", { media_type: "audio", media_url: "https://cdn/v.ogg" }),
    msg("pending", { media_type: "image" }),
  ];

  it("lists the conversation's loaded photos and videos in thread order, nothing else", () => {
    expect(galleryItems(messages).map((item) => [item.messageId, item.type])).toEqual([
      ["photo", "image"],
      ["clip", "video"],
    ]);
  });

  it("keeps what the viewer needs to fetch or describe each item", () => {
    expect(galleryItems(messages)[1]).toEqual({
      messageId: "clip",
      type: "video",
      url: undefined,
      mediaId: "m-2",
      entryType: "whatsapp",
      entryId: "e1",
      caption: "",
    });
  });

  it("finds where a clicked message sits in the gallery", () => {
    const items = galleryItems(messages);
    expect(galleryIndexOf(items, "clip")).toBe(1);
    expect(galleryIndexOf(items, "text")).toBe(-1);
  });
});

describe("gallery steps", () => {
  it("moves forward and back", () => {
    expect(stepGallery(1, 1, 3)).toBe(2);
    expect(stepGallery(1, -1, 3)).toBe(0);
  });

  it("stops at both ends instead of wrapping around", () => {
    expect(stepGallery(2, 1, 3)).toBe(2);
    expect(stepGallery(0, -1, 3)).toBe(0);
  });
});
