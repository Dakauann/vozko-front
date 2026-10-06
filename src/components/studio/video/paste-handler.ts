"use client";

import { pasteRoute } from "@/lib/studio/clip-clipboard";
import { imageFilesFrom } from "@/lib/studio/clipboard-files";
import { isEditableTarget } from "@/lib/studio/keymap";

import type { EditorCommands } from "./editor-commands";

type PasteCommands = Pick<EditorCommands, "paste" | "pasteImages" | "clipboardPayload">;

export function createPasteHandler(commands: PasteCommands) {
  let insert = false;
  return {
    onKeyDown(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey">) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") insert = event.shiftKey;
    },
    onPaste(event: Pick<ClipboardEvent, "target" | "clipboardData" | "preventDefault">): boolean {
      if (isEditableTarget(event.target) || !event.clipboardData) return false;
      const route = pasteRoute(imageFilesFrom(event.clipboardData), event.clipboardData.getData("text/plain"), commands.clipboardPayload());
      const mode = insert ? "insert" : "overwrite";
      insert = false;
      if (route.kind === "none") return false;
      event.preventDefault();
      if (route.kind === "images") void commands.pasteImages(route.files);
      else commands.paste(mode, route.payload);
      return true;
    },
  };
}

export function bindPaste(commands: PasteCommands): () => void {
  const handler = createPasteHandler(commands);
  const onKeyDown = (event: KeyboardEvent) => handler.onKeyDown(event);
  const onPaste = (event: ClipboardEvent) => void handler.onPaste(event);
  window.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("paste", onPaste);
  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("paste", onPaste);
  };
}
