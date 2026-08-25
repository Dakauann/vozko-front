/**
 * Shared WebSocket reconnection policy for the call-session + conversation hooks.
 *
 * Goals (production reliability):
 *  - Reconnect FOREVER with exponential backoff capped at maxDelay, never give
 *    up permanently (the old hooks stopped after N attempts, so a long
 *    background or flaky network left the socket dead).
 *  - Reconnect IMMEDIATELY when the tab becomes visible again or the network
 *    comes back online, the case where a backgrounded tab's socket was closed
 *    and the throttled backoff timer never fired.
 *  - `shouldReconnect` gates every attempt (enabled + authenticated + not an
 *    intentional disconnect), so we never loop when logged out or unmounted.
 *
 * The controller owns only timers + listeners; the hook owns the actual
 * `connect()` (which refreshes the token and opens the socket) and is expected
 * to be idempotent (no-op if already OPEN/CONNECTING).
 */

export function backoffDelay(attempt: number, baseMs: number, maxMs: number): number {
    const a = attempt < 0 ? 0 : attempt;
    return Math.min(baseMs * 2 ** a, maxMs);
}

type Timer = ReturnType<typeof setTimeout>;

export interface ReconnectController {
    /** Schedule a backoff reconnect. Call from the socket's onclose. */
    scheduleReconnect(): void;
    /** Reset backoff to zero. Call once a connection has stayed up a while. */
    resetBackoff(): void;
    /** Cancel pending backoff and connect immediately (visibility/online). */
    reconnectNow(): void;
    /** Attach visibility/online listeners. Does not connect by itself. */
    start(): void;
    /** Remove listeners + cancel timers. Call on unmount/intentional disconnect. */
    stop(): void;
    /** Pending backoff delay in ms, or null when no reconnect is scheduled. */
    pendingDelay(): number | null;
}

type WinLike = Pick<Window, "addEventListener" | "removeEventListener">;
type DocLike = Pick<Document, "addEventListener" | "removeEventListener"> & {
    readonly visibilityState: DocumentVisibilityState;
};

export interface ReconnectConfig {
    /** Open a connection. Must be idempotent (no-op if already connected). */
    connect: () => void;
    /** Whether a (re)connect should be attempted right now. */
    shouldReconnect: () => boolean;
    baseDelayMs?: number;
    maxDelayMs?: number;
    /** Injectable for tests; defaults to global window/document when present. */
    win?: WinLike | null;
    doc?: DocLike | null;
}

export function createReconnectController(cfg: ReconnectConfig): ReconnectController {
    const base = cfg.baseDelayMs ?? 1000;
    const max = cfg.maxDelayMs ?? 30000;
    const win: WinLike | null =
        cfg.win ?? (typeof window !== "undefined" ? window : null);
    const doc: DocLike | null =
        cfg.doc ?? (typeof document !== "undefined" ? (document as DocLike) : null);

    let attempt = 0;
    let timer: Timer | null = null;
    let pending: number | null = null;
    let started = false;

    const clearTimer = () => {
        if (timer != null) {
            clearTimeout(timer);
            timer = null;
        }
        pending = null;
    };

    const scheduleReconnect = () => {
        clearTimer();
        if (!cfg.shouldReconnect()) return;
        const delay = backoffDelay(attempt, base, max);
        attempt += 1;
        pending = delay;
        timer = setTimeout(() => {
            timer = null;
            pending = null;
            if (cfg.shouldReconnect()) cfg.connect();
        }, delay);
    };

    const resetBackoff = () => {
        attempt = 0;
    };

    const reconnectNow = () => {
        clearTimer();
        attempt = 0;
        if (cfg.shouldReconnect()) cfg.connect();
    };

    const onVisibility = () => {
        if (doc && doc.visibilityState === "visible") reconnectNow();
    };
    const onOnline = () => reconnectNow();

    const start = () => {
        if (started) return;
        started = true;
        doc?.addEventListener("visibilitychange", onVisibility);
        win?.addEventListener("online", onOnline);
    };

    const stop = () => {
        clearTimer();
        attempt = 0;
        if (!started) return;
        started = false;
        doc?.removeEventListener("visibilitychange", onVisibility);
        win?.removeEventListener("online", onOnline);
    };

    return {
        scheduleReconnect,
        resetBackoff,
        reconnectNow,
        start,
        stop,
        pendingDelay: () => pending,
    };
}
