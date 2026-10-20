import { describe, expect, it, vi } from "vitest";

import { createMediaRecordCache } from "./media-record-cache";
import type { Media } from "./types";

function media(id: string): Media {
  return { id, description: id, url: `https://cdn.test/${id}.jpg`, previewUrl: "", createdAt: "2026-10-01T00:00:00Z", type: "image" };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("createMediaRecordCache", () => {
  it("shares one request between nodes that ask for the same media at the same time", async () => {
    const pending = deferred<Media | null>();
    const fetchMedia = vi.fn(() => pending.promise);
    const cache = createMediaRecordCache(fetchMedia);
    const reads = [cache.read("a"), cache.read("a"), cache.read("a")];
    pending.resolve(media("a"));
    expect(await Promise.all(reads)).toEqual([media("a"), media("a"), media("a")]);
    expect(fetchMedia).toHaveBeenCalledTimes(1);
  });

  it("never asks again for a media it already knows, so a node remounted by culling renders at once", async () => {
    const fetchMedia = vi.fn((id: string) => Promise.resolve(media(id)));
    const cache = createMediaRecordCache(fetchMedia);
    expect(cache.peek("a")).toBeUndefined();
    await cache.read("a");
    await cache.read("a");
    expect(cache.peek("a")).toEqual(media("a"));
    expect(fetchMedia).toHaveBeenCalledTimes(1);
  });

  it("fetches each media id once", async () => {
    const fetchMedia = vi.fn((id: string) => Promise.resolve(media(id)));
    const cache = createMediaRecordCache(fetchMedia);
    await Promise.all(["a", "b", "a", "c", "b"].map((id) => cache.read(id)));
    expect(fetchMedia.mock.calls.map(([id]) => id)).toEqual(["a", "b", "c"]);
  });

  it("remembers a media that does not exist, so a removed file is not asked for on every pan", async () => {
    const fetchMedia = vi.fn(() => Promise.resolve(null));
    const cache = createMediaRecordCache(fetchMedia);
    expect(await cache.read("gone")).toBeNull();
    expect(await cache.read("gone")).toBeNull();
    expect(cache.peek("gone")).toBeNull();
    expect(fetchMedia).toHaveBeenCalledTimes(1);
  });

  it("forgets a request that failed, so the next node to mount tries again", async () => {
    const fetchMedia = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(media("a"));
    const cache = createMediaRecordCache(fetchMedia);
    await expect(cache.read("a")).rejects.toThrow("offline");
    expect(cache.peek("a")).toBeUndefined();
    expect(await cache.read("a")).toEqual(media("a"));
    expect(fetchMedia).toHaveBeenCalledTimes(2);
  });

  it("tells subscribers when a record arrives and stops after they leave", async () => {
    const cache = createMediaRecordCache((id) => Promise.resolve(media(id)));
    const listener = vi.fn();
    const leave = cache.subscribe(listener);
    await cache.read("a");
    expect(listener).toHaveBeenCalledTimes(1);
    leave();
    await cache.read("b");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
