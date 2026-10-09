"use client";

import type { LoadedMediaFile } from "../canvas/media-files";
import type { MediaPort, StillEvent, StillRequest } from "./media-protocol";
import type { StillSource } from "./stills";

export class DecodedStills implements StillSource {
  private port: MediaPort | null = null;
  private opened = false;
  private broken = false;
  private disposed = false;
  private asked = 0;
  private readonly pending = new Map<string, (event: StillEvent | null) => void>();
  private readonly undecodable = new Set<string>();

  constructor(
    private readonly open: () => MediaPort | null,
    private readonly fallback: StillSource,
    private readonly files: (file: string) => Promise<LoadedMediaFile | null>,
  ) {}

  async grab(file: string, seconds: number, heightPx: number): Promise<Blob | null> {
    if (this.disposed) return null;
    const port = this.worker();
    if (!port || this.undecodable.has(file)) return this.fallback.grab(file, seconds, heightPx);
    const loaded = await this.files(file);
    if (this.disposed || !loaded || !loaded.contentType.startsWith("video/")) return null;
    const answer = await this.ask(port, { file, blob: loaded.blob, seconds, heightPx });
    if (this.disposed) return null;
    if (answer?.decodable) return answer.image;
    if (answer) this.undecodable.add(file);
    return this.fallback.grab(file, seconds, heightPx);
  }

  dispose(): void {
    this.disposed = true;
    this.settle();
    this.port?.close();
    this.fallback.dispose();
  }

  private worker(): MediaPort | null {
    if (!this.opened) {
      this.opened = true;
      this.port = this.open();
      this.port?.listen(
        (event) => {
          if (event.kind === "still") this.answer(event.id, event);
        },
        () => {
          this.broken = true;
          this.settle();
        },
      );
    }
    return this.broken ? null : this.port;
  }

  private ask(port: MediaPort, request: Omit<StillRequest, "kind" | "id">): Promise<StillEvent | null> {
    this.asked += 1;
    const id = String(this.asked);
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      port.send({ kind: "still", id, ...request });
    });
  }

  private answer(id: string, event: StillEvent | null): void {
    const resolve = this.pending.get(id);
    this.pending.delete(id);
    resolve?.(event);
  }

  private settle(): void {
    for (const id of [...this.pending.keys()]) this.answer(id, null);
  }
}
