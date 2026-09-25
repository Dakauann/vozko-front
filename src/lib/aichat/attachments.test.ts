import { describe, expect, it } from "vitest";

import { attachmentProblem, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, mediaTypeFor } from "./attachments";

function file(name: string, type: string, size = 10): { name: string; type: string; size: number } {
  return { name, type, size };
}

describe("mediaTypeFor", () => {
  it("maps files to the media library types", () => {
    expect(mediaTypeFor(file("banner.png", "image/png"))).toBe("image");
    expect(mediaTypeFor(file("promo.mp4", "video/mp4"))).toBe("video");
    expect(mediaTypeFor(file("audio.ogg", "audio/ogg"))).toBe("audio");
    expect(mediaTypeFor(file("Tabela.PDF", ""))).toBe("document_pdf");
    expect(mediaTypeFor(file("faq.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toBe("document_doc");
    expect(mediaTypeFor(file("lista.csv", "text/csv"))).toBe("document");
  });
});

describe("attachmentProblem", () => {
  it("accepts a small file while there is room", () => {
    expect(attachmentProblem(0, file("lista.csv", "text/csv"))).toBeNull();
  });

  it("refuses more than the limit per message", () => {
    expect(attachmentProblem(MAX_ATTACHMENTS, file("lista.csv", "text/csv"))).toBe("tooMany");
  });

  it("refuses files over the upload limit and empty files", () => {
    expect(attachmentProblem(0, file("big.pdf", "application/pdf", MAX_ATTACHMENT_BYTES + 1))).toBe("tooLarge");
    expect(attachmentProblem(0, file("empty.csv", "text/csv", 0))).toBe("empty");
  });
});
