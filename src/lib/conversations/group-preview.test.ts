import { describe, expect, it } from "vitest";

import { previewWithAuthor } from "./group-preview";
import type { InboxEntry } from "./types";

function entry(extra: Partial<InboxEntry>): InboxEntry {
  return { entry_id: "e", entry_type: "unofficial_whatsapp", last_message_preview: "Olá", ...extra } as InboxEntry;
}

describe("previewWithAuthor", () => {
  it("prefixes a group preview with the member who sent it", () => {
    expect(previewWithAuthor(entry({ is_group: true, last_message_author: "Rita" }), "Você")).toBe("Rita: Olá");
  });

  it("prefixes our own last message in a group with the you label", () => {
    expect(previewWithAuthor(entry({ is_group: true, last_message_from_us: true }), "Você")).toBe("Você: Olá");
  });

  it("leaves one-to-one previews untouched", () => {
    expect(previewWithAuthor(entry({ last_message_author: "Rita", last_message_from_us: true }), "Você")).toBe("Olá");
  });

  it("leaves a group preview untouched when nobody is known", () => {
    expect(previewWithAuthor(entry({ is_group: true, last_message_author: "  " }), "Você")).toBe("Olá");
  });

  it("adds no dangling prefix to an empty preview", () => {
    expect(previewWithAuthor(entry({ is_group: true, last_message_author: "Rita", last_message_preview: "" }), "Você")).toBe("");
  });
});
