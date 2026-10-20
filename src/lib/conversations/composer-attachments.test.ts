import { describe, expect, it } from "vitest";

import {
  acceptsCaption,
  attachmentsReady,
  fromDraftAttachments,
  hasCaptionTarget,
  planOutgoing,
  toDraftAttachments,
  type ComposerAttachment,
} from "./composer-attachments";

function ready(localId: string, type: ComposerAttachment["type"], mediaId = `media-${localId}`): ComposerAttachment {
  return { localId, name: `${localId}.bin`, size: 10, type, status: "ready", mediaId };
}

describe("acceptsCaption", () => {
  it.each([
    ["image", true],
    ["video", true],
    ["document", true],
    ["audio", false],
    ["sticker", false],
  ] as const)("%s carries a caption: %s", (type, expected) => {
    expect(acceptsCaption(type)).toBe(expected);
  });
});

describe("planOutgoing", () => {
  it("sends plain text alone when nothing is attached", () => {
    expect(planOutgoing("  Olá  ", [])).toEqual([{ kind: "text", text: "Olá" }]);
  });

  it("sends nothing when there is neither text nor attachment", () => {
    expect(planOutgoing("   ", [])).toEqual([]);
  });

  it("sends each attachment as its own message, in the order they were queued", () => {
    expect(planOutgoing("", [ready("a", "image"), ready("b", "document")])).toEqual([
      { kind: "media", mediaId: "media-a", mediaType: "image", caption: "" },
      { kind: "media", mediaId: "media-b", mediaType: "document", caption: "" },
    ]);
  });

  it("puts the text on the first attachment that accepts a caption, skipping audio", () => {
    expect(planOutgoing("veja", [ready("a", "audio"), ready("b", "image"), ready("c", "video")])).toEqual([
      { kind: "media", mediaId: "media-a", mediaType: "audio", caption: "" },
      { kind: "media", mediaId: "media-b", mediaType: "image", caption: "veja" },
      { kind: "media", mediaId: "media-c", mediaType: "video", caption: "" },
    ]);
  });

  it("sends the text after the media when no attachment can carry it, so typed words are never dropped", () => {
    expect(planOutgoing("ouça", [ready("a", "audio")])).toEqual([
      { kind: "media", mediaId: "media-a", mediaType: "audio", caption: "" },
      { kind: "text", text: "ouça" },
    ]);
  });

  it("quotes the reply target on the first part only, so a multi part send quotes it once", () => {
    expect(planOutgoing("veja", [ready("a", "audio"), ready("b", "image")], "q1")).toEqual([
      { kind: "media", mediaId: "media-a", mediaType: "audio", caption: "", replyToMessageId: "q1" },
      { kind: "media", mediaId: "media-b", mediaType: "image", caption: "veja" },
    ]);
    expect(planOutgoing("oi", [], "q1")).toEqual([{ kind: "text", text: "oi", replyToMessageId: "q1" }]);
  });

  it("leaves out attachments that never finished uploading", () => {
    const failed: ComposerAttachment = { localId: "x", name: "x", size: 1, type: "image", status: "failed", error: "boom" };
    expect(planOutgoing("oi", [failed, ready("b", "image")])).toEqual([
      { kind: "media", mediaId: "media-b", mediaType: "image", caption: "oi" },
    ]);
  });
});

describe("attachmentsReady", () => {
  it("is ready only when every attachment has uploaded", () => {
    expect(attachmentsReady([])).toBe(true);
    expect(attachmentsReady([ready("a", "image")])).toBe(true);
    expect(attachmentsReady([ready("a", "image"), { ...ready("b", "image"), status: "uploading", mediaId: undefined }])).toBe(false);
    expect(attachmentsReady([{ ...ready("a", "image"), status: "failed" }])).toBe(false);
  });
});

describe("hasCaptionTarget", () => {
  it("knows when only voice notes are queued", () => {
    expect(hasCaptionTarget([])).toBe(true);
    expect(hasCaptionTarget([ready("a", "audio")])).toBe(false);
    expect(hasCaptionTarget([ready("a", "audio"), ready("b", "image")])).toBe(true);
  });
});

describe("draft round trip", () => {
  it("keeps only uploaded attachments in a draft and restores them ready to send", () => {
    const uploading: ComposerAttachment = { localId: "u", name: "u", size: 1, type: "image", status: "uploading" };
    const stored = toDraftAttachments([ready("a", "image"), uploading]);
    expect(stored).toEqual([{ mediaId: "media-a", type: "image", name: "a.bin", size: 10 }]);
    expect(fromDraftAttachments(stored)).toEqual([
      { localId: "media-a", mediaId: "media-a", type: "image", name: "a.bin", size: 10, status: "ready" },
    ]);
  });
});
