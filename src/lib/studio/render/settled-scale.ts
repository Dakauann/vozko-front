export const ZOOM_SETTLE_MS = 160;

export interface SettledReading {
  scale: number;
  wakeInMs: number | null;
}

export class SettledScale {
  private settled: number | null = null;
  private wanted = 0;
  private wantedSince = 0;

  constructor(private readonly settleMs: number = ZOOM_SETTLE_MS) {}

  at(scale: number, now: number): SettledReading {
    if (this.settled === null) {
      this.settled = scale;
      this.wanted = scale;
      return { scale, wakeInMs: null };
    }
    if (scale !== this.wanted) {
      this.wanted = scale;
      this.wantedSince = now;
    }
    if (this.wanted === this.settled) return { scale: this.settled, wakeInMs: null };
    const waited = now - this.wantedSince;
    if (waited < this.settleMs) return { scale: this.settled, wakeInMs: this.settleMs - waited };
    this.settled = this.wanted;
    return { scale: this.settled, wakeInMs: null };
  }
}
