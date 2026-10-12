import { beforeEach, describe, expect, it, vi } from "vitest";

const getMediaAction = vi.fn();

vi.mock("@/app/actions/medias", () => ({ getMediaAction: (id: string) => getMediaAction(id), listLibraryAction: vi.fn() }));

describe("asset catalog with built-in sounds", () => {
  beforeEach(() => getMediaAction.mockReset());

  it("knows a built-in sound and its length without asking the library", async () => {
    const { createAssetCatalog } = await import("./asset-catalog");
    const catalog = createAssetCatalog();
    const entry = await catalog.ensure("sound:ding");
    expect(entry.status).toBe("ready");
    expect(entry.media?.type).toBe("audio");
    expect(entry.media?.url).toBe("/audio/studio/ding.mp3");
    expect(await catalog.sourceDuration("sound:ding")).toBe(1400);
    expect(getMediaAction).not.toHaveBeenCalled();
  });

  it("marks an unknown built-in sound missing instead of asking the library", async () => {
    const { createAssetCatalog } = await import("./asset-catalog");
    const entry = await createAssetCatalog().ensure("sound:nope");
    expect(entry.status).toBe("missing");
    expect(getMediaAction).not.toHaveBeenCalled();
  });
});
