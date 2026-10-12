export const FRAME_EPSILON_SEC = 0.001;
export const DECODE_THROUGH_SEC = 1;
export const REVERSE_WINDOW_SEC = 0.5;

export interface Picture {
  close(): void;
}

export interface DecodedFrame<P extends Picture> {
  picture: P;
  generation: number;
  timestamp: number;
  duration: number;
}

export type StreamRequest =
  | { kind: "seek"; generation: number; seconds: number; until?: number }
  | { kind: "want"; seconds: number }
  | { kind: "release"; generation: number; count: number };

export interface StreamView<P extends Picture> {
  picture: P | null;
  requests: StreamRequest[];
}

export class FrameStream<P extends Picture> {
  private shown: DecodedFrame<P> | null = null;
  private queue: DecodedFrame<P>[] = [];
  private generation = 0;
  private from = 0;
  private sought = false;
  private awaiting = false;
  private exhausted = false;
  private wanted: number | null = null;
  private until: number | null = null;
  private disposed = false;

  receive(frame: DecodedFrame<P>): void {
    if (this.disposed || frame.generation !== this.generation) {
      frame.picture.close();
      return;
    }
    this.awaiting = false;
    const at = this.queue.findIndex((queued) => queued.timestamp > frame.timestamp);
    if (at < 0) this.queue.push(frame);
    else this.queue.splice(at, 0, frame);
  }

  end(generation: number): void {
    if (generation !== this.generation) return;
    this.awaiting = false;
    this.exhausted = true;
  }

  reset(): void {
    this.sought = false;
    this.awaiting = false;
    this.dropQueue();
  }

  show(seconds: number, backward: boolean = false): StreamView<P> {
    if (this.disposed) return { picture: null, requests: [] };
    if (backward) return this.showBackward(seconds);
    const requests: StreamRequest[] = [];
    const released = this.advance(seconds);
    if (released > 0) requests.push({ kind: "release", generation: this.generation, count: released });
    if (!this.awaiting && this.needsSeek(seconds)) requests.push(this.seek(seconds));
    else if (!this.awaiting && this.wanted !== seconds) {
      this.wanted = seconds;
      requests.push({ kind: "want", seconds });
    }
    return { picture: this.shown?.picture ?? null, requests };
  }

  exact(seconds: number): boolean {
    const shown = this.shown;
    if (this.disposed || this.awaiting || !shown || shown.generation !== this.generation || shown.timestamp > seconds + FRAME_EPSILON_SEC) return false;
    if (this.until !== null) return seconds < shown.timestamp + shown.duration - FRAME_EPSILON_SEC || this.exhausted;
    const next = this.queue[0];
    if (next) return next.timestamp > seconds + FRAME_EPSILON_SEC;
    return this.exhausted || seconds < shown.timestamp + shown.duration - FRAME_EPSILON_SEC;
  }

  mixReady(seconds: number): boolean {
    if (!this.exact(seconds)) return false;
    const next = this.queue[0];
    return this.exhausted || (next !== undefined && next.generation === this.generation);
  }

  blend(seconds: number): { picture: P; weight: number } | null {
    const shown = this.shown;
    const next = this.queue[0];
    if (this.disposed || this.until !== null || !shown || !next || shown.generation !== this.generation || next.generation !== this.generation) return null;
    const gap = next.timestamp - shown.timestamp;
    const weight = gap > 0 ? (seconds - shown.timestamp) / gap : 0;
    return weight > FRAME_EPSILON_SEC && weight < 1 ? { picture: next.picture, weight } : null;
  }

  dispose(): void {
    this.disposed = true;
    this.shown?.picture.close();
    this.shown = null;
    this.dropQueue();
  }

  private advance(seconds: number): number {
    let released = 0;
    while (this.queue.length > 0 && this.queue[0].timestamp <= seconds + FRAME_EPSILON_SEC) {
      if (this.shown) {
        if (this.shown.generation === this.generation) released += 1;
        this.shown.picture.close();
      }
      this.shown = this.queue.shift()!;
    }
    return released;
  }

  private showBackward(seconds: number): StreamView<P> {
    const current = (this.shown?.generation === this.generation ? [this.shown, ...this.queue] : [...this.queue]).sort((a, b) => a.timestamp - b.timestamp);
    const pick = current.filter((frame) => frame.timestamp <= seconds + FRAME_EPSILON_SEC).at(-1);
    if (pick) {
      for (const frame of current) if (frame.timestamp > pick.timestamp) frame.picture.close();
      if (this.shown && this.shown !== pick && this.shown.generation !== this.generation) this.shown.picture.close();
      this.shown = pick;
      this.queue = current.filter((frame) => frame.timestamp < pick.timestamp);
    }
    const oldest = (this.queue[0] ?? (pick ? this.shown : null))?.timestamp ?? Infinity;
    const outside = this.until === null || seconds > this.until + FRAME_EPSILON_SEC || (seconds < oldest - FRAME_EPSILON_SEC && (this.exhausted || !pick));
    const requests: StreamRequest[] = !this.awaiting && outside ? [this.seekBack(seconds)] : [];
    return { picture: this.shown?.picture ?? null, requests };
  }

  private seekBack(seconds: number): StreamRequest {
    const from = Math.max(0, seconds - REVERSE_WINDOW_SEC);
    this.startPass(from);
    this.until = seconds;
    return { kind: "seek", generation: this.generation, seconds: from, until: seconds };
  }

  private needsSeek(seconds: number): boolean {
    if (!this.sought || this.until !== null) return true;
    const frames = this.shown?.generation === this.generation ? [this.shown, ...this.queue] : this.queue;
    const first = frames[0];
    const last = frames[frames.length - 1];
    const lower = first ? first.timestamp : this.from;
    const upper = last ? last.timestamp + last.duration : this.from;
    if (seconds < lower - FRAME_EPSILON_SEC) return true;
    return !this.exhausted && seconds > upper + DECODE_THROUGH_SEC;
  }

  private startPass(from: number): void {
    this.generation += 1;
    this.dropQueue();
    this.from = from;
    this.sought = true;
    this.awaiting = true;
    this.exhausted = false;
    this.wanted = from;
  }

  private seek(seconds: number): StreamRequest {
    this.startPass(seconds);
    this.until = null;
    return { kind: "seek", generation: this.generation, seconds };
  }

  private dropQueue(): void {
    for (const frame of this.queue) frame.picture.close();
    this.queue = [];
  }
}
