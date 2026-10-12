export type ChunkModule = () => Promise<{ default: string }>;

export interface Chunked<T> {
  get: (chunk: number) => T | undefined;
  load: (chunk: number) => Promise<T>;
}

export function chunkedData<T>(modules: readonly ChunkModule[]): Chunked<T> {
  const loaded = new Map<number, T>();
  const pending = new Map<number, Promise<T>>();
  return {
    get: (chunk) => loaded.get(chunk),
    load: (chunk) => {
      const known = loaded.get(chunk);
      if (known !== undefined) return Promise.resolve(known);
      const waiting = pending.get(chunk);
      if (waiting) return waiting;
      const source = modules[chunk];
      if (!source) return Promise.reject(new Error(`no library data chunk ${chunk}`));
      const next = source().then(
        (loadedModule) => {
          const value = JSON.parse(loadedModule.default) as T;
          loaded.set(chunk, value);
          pending.delete(chunk);
          return value;
        },
        (error: unknown) => {
          pending.delete(chunk);
          throw error;
        },
      );
      pending.set(chunk, next);
      return next;
    },
  };
}

export async function parsedModule<T>(module: ChunkModule): Promise<T> {
  return JSON.parse((await module()).default) as T;
}
