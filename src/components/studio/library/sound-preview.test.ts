import { beforeEach, describe, expect, it, vi } from "vitest";

const loadMediaFile = vi.fn();

vi.mock("@/components/studio/canvas/media-files", () => ({ loadMediaFile: (id: string) => loadMediaFile(id) }));

class FakeAudio {
  static made: FakeAudio[] = [];
  paused = true;
  volume = 1;
  onended: (() => void) | null = null;
  constructor(public src: string) {
    FakeAudio.made.push(this);
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("library sound preview", () => {
  beforeEach(() => {
    vi.resetModules();
    loadMediaFile.mockReset();
    FakeAudio.made = [];
    vi.stubGlobal("Audio", FakeAudio);
    loadMediaFile.mockImplementation(async (id: string) => ({ url: `blob:${id}`, blob: new Blob(), contentType: "audio/mpeg" }));
  });

  it("plays one sound at a time and stops the previous one", async () => {
    const preview = await import("./sound-preview");
    preview.playPreview("sound:pop");
    await settle();
    preview.playPreview("sound:ding");
    await settle();
    expect(FakeAudio.made.map((audio) => audio.src)).toEqual(["blob:sound:pop", "blob:sound:ding"]);
    expect(FakeAudio.made[0].paused).toBe(true);
    expect(FakeAudio.made[1].paused).toBe(false);
    expect(preview.playingSound()).toBe("sound:ding");
  });

  it("never starts a sound that was stopped while it loaded", async () => {
    const preview = await import("./sound-preview");
    preview.playPreview("sound:pop");
    preview.stopPreview();
    await settle();
    expect(FakeAudio.made).toHaveLength(0);
    expect(preview.playingSound()).toBeNull();
  });

  it("clears the playing sound when it ends or cannot load", async () => {
    const preview = await import("./sound-preview");
    preview.playPreview("sound:pop");
    await settle();
    FakeAudio.made[0].onended?.();
    expect(preview.playingSound()).toBeNull();
    loadMediaFile.mockResolvedValueOnce(null);
    preview.playPreview("sound:nope");
    await settle();
    expect(preview.playingSound()).toBeNull();
  });
});
