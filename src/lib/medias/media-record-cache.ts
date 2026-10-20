import type { Media } from "./types";

export interface MediaRecordCache {
  peek: (id: string) => Media | null | undefined;
  read: (id: string) => Promise<Media | null>;
  subscribe: (listener: () => void) => () => void;
}

export function createMediaRecordCache(fetchMedia: (id: string) => Promise<Media | null>): MediaRecordCache {
  const known = new Map<string, Media | null>();
  const running = new Map<string, Promise<Media | null>>();
  const listeners = new Set<() => void>();

  const read = (id: string): Promise<Media | null> => {
    if (known.has(id)) return Promise.resolve(known.get(id) ?? null);
    const pending = running.get(id);
    if (pending) return pending;
    const request = fetchMedia(id).then(
      (media) => {
        running.delete(id);
        known.set(id, media);
        for (const listener of listeners) listener();
        return media;
      },
      (error: unknown) => {
        running.delete(id);
        throw error;
      },
    );
    running.set(id, request);
    return request;
  };

  return {
    peek: (id) => known.get(id),
    read,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
