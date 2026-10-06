import type { ChatMedia, ChatMediaKind } from "./types";

const KINDS: readonly ChatMediaKind[] = ["image", "audio", "video"];

export function chatMediaKind(media: ChatMedia): ChatMediaKind {
  return KINDS.find((kind) => kind === media.kind) ?? "image";
}
