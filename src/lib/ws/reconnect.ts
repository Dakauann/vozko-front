
export function backoffDelay(attempt: number, baseMs: number, maxMs: number): number {
    const a = attempt < 0 ? 0 : attempt;
    return Math.min(baseMs * 2 ** a, maxMs);
}

type Timer = ReturnType<typeof setTimeout>;

export interface ReconnectController {
    scheduleReconnect(): void;
    resetBackoff(): void;
    reconnectNow(): void;
    start(): void;
    stop(): void;
    pendingDelay(): number | null;
}

type WinLike = Pick<Window, "addEventListener" | "removeEventListener">;
type DocLike = Pick<Document, "addEventListener" | "removeEventListener"> & {
    readonly visibilityState: DocumentVisibilityState;
};

export interface ReconnectConfig {
    connect: () => void;
    shouldReconnect: () => boolean;
    baseDelayMs?: number;
    maxDelayMs?: number;
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
