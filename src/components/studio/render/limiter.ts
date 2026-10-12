export class AbortedTaskError extends Error {
  constructor() {
    super("render task aborted before it started");
  }
}

export type Limiter = <T>(task: () => Promise<T>, signal: AbortSignal) => Promise<T>;

export function limiter(limit: number): Limiter {
  let active = 0;
  const waiting: (() => void)[] = [];
  const next = () => {
    active -= 1;
    waiting.shift()?.();
  };
  return <T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active += 1;
        if (signal.aborted) {
          reject(new AbortedTaskError());
          next();
          return;
        }
        task().then(resolve, reject).finally(next);
      };
      if (active < limit) run();
      else waiting.push(run);
    });
}
