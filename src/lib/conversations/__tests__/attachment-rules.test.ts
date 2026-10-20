import { describe, expect, it } from "vitest";

import {
  acceptsAttachments,
  acceptsVoiceNotes,
  attachmentAccept,
  attachmentMegabytes,
  attachmentRefusal,
  attachmentTypeNames,
  composerMediaLimits,
  readMediaLimits,
} from "@/lib/conversations/attachment-rules";
import type { ChannelMediaLimit, EntryType } from "@/lib/conversations/types";

const MB = 1024 * 1024;

function file(name: string, type: string, size: number): File {
  const made = new File(["x"], name, { type });
  Object.defineProperty(made, "size", { value: size });
  return made;
}

const MERCADOLIVRE_WIRE = [
  { kind: "document", max_bytes: 25 * MB, mime_types: ["application/pdf", "text/plain"] },
  { kind: "image", max_bytes: 25 * MB, mime_types: ["image/jpeg", "image/png"] },
];

const OFFICE_DOCUMENTS = [
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const BACKEND_DESCRIPTORS: Record<EntryType, ChannelMediaLimit[]> = {
  whatsapp: [
    { kind: "audio", max_bytes: 16 * MB, mime_types: [] },
    { kind: "document", max_bytes: 100 * MB, mime_types: OFFICE_DOCUMENTS },
    { kind: "image", max_bytes: 5 * MB, mime_types: ["image/jpeg", "image/png"] },
    { kind: "video", max_bytes: 16 * MB, mime_types: ["video/3gpp", "video/mp4"] },
  ],
  unofficial_whatsapp: [
    {
      kind: "audio",
      max_bytes: 16 * MB,
      mime_types: ["audio/3gpp", "audio/aac", "audio/amr", "audio/m4a", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/opus", "audio/wav", "audio/webm", "audio/x-m4a", "audio/x-wav"],
    },
    { kind: "document", max_bytes: 100 * MB, mime_types: [] },
    { kind: "image", max_bytes: 16 * MB, mime_types: ["image/jpeg", "image/png", "image/webp"] },
    { kind: "video", max_bytes: 16 * MB, mime_types: ["video/3gpp", "video/mp4"] },
  ],
  instagram: [
    { kind: "audio", max_bytes: 25 * MB, mime_types: ["audio/aac", "audio/m4a", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"] },
    { kind: "document", max_bytes: 25 * MB, mime_types: ["application/pdf"] },
    { kind: "image", max_bytes: 8 * MB, mime_types: ["image/jpeg", "image/png"] },
    { kind: "video", max_bytes: 25 * MB, mime_types: ["video/mp4", "video/ogg", "video/quicktime", "video/webm", "video/x-msvideo"] },
  ],
  facebook: [
    { kind: "audio", max_bytes: 25 * MB, mime_types: ["audio/aac", "audio/m4a", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"] },
    { kind: "document", max_bytes: 25 * MB, mime_types: [] },
    { kind: "image", max_bytes: 8 * MB, mime_types: ["image/gif", "image/jpeg", "image/png"] },
    { kind: "video", max_bytes: 25 * MB, mime_types: ["video/mp4"] },
  ],
  telegram: [
    { kind: "audio", max_bytes: 50 * MB, mime_types: ["audio/aac", "audio/m4a", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-wav"] },
    { kind: "document", max_bytes: 50 * MB, mime_types: [] },
    { kind: "image", max_bytes: 10 * MB, mime_types: ["image/gif", "image/jpeg", "image/png", "image/webp"] },
    { kind: "video", max_bytes: 50 * MB, mime_types: ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"] },
  ],
  webchat: [
    { kind: "audio", max_bytes: 25 * MB, mime_types: [] },
    { kind: "document", max_bytes: 50 * MB, mime_types: [] },
    { kind: "image", max_bytes: 10 * MB, mime_types: ["image/gif", "image/jpeg", "image/png", "image/webp"] },
    { kind: "video", max_bytes: 50 * MB, mime_types: [] },
  ],
  mercadolivre: MERCADOLIVRE_WIRE as ChannelMediaLimit[],
  tiktok: [{ kind: "image", max_bytes: 3 * MB, mime_types: ["image/jpeg", "image/png"] }],
};

describe("reading the media limits a subscribe answer carries", () => {
  it("keeps an absent field unknown", () => {
    expect(readMediaLimits(undefined)).toBeUndefined();
    expect(readMediaLimits(null)).toBeUndefined();
  });

  it("keeps an empty list as a channel that takes no attachments", () => {
    expect(readMediaLimits([])).toEqual([]);
  });

  it("reads each kind with its size and formats", () => {
    expect(readMediaLimits(MERCADOLIVRE_WIRE)).toEqual(MERCADOLIVRE_WIRE);
  });

  it("treats a malformed list as unknown rather than guessing", () => {
    expect(readMediaLimits({ kind: "image" })).toBeUndefined();
    expect(readMediaLimits([{ kind: "image", max_bytes: "10", mime_types: [] }])).toBeUndefined();
    expect(readMediaLimits([{ kind: "image", max_bytes: 0, mime_types: [] }])).toBeUndefined();
    expect(readMediaLimits([{ kind: "image", max_bytes: 10 }])).toBeUndefined();
    expect(readMediaLimits([{ kind: "image", max_bytes: 10, mime_types: [1] }])).toBeUndefined();
    expect(readMediaLimits([{ max_bytes: 10, mime_types: [] }])).toBeUndefined();
  });

  it("drops a kind the composer cannot send instead of widening another", () => {
    expect(readMediaLimits([{ kind: "sticker", max_bytes: 10, mime_types: [] }, ...MERCADOLIVRE_WIRE])).toEqual(MERCADOLIVRE_WIRE);
  });

  it("lowercases the formats it compares against", () => {
    expect(readMediaLimits([{ kind: "image", max_bytes: 10, mime_types: ["Image/JPEG"] }])).toEqual([
      { kind: "image", max_bytes: 10, mime_types: ["image/jpeg"] },
    ]);
  });
});

describe("refusing a file against the channel limits", () => {
  const limits = readMediaLimits(MERCADOLIVRE_WIRE);

  it("refuses every file while the limits are unknown", () => {
    expect(attachmentRefusal(file("foto.jpg", "image/jpeg", 10), undefined)).toEqual({ reason: "unknown" });
  });

  it("refuses every file on a channel that takes none", () => {
    expect(attachmentRefusal(file("foto.jpg", "image/jpeg", 10), [])).toEqual({ reason: "none" });
  });

  it("accepts the listed formats up to the size of their kind", () => {
    expect(attachmentRefusal(file("foto.jpg", "image/jpeg", 25 * MB), limits)).toBeNull();
    expect(attachmentRefusal(file("print.png", "image/png", 10), limits)).toBeNull();
    expect(attachmentRefusal(file("nota.pdf", "application/pdf", 10), limits)).toBeNull();
    expect(attachmentRefusal(file("leia.txt", "text/plain;charset=utf-8", 10), limits)).toBeNull();
  });

  it("refuses a kind the channel does not list, an unlisted format and a file without a type", () => {
    expect(attachmentRefusal(file("video.mp4", "video/mp4", 10), limits)).toEqual({ reason: "type" });
    expect(attachmentRefusal(file("audio.ogg", "audio/ogg", 10), limits)).toEqual({ reason: "type" });
    expect(attachmentRefusal(file("animado.gif", "image/gif", 10), limits)).toEqual({ reason: "type" });
    expect(attachmentRefusal(file("planilha.xlsx", "", 10), limits)).toEqual({ reason: "type" });
  });

  it("refuses a file over the size of its kind and says which size", () => {
    expect(attachmentRefusal(file("grande.pdf", "application/pdf", 25 * MB + 1), limits)).toEqual({ reason: "size", maxBytes: 25 * MB });
  });

  it("accepts any format of a kind whose list is empty", () => {
    const anyDocument: ChannelMediaLimit[] = [{ kind: "document", max_bytes: 5 * MB, mime_types: [] }];
    expect(attachmentRefusal(file("pacote.zip", "application/zip", 10), anyDocument)).toBeNull();
    expect(attachmentRefusal(file("sem-tipo.bin", "", 10), anyDocument)).toBeNull();
    expect(attachmentRefusal(file("foto.jpg", "image/jpeg", 10), anyDocument)).toEqual({ reason: "type" });
  });
});

describe("what the composer offers", () => {
  it("offers attachments only when the channel lists a kind", () => {
    expect(acceptsAttachments(undefined)).toBe(false);
    expect(acceptsAttachments([])).toBe(false);
    expect(acceptsAttachments(readMediaLimits(MERCADOLIVRE_WIRE))).toBe(true);
  });

  it("offers a voice note only when the channel takes audio", () => {
    expect(acceptsVoiceNotes(undefined)).toBe(false);
    expect(acceptsVoiceNotes(readMediaLimits(MERCADOLIVRE_WIRE))).toBe(false);
    expect(acceptsVoiceNotes(BACKEND_DESCRIPTORS.telegram)).toBe(true);
  });

  it("narrows the Mercado Livre picker to JPG, PNG, PDF and TXT", () => {
    expect(attachmentAccept(readMediaLimits(MERCADOLIVRE_WIRE))).toBe(".jpg,.jpeg,.png,.pdf,.txt,image/jpeg,image/png,application/pdf,text/plain");
  });

  it("opens the picker to every file when documents of any format are taken", () => {
    expect(attachmentAccept(BACKEND_DESCRIPTORS.telegram)).toBe("");
  });

  it("uses a wildcard for a kind of any format", () => {
    expect(attachmentAccept([{ kind: "audio", max_bytes: 10, mime_types: [] }, { kind: "image", max_bytes: 10, mime_types: ["image/png"] }])).toBe(
      ".png,image/png,audio/*",
    );
  });

  it("names the accepted formats in kind order, and kinds of any format by their kind", () => {
    expect(attachmentTypeNames(readMediaLimits(MERCADOLIVRE_WIRE))).toEqual([{ format: "JPG" }, { format: "PNG" }, { format: "PDF" }, { format: "TXT" }]);
    expect(attachmentTypeNames(BACKEND_DESCRIPTORS.webchat)).toEqual([
      { format: "GIF" },
      { format: "JPG" },
      { format: "PNG" },
      { format: "WEBP" },
      { kind: "video" },
      { kind: "audio" },
      { kind: "document" },
    ]);
  });

  it("names a format it has no short name for by its type, once", () => {
    expect(attachmentTypeNames([{ kind: "audio", max_bytes: 10, mime_types: ["audio/x-wav", "audio/wav", "audio/flac"] }])).toEqual([
      { format: "WAV" },
      { format: "audio/flac" },
    ]);
  });

  it("states a size in whole megabytes", () => {
    expect(attachmentMegabytes(25 * MB)).toBe(25);
    expect(attachmentMegabytes(5 * MB)).toBe(5);
  });
});

describe("audio the server converts before its own limits apply", () => {
  const longVoiceNote = file("audio-message.wav", "audio/wav", 30 * MB);
  const flac = file("musica.flac", "audio/flac", 10);

  it("keeps sending long voice notes and any audio format on both WhatsApp channels, as before", () => {
    for (const entryType of ["whatsapp", "unofficial_whatsapp"] as const) {
      const limits = composerMediaLimits(entryType, BACKEND_DESCRIPTORS[entryType]);
      expect(attachmentRefusal(longVoiceNote, limits)).toBeNull();
      expect(attachmentRefusal(flac, limits)).toBeNull();
      expect(attachmentRefusal(file("animado.gif", "image/gif", MB), limits)).toEqual({ reason: "type" });
    }
  });

  it("leaves every other channel to its own audio limit", () => {
    const limits = composerMediaLimits("instagram", BACKEND_DESCRIPTORS.instagram);
    expect(attachmentRefusal(longVoiceNote, limits)).toEqual({ reason: "size", maxBytes: 25 * MB });
    expect(attachmentRefusal(flac, limits)).toEqual({ reason: "type" });
  });

  it("never invents audio on a channel that lists none, nor limits that are unknown", () => {
    expect(composerMediaLimits("whatsapp", undefined)).toBeUndefined();
    expect(composerMediaLimits("whatsapp", [])).toEqual([]);
    const imagesOnly: ChannelMediaLimit[] = [{ kind: "image", max_bytes: 10, mime_types: [] }];
    expect(acceptsVoiceNotes(composerMediaLimits("unofficial_whatsapp", imagesOnly))).toBe(false);
  });
});

describe("what the composer sent before the server limits, per channel", () => {
  const voiceNotes = ["audio/wav", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];

  it("still takes the recorded voice note on every channel that takes audio", () => {
    for (const entryType of ["whatsapp", "unofficial_whatsapp", "instagram", "facebook", "telegram", "webchat"] as const) {
      const limits = composerMediaLimits(entryType, BACKEND_DESCRIPTORS[entryType]);
      expect(acceptsVoiceNotes(limits)).toBe(true);
      expect(attachmentRefusal(file("audio-message.wav", voiceNotes[0], 2 * MB), limits)).toBeNull();
    }
  });

  it("takes every recorder fallback format on both WhatsApp channels and webchat", () => {
    for (const entryType of ["whatsapp", "unofficial_whatsapp", "webchat"] as const) {
      const limits = composerMediaLimits(entryType, BACKEND_DESCRIPTORS[entryType]);
      for (const type of voiceNotes) expect(attachmentRefusal(file("audio-message", type, 2 * MB), limits)).toBeNull();
    }
  });

  it("takes the common photo, video and PDF on every channel but Mercado Livre video", () => {
    for (const entryType of ["whatsapp", "unofficial_whatsapp", "instagram", "facebook", "telegram", "webchat"] as const) {
      const limits = composerMediaLimits(entryType, BACKEND_DESCRIPTORS[entryType]);
      expect(attachmentRefusal(file("foto.jpg", "image/jpeg", 2 * MB), limits)).toBeNull();
      expect(attachmentRefusal(file("video.mp4", "video/mp4", 10 * MB), limits)).toBeNull();
      expect(attachmentRefusal(file("nota.pdf", "application/pdf", 2 * MB), limits)).toBeNull();
    }
  });

  it("takes only JPG and PNG photos up to 3 MB on TikTok, and no voice notes", () => {
    const limits = composerMediaLimits("tiktok", BACKEND_DESCRIPTORS.tiktok);
    expect(attachmentRefusal(file("foto.jpg", "image/jpeg", 2 * MB), limits)).toBeNull();
    expect(attachmentRefusal(file("foto.png", "image/png", 4 * MB), limits)).toEqual({ reason: "size", maxBytes: 3 * MB });
    expect(attachmentRefusal(file("animado.gif", "image/gif", MB), limits)).toEqual({ reason: "type" });
    expect(attachmentRefusal(file("video.mp4", "video/mp4", MB), limits)).toEqual({ reason: "type" });
    expect(acceptsVoiceNotes(limits)).toBe(false);
  });
});
