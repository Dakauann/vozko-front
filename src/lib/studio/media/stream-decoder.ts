import { FRAME_EPSILON_SEC } from "./frame-stream";

export const MAX_IN_FLIGHT = 4;
export const MAX_DECODE_FAILURES = 3;

export interface Sample<P> {
  timestamp: number;
  duration: number;
  picture(): P;
  close(): void;
}

export interface SampleReader<P> {
  samples(fromSeconds: number): AsyncGenerator<Sample<P>>;
  dispose(): void;
}

export type StreamEvent<P> =
  | { kind: "frame"; generation: number; timestamp: number; duration: number; picture: P }
  | { kind: "end"; generation: number }
  | { kind: "reset" }
  | { kind: "failed" };

export class StreamDecoder<P> {
  private generation = 0;
  private target = 0;
  private inFlight = 0;
  private failures = 0;
  private failed = false;
  private closed = false;
  private waiting: (() => void)[] = [];

  constructor(
    private readonly reader: Promise<SampleReader<P> | null>,
    private readonly emit: (event: StreamEvent<P>) => void,
  ) {}

  seek(generation: number, seconds: number): void {
    if (this.closed) return;
    this.generation = generation;
    this.target = seconds;
    this.inFlight = 0;
    this.wake();
    void this.run(generation, seconds);
  }

  want(seconds: number): void {
    this.target = seconds;
  }

  release(generation: number, count: number): void {
    if (generation !== this.generation) return;
    this.inFlight = Math.max(0, this.inFlight - count);
    this.wake();
  }

  close(): void {
    this.closed = true;
    this.wake();
    void this.reader.then((reader) => reader?.dispose());
  }

  private current(generation: number): boolean {
    return !this.closed && generation === this.generation;
  }

  private async run(generation: number, from: number): Promise<void> {
    const reader = await this.reader;
    if (!reader) return this.fail();
    if (!this.current(generation)) return;
    const samples = reader.samples(from);
    try {
      while (await this.room(generation)) {
        const next = await samples.next();
        if (next.done) {
          if (this.current(generation)) this.emit({ kind: "end", generation });
          return;
        }
        this.deliver(generation, next.value);
      }
    } catch {
      if (this.current(generation)) this.recover();
    } finally {
      await samples.return(undefined).catch(() => undefined);
    }
  }

  private deliver(generation: number, sample: Sample<P>): void {
    try {
      if (!this.current(generation) || sample.timestamp + sample.duration <= this.target + FRAME_EPSILON_SEC) return;
      this.inFlight += 1;
      this.failures = 0;
      this.emit({ kind: "frame", generation, timestamp: sample.timestamp, duration: sample.duration, picture: sample.picture() });
    } finally {
      sample.close();
    }
  }

  private recover(): void {
    this.failures += 1;
    if (this.failures >= MAX_DECODE_FAILURES) this.fail();
    else this.emit({ kind: "reset" });
  }

  private fail(): void {
    if (this.failed || this.closed) return;
    this.failed = true;
    this.emit({ kind: "failed" });
  }

  private async room(generation: number): Promise<boolean> {
    while (this.current(generation) && this.inFlight >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => this.waiting.push(resolve));
    return this.current(generation);
  }

  private wake(): void {
    for (const resolve of this.waiting.splice(0)) resolve();
  }
}
