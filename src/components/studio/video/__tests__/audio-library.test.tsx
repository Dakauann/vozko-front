import { act, createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }),
  listLibraryAction: vi.fn().mockResolvedValue({ data: [] }),
  uploadMediaAction: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/contexts/auth-context", () => ({ useSignedInUserId: () => "u-1" }));

const preview = vi.hoisted(() => ({ play: vi.fn(), stop: vi.fn() }));

vi.mock("@/components/studio/library/sound-preview", async (original) => ({
  ...(await original<typeof import("@/components/studio/library/sound-preview")>()),
  playPreview: (assetId: string) => preview.play(assetId),
  stopPreview: () => preview.stop(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument } from "@/lib/studio/document";

import { LIBRARY_DRAG_TYPE } from "../../library/drag";
import { ElementsPanel } from "../panels/elements-panel";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

const MEDIA_ID = "6f1d3b8e-2c4a-4f1e-9a7b-0c1d2e3f4a5b";
const library = ptMessages.studio.library;

function openAudios() {
  fireEvent.click(screen.getByRole("button", { name: library.seeAllIn.replace("{name}", library.categories.audio) }));
}

function clips(editor: ReturnType<typeof renderInEditor>["editor"]) {
  return editor.store.getState().document.tracks.flatMap((track) => track.clips.map((clip) => ({ clip, track })));
}

describe("the Áudios category of the video library", () => {
  it("inserts a built-in sound at the playhead on an audio track", { timeout: 15_000 }, async () => {
    const { editor, container } = renderInEditor(emptyVideoDocument("story"), <ElementsPanel />);
    act(() => editor.view.setState({ playheadMs: 1200 }));
    await waitFor(() => screen.getByRole("heading", { name: library.categories.audio }));
    openAudios();
    const ding = await waitFor(() => {
      const tile = container.querySelector<HTMLElement>('[data-library-item="sound-ding"]');
      if (!tile) throw new Error("the sounds are still loading");
      return tile;
    });
    fireEvent.click(ding);
    const [placed] = clips(editor);
    expect(placed.track.kind).toBe("audio");
    expect(placed.clip).toMatchObject({ type: "audio", assetId: "sound:ding", startMs: 1200, durationMs: 1400 });
  });

  it("plays a sound while the pointer or the keyboard focus rests on it", { timeout: 15_000 }, async () => {
    const { container } = renderInEditor(emptyVideoDocument("story"), <ElementsPanel />);
    await waitFor(() => screen.getByRole("heading", { name: library.categories.audio }));
    openAudios();
    const pop = await waitFor(() => {
      const tile = container.querySelector<HTMLElement>('[data-library-item="sound-pop"]');
      if (!tile) throw new Error("the sounds are still loading");
      return tile;
    });
    fireEvent.mouseEnter(pop);
    expect(preview.play).toHaveBeenLastCalledWith("sound:pop");
    fireEvent.mouseLeave(pop);
    expect(preview.stop).toHaveBeenCalled();
    preview.play.mockClear();
    fireEvent.focus(pop);
    expect(preview.play).toHaveBeenLastCalledWith("sound:pop");
  });

  it("lists the workspace's own audio and inserts it at its measured length", { timeout: 15_000 }, async () => {
    const { editor, container } = renderInEditor(emptyVideoDocument("story"), <ElementsPanel />);
    const media = { id: MEDIA_ID, description: "Trilha da campanha", url: "https://cdn/trilha.mp3", previewUrl: "", createdAt: "", type: "audio" };
    act(() => editor.assets.store.setState({ library: { status: "ready", medias: [media] }, assets: { [MEDIA_ID]: { status: "ready", media, durationMs: 4321 } } }));
    const mine = await waitFor(() => {
      const tile = container.querySelector<HTMLElement>(`[data-library-item="media-${MEDIA_ID}"]`);
      if (!tile) throw new Error("the workspace audio is not listed yet");
      return tile;
    });
    expect(mine.getAttribute("aria-label")).toBe("Trilha da campanha");
    fireEvent.click(mine);
    await waitFor(() => expect(clips(editor)).toHaveLength(1));
    expect(clips(editor)[0].clip).toMatchObject({ type: "audio", assetId: MEDIA_ID, durationMs: 4321 });
  });

  it("opens the existing AI generation for music, voice and sound effects", { timeout: 15_000 }, async () => {
    const { editor, container } = renderInEditor(emptyVideoDocument("story"), <ElementsPanel />);
    const sfx = await waitFor(() => {
      const button = container.querySelector<HTMLElement>('[data-library-generate="sfx"]');
      if (!button) throw new Error("the audio actions are not shown yet");
      return button;
    });
    fireEvent.click(sfx);
    expect(editor.view.getState()).toMatchObject({ panel: "ai", aiKind: "sfx" });
  });

  it("drops a built-in sound on an audio lane at the drop time", { timeout: 15_000 }, async () => {
    const doc = emptyVideoDocument("story");
    const audioTrack = doc.tracks.find((track) => track.kind === "audio")!;
    const { editor, container } = renderInEditor(doc, <Timeline />);
    const lane = container.querySelector<HTMLElement>(`[data-track-id="${audioTrack.id}"]`)!;
    const dataTransfer = { types: [LIBRARY_DRAG_TYPE], getData: (type: string) => (type === LIBRARY_DRAG_TYPE ? "sound-whoosh" : ""), dropEffect: "" };
    fireEvent.dragOver(lane, { dataTransfer });
    const drop = createEvent.drop(lane, { dataTransfer });
    Object.defineProperty(drop, "clientX", { value: 0 });
    fireEvent(lane, drop);
    await waitFor(() => expect(clips(editor)).toHaveLength(1));
    expect(clips(editor)[0].track.id).toBe(audioTrack.id);
    expect(clips(editor)[0].clip).toMatchObject({ assetId: "sound:whoosh", startMs: 0 });
  });
});
