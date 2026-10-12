import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMediaFileAction = vi.fn();

vi.mock("@/app/actions/medias", () => ({ fetchMediaFileAction: (id: string) => fetchMediaFileAction(id) }));

describe("shared studio media files", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMediaFileAction.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:shared");
  });

  it("downloads each media once, however many parts of the editor ask for it", async () => {
    fetchMediaFileAction.mockResolvedValue({ data: { blob: new Blob(["v"]), contentType: "video/mp4" }, error: null });
    const { loadMediaFile } = await import("./media-files");
    const [preview, thumbnails, audio] = await Promise.all([loadMediaFile("m1"), loadMediaFile("m1"), loadMediaFile("m1")]);
    expect(fetchMediaFileAction).toHaveBeenCalledTimes(1);
    expect(preview).toBe(thumbnails);
    expect(audio?.url).toBe("blob:shared");
    expect(audio?.contentType).toBe("video/mp4");
  });

  it("plays a built-in sound from the app's own files without asking the library", async () => {
    const appFetch = vi.fn(async () => new Response(new Blob(["s"], { type: "audio/mpeg" }), { headers: { "content-type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", appFetch);
    const { loadMediaFile } = await import("./media-files");
    const loaded = await loadMediaFile("sound:pop");
    expect(appFetch).toHaveBeenCalledWith("/audio/studio/pop.mp3");
    expect(fetchMediaFileAction).not.toHaveBeenCalled();
    expect(loaded?.contentType).toBe("audio/mpeg");
    expect(await loadMediaFile("sound:nope")).toBeNull();
    expect(fetchMediaFileAction).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does not remember a failed download, so the next request tries again", async () => {
    fetchMediaFileAction.mockResolvedValueOnce({ data: null, error: "boom" }).mockResolvedValueOnce({ data: { blob: new Blob(["v"]), contentType: "image/png" }, error: null });
    const { loadMediaFile } = await import("./media-files");
    expect(await loadMediaFile("m2")).toBeNull();
    expect(await loadMediaFile("m2")).not.toBeNull();
    expect(fetchMediaFileAction).toHaveBeenCalledTimes(2);
  });
});
