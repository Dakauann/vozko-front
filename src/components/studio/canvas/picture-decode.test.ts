import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetUnavailableError, decodeImageElement, decodePicture, PICTURE_DECODE_OPTIONS, pictureDecoders, type PictureDecoders } from "./picture-decode";

const file = { blob: new Blob(["jpeg"], { type: "image/jpeg" }), url: "blob:photo" };

function fakeBitmap(): ImageBitmap {
  return { width: 4000, height: 3000, close: vi.fn() } as unknown as ImageBitmap;
}

function fakeElement(): HTMLImageElement {
  return { naturalWidth: 4000, naturalHeight: 3000 } as HTMLImageElement;
}

describe("decodePicture", () => {
  it("decodes off the main thread with createImageBitmap, keeping orientation, color space and premultiplied alpha as an img would", async () => {
    const bitmap = fakeBitmap();
    const decoders: PictureDecoders = { bitmap: vi.fn(async () => bitmap), element: vi.fn(async () => fakeElement()) };
    await expect(decodePicture(file, "a1", decoders)).resolves.toBe(bitmap);
    expect(decoders.bitmap).toHaveBeenCalledWith(file.blob, { imageOrientation: "from-image", premultiplyAlpha: "premultiply", colorSpaceConversion: "default" });
    expect(PICTURE_DECODE_OPTIONS).toEqual({ imageOrientation: "from-image", premultiplyAlpha: "premultiply", colorSpaceConversion: "default" });
    expect(decoders.element).not.toHaveBeenCalled();
  });

  it("falls back to an image element when createImageBitmap is not available", async () => {
    const element = fakeElement();
    const decoders: PictureDecoders = { bitmap: null, element: vi.fn(async () => element) };
    await expect(decodePicture(file, "a1", decoders)).resolves.toBe(element);
    expect(decoders.element).toHaveBeenCalledWith(file.url);
  });

  it("falls back to an image element when createImageBitmap refuses the file, as it does for SVG", async () => {
    const element = fakeElement();
    const decoders: PictureDecoders = { bitmap: vi.fn(async () => Promise.reject(new DOMException("unsupported", "InvalidStateError"))), element: vi.fn(async () => element) };
    await expect(decodePicture({ blob: new Blob(["<svg/>"], { type: "image/svg+xml" }), url: "blob:icon" }, "a2", decoders)).resolves.toBe(element);
    expect(decoders.element).toHaveBeenCalledWith("blob:icon");
  });

  it("fails closed with the asset and the reason when nothing can decode it", async () => {
    const decoders: PictureDecoders = { bitmap: vi.fn(async () => Promise.reject(new DOMException("broken", "InvalidStateError"))), element: vi.fn(async () => Promise.reject(new Error("image element could not decode"))) };
    const failure = await decodePicture(file, "a3", decoders).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AssetUnavailableError);
    expect((failure as AssetUnavailableError).source).toBe("a3");
    expect((failure as AssetUnavailableError).reason).toBe("image element could not decode");
  });
});

describe("decodeImageElement", () => {
  const made: FakeImage[] = [];

  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = "";
    decode?: () => Promise<void>;
    constructor() {
      made.push(this);
    }
  }

  function stubImage(decode: (() => Promise<void>) | undefined): void {
    made.length = 0;
    vi.stubGlobal(
      "Image",
      class extends FakeImage {
        decode = decode;
      },
    );
  }

  afterEach(() => vi.unstubAllGlobals());

  it("waits for the element to decode ahead of time so the first draw does not decode on the main thread", async () => {
    const decode = vi.fn(async () => undefined);
    stubImage(decode);
    const image = await decodeImageElement("blob:photo");
    expect(image).toBe(made[0]);
    expect(made[0].src).toBe("blob:photo");
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it("falls back to the load event when the browser cannot decode an element ahead of time", async () => {
    stubImage(undefined);
    const decoding = decodeImageElement("blob:photo");
    made[0].onload?.();
    await expect(decoding).resolves.toBe(made[0]);
  });

  it("keeps the element when decode refuses but the image still loads", async () => {
    stubImage(() => Promise.reject(new DOMException("not now", "EncodingError")));
    const decoding = decodeImageElement("blob:icon");
    await Promise.resolve();
    made[0].onload?.();
    await expect(decoding).resolves.toBe(made[0]);
  });

  it("fails closed with a reason when the image is broken", async () => {
    stubImage(() => Promise.reject(new DOMException("broken", "EncodingError")));
    const decoding = decodeImageElement("blob:broken");
    made[0].onerror?.();
    await expect(decoding).rejects.toThrow("image element could not decode");
  });
});

describe("pictureDecoders", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses createImageBitmap when the browser has it", async () => {
    const bitmap = fakeBitmap();
    const create = vi.fn(async () => bitmap);
    vi.stubGlobal("createImageBitmap", create);
    const decoders = pictureDecoders();
    expect(decoders.bitmap).not.toBeNull();
    await expect(decoders.bitmap!(file.blob, PICTURE_DECODE_OPTIONS)).resolves.toBe(bitmap);
    expect(create).toHaveBeenCalledWith(file.blob, PICTURE_DECODE_OPTIONS);
  });

  it("has no bitmap decoder when the browser lacks createImageBitmap", () => {
    vi.stubGlobal("createImageBitmap", undefined);
    expect(pictureDecoders().bitmap).toBeNull();
  });
});

describe("shared asset pictures", () => {
  const loadMediaFile = vi.fn();
  const createImageBitmap = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    loadMediaFile.mockReset();
    createImageBitmap.mockReset();
    vi.doMock("./media-files", () => ({ loadMediaFile: (id: string) => loadMediaFile(id) }));
    vi.stubGlobal("createImageBitmap", createImageBitmap);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("decodes once for every holder and closes the bitmap only when the last holder lets go", async () => {
    const bitmap = fakeBitmap();
    loadMediaFile.mockResolvedValue({ ...file, contentType: "image/jpeg" });
    createImageBitmap.mockResolvedValue(bitmap);
    const { acquireAssetPicture, releaseAssetPicture } = await import("./asset-images");
    const [first, second] = await Promise.all([acquireAssetPicture("a1"), acquireAssetPicture("a1")]);
    expect(first).toBe(bitmap);
    expect(second).toBe(bitmap);
    expect(createImageBitmap).toHaveBeenCalledTimes(1);
    releaseAssetPicture("a1");
    await Promise.resolve();
    expect(bitmap.close).not.toHaveBeenCalled();
    releaseAssetPicture("a1");
    await vi.waitFor(() => expect(bitmap.close).toHaveBeenCalledTimes(1));
    const again = fakeBitmap();
    createImageBitmap.mockResolvedValue(again);
    await expect(acquireAssetPicture("a1")).resolves.toBe(again);
    expect(createImageBitmap).toHaveBeenCalledTimes(2);
  });

  it("does not keep a picture that failed, and refuses files that are not images", async () => {
    loadMediaFile.mockResolvedValue({ blob: new Blob(["v"]), url: "blob:video", contentType: "video/mp4" });
    const { acquireAssetPicture, AssetUnavailableError: Unavailable } = await import("./asset-images");
    await expect(acquireAssetPicture("v1")).rejects.toBeInstanceOf(Unavailable);
    expect(createImageBitmap).not.toHaveBeenCalled();
    const bitmap = fakeBitmap();
    loadMediaFile.mockResolvedValue({ ...file, contentType: "image/jpeg" });
    createImageBitmap.mockResolvedValue(bitmap);
    await expect(acquireAssetPicture("v1")).resolves.toBe(bitmap);
  });
});
