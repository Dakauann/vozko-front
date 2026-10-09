import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({ fetchMediaFileAction: vi.fn() }));

import { fetchMediaFileAction } from "@/app/actions/medias";

import { ElementStills } from "./stills";

const fetchFile = vi.mocked(fetchMediaFileAction);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockVideo() {
  const video = document.createElement("video");
  Object.defineProperties(video, {
    videoWidth: { value: 1920 },
    videoHeight: { value: 1080 },
    duration: { value: 10 },
  });
  const canvas = document.createElement("canvas");
  const encode = vi.spyOn(canvas, "toBlob").mockImplementation((callback) => {
    queueMicrotask(() => callback(new Blob(["frame"], { type: "image/jpeg" })));
  });
  const drawImage = vi.fn();
  vi.spyOn(canvas, "getContext").mockImplementation((() => ({ drawImage })) as unknown as HTMLCanvasElement["getContext"]);
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag === "video") {
      queueMicrotask(() => video.dispatchEvent(new Event("loadeddata")));
      return video;
    }
    return tag === "canvas" ? canvas : create(tag);
  }) as typeof document.createElement);
  vi.stubGlobal("URL", { createObjectURL: () => "blob:video", revokeObjectURL: vi.fn() });
  vi.spyOn(video, "load").mockImplementation(() => undefined);
  fetchFile.mockResolvedValue({ data: { blob: new Blob(), contentType: "video/mp4" } } as Awaited<ReturnType<typeof fetchMediaFileAction>>);
  return { encode, canvas, drawImage };
}

describe("element stills", () => {
  it("draws the frame at the asked height keeping the video aspect", async () => {
    const { encode, canvas, drawImage } = mockVideo();
    const stills = new ElementStills();
    const image = await stills.grab("element-file", 0, 90);
    expect(image).toBeInstanceOf(Blob);
    expect(encode).toHaveBeenCalledTimes(1);
    expect([canvas.width, canvas.height]).toEqual([160, 90]);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 160, 90);
    stills.dispose();
    expect(await stills.grab("element-file", 0, 90)).toBeNull();
  });
});
