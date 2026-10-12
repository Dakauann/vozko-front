export class Alarm {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly ring: () => void) {}

  set(ms: number | null): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = ms === null ? null : setTimeout(this.fire, ms);
  }

  private readonly fire = (): void => {
    this.timer = null;
    this.ring();
  };
}
