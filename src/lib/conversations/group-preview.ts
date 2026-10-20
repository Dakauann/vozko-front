import type { InboxEntry } from "./types";

type PreviewSource = Pick<InboxEntry, "is_group" | "last_message_preview" | "last_message_author" | "last_message_from_us">;

function withPrefix(prefix: string | null | undefined, preview: string): string {
  const label = (prefix ?? "").trim();
  return label ? `${label}: ${preview}` : preview;
}

export function previewWithAuthor(entry: PreviewSource, youLabel: string, senderLabel?: string | null): string {
  const preview = entry.last_message_preview ?? "";
  if (preview === "") return preview;
  if (!entry.is_group) return withPrefix(senderLabel, preview);
  return withPrefix(entry.last_message_from_us ? youLabel : entry.last_message_author, preview);
}
