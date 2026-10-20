import type { ConversationMessage, EntryType } from "./types";

export type GalleryMediaType = "image" | "video";

export interface GalleryItem {
  messageId: string;
  type: GalleryMediaType;
  url?: string;
  mediaId?: string;
  entryType?: EntryType;
  entryId?: string;
  caption: string;
}

function isGalleryType(type: string | undefined): type is GalleryMediaType {
  return type === "image" || type === "video";
}

export function galleryItems(messages: readonly ConversationMessage[]): GalleryItem[] {
  return messages.flatMap((message) => {
    const type = message.media_type;
    if (!isGalleryType(type) || (!message.media_url && !message.media_id)) return [];
    return [
      {
        messageId: message.id,
        type,
        url: message.media_url,
        mediaId: message.media_id,
        entryType: message.entry_type,
        entryId: message.entry_id,
        caption: message.text ?? "",
      },
    ];
  });
}

export function galleryIndexOf(items: readonly GalleryItem[], messageId: string): number {
  return items.findIndex((item) => item.messageId === messageId);
}

export function stepGallery(index: number, delta: number, length: number): number {
  return Math.min(Math.max(index + delta, 0), Math.max(length - 1, 0));
}
