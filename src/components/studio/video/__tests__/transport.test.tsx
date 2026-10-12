import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";

import { Transport } from "../preview/transport";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 2000), id: "c" }] }];
  d.durationMs = 2000;
  return d;
}

describe("preview speed by hand", () => {
  it("picks a slower or faster preview speed without touching the video", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Transport />);
    const before = editor.store.getState().document;
    fireEvent.keyDown(screen.getByRole("button", { name: "Velocidade da reprodução: 1×" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "0,5×" }));
    expect(editor.view.getState().previewRate).toBe(0.5);
    expect(screen.getByRole("button", { name: "Velocidade da reprodução: 0,5×" })).toBeTruthy();
    expect(editor.store.getState().document).toBe(before);
  });
});
