import type { AttentionSignal, AttentionSource, DesktopNotice } from "./rules";

export const CLAIM_HOLD_MS = 10_000;

export const BACKGROUND_CLAIM_DELAY_MS = 250;

export const DESKTOP_NOTICE_MS = 8_000;

export interface DesktopCopy {
  fallbackTitle: (source: AttentionSource) => string;
  summaryTitle: (source: AttentionSource, count: number) => string;
  summaryBody: (source: AttentionSource) => string;
}

interface LockManagerLike {
  request: (name: string, options: { ifAvailable: boolean }, callback: (lock: unknown) => unknown) => Promise<unknown>;
}

function lockManager(): LockManagerLike | null {
  if (typeof navigator === "undefined") return null;
  const locks = (navigator as { locks?: LockManagerLike }).locks;
  return locks && typeof locks.request === "function" ? locks : null;
}

export function claimInBrowser(id: string, eager: boolean): Promise<boolean> {
  const locks = lockManager();
  if (!locks) return Promise.resolve(true);
  return new Promise((resolve) => {
    const attempt = () => {
      void locks
        .request(`vozko-attention:${id}`, { ifAvailable: true }, (lock) => {
          if (!lock) {
            resolve(false);
            return undefined;
          }
          resolve(true);
          return new Promise((release) => setTimeout(release, CLAIM_HOLD_MS));
        })
        .catch(() => resolve(true));
    };
    if (eager) attempt();
    else setTimeout(attempt, BACKGROUND_CLAIM_DELAY_MS);
  });
}

export function showInBrowser(notice: DesktopNotice, copy: DesktopCopy, icon: string, onOpen?: (signal: AttentionSignal) => void): void {
  const api = typeof window === "undefined" ? undefined : (window as { Notification?: typeof Notification }).Notification;
  if (!api) return;
  const source = notice.summary?.source ?? notice.signal?.source ?? "notification";
  const title = notice.summary ? copy.summaryTitle(source, notice.summary.count) : notice.title || copy.fallbackTitle(source);
  const body = notice.summary ? copy.summaryBody(source) : notice.body;
  try {
    const shown = new api(title, {
      body,
      tag: notice.tag,
      icon: icon || undefined,
      badge: icon || undefined,
      requireInteraction: notice.requireInteraction,
      silent: true,
    });
    shown.onclick = () => {
      window.focus();
      if (notice.signal) onOpen?.(notice.signal);
      shown.close();
    };
    if (!notice.requireInteraction) setTimeout(() => shown.close(), DESKTOP_NOTICE_MS);
  } catch {
    return;
  }
}
