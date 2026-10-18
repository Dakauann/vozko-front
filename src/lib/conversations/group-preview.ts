import type { InboxEntry } from "./types";

type PreviewSource = Pick<InboxEntry, "is_group" | "last_message_preview" | "last_message_author" | "last_message_from_us">;

export function previewWithAuthor(entry: PreviewSource, youLabel: string): string {
  const preview = entry.last_message_preview ?? "";
  if (!entry.is_group || preview === "") {
    return preview;
  }
  const author = entry.last_message_from_us ? youLabel : (entry.last_message_author ?? "").trim();
  return author ? `${author}: ${preview}` : preview;
}
