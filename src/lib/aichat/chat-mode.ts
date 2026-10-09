import { CHAT_MODES, type ChatMode } from "./types";

export const STUDIO_MODE_KEY = "assistant-dock:studio-mode";
export const DEFAULT_STUDIO_MODE: ChatMode = "full";

export function parseStoredMode(raw: string | null): ChatMode {
  return (CHAT_MODES as readonly string[]).includes(raw ?? "") ? (raw as ChatMode) : DEFAULT_STUDIO_MODE;
}

export function readStudioMode(storage: Pick<Storage, "getItem"> | null): ChatMode {
  try {
    return parseStoredMode(storage?.getItem(STUDIO_MODE_KEY) ?? null);
  } catch {
    return DEFAULT_STUDIO_MODE;
  }
}

export function writeStudioMode(storage: Pick<Storage, "setItem"> | null, mode: ChatMode): void {
  try {
    storage?.setItem(STUDIO_MODE_KEY, mode);
  } catch {
    return;
  }
}
