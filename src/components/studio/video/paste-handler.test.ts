import { describe, expect, it, vi } from "vitest";

import { encodeClipboard } from "@/lib/studio/clip-clipboard";
import { newMediaClip } from "@/lib/studio/document";

import { createPasteHandler } from "./paste-handler";

const payload = { items: [{ trackId: "main", trackKind: "visual" as const, offsetMs: 0, clip: { ...newMediaClip("image", "img", 0, 1000), id: "c" } }], spanMs: 1000 };

function clipboard(files: File[], text: string) {
  return {
    items: files.map((file) => ({ kind: "file", getAsFile: () => file })) as unknown as DataTransferItemList,
    files: [] as unknown as FileList,
    getData: () => text,
  } as unknown as DataTransfer;
}

function setup(memory: typeof payload | null = null) {
  const commands = { paste: vi.fn(), pasteImages: vi.fn(async () => undefined), clipboardPayload: () => memory };
  return { commands, handler: createPasteHandler(commands) };
}

describe("paste routing", () => {
  it("uploads pasted images and stops the browser default", () => {
    const { commands, handler } = setup();
    const image = new File(["x"], "shot.png", { type: "image/png" });
    const event = { target: document.body, clipboardData: clipboard([image], ""), preventDefault: vi.fn() };
    expect(handler.onPaste(event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(commands.pasteImages).toHaveBeenCalledWith([image]);
  });

  it("pastes copied clips, inserting when Shift was held with Ctrl+V", () => {
    const { commands, handler } = setup();
    handler.onKeyDown({ key: "V", ctrlKey: true, metaKey: false, shiftKey: true });
    handler.onPaste({ target: document.body, clipboardData: clipboard([], encodeClipboard(payload)), preventDefault: vi.fn() });
    expect(commands.paste).toHaveBeenCalledWith("insert", payload);
    handler.onPaste({ target: document.body, clipboardData: clipboard([], encodeClipboard(payload)), preventDefault: vi.fn() });
    expect(commands.paste).toHaveBeenLastCalledWith("overwrite", payload);
  });

  it("leaves text fields and unknown text alone", () => {
    const { commands, handler } = setup(payload);
    const input = document.createElement("input");
    expect(handler.onPaste({ target: input, clipboardData: clipboard([], encodeClipboard(payload)), preventDefault: vi.fn() })).toBe(false);
    expect(handler.onPaste({ target: document.body, clipboardData: clipboard([], "plain words"), preventDefault: vi.fn() })).toBe(false);
    expect(commands.paste).not.toHaveBeenCalled();
  });
});
