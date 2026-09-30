import type { QueueLive, QueueStats } from "@/lib/call-routing/types";

export const LIVE_REFRESH_MS = 3_000;
export const STATS_REFRESH_MS = 60_000;
export const LONG_WAIT_SECONDS = 60;

export function localDayWindow(day: Date): { from: string; to: string } {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, -1);
    return { from: start.toISOString(), to: end.toISOString() };
}

export function formatWait(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = String(seconds % 60).padStart(2, "0");
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

export function withElapsed(queue: QueueLive, elapsedSeconds: number): QueueLive {
    if (elapsedSeconds <= 0 || queue.waiting.length === 0) return queue;
    return {
        ...queue,
        longestWaitSeconds: queue.longestWaitSeconds + elapsedSeconds,
        waiting: queue.waiting.map((caller) => ({ ...caller, waitingSeconds: caller.waitingSeconds + elapsedSeconds })),
    };
}

export type QueueAttention = "calm" | "busy" | "critical";

export function queueAttention(queue: QueueLive): QueueAttention {
    if (queue.waiting.length === 0) return "calm";
    const nobodyCanAnswer = queue.counts.free + queue.counts.ringing + queue.counts.onCall + queue.counts.wrapUp === 0;
    if (nobodyCanAnswer || queue.longestWaitSeconds >= LONG_WAIT_SECONDS) return "critical";
    return "busy";
}

export function totals(stats: QueueStats[]) {
    const sum = stats.reduce(
        (acc, s) => ({
            offered: acc.offered + s.offered,
            answered: acc.answered + s.answered,
            abandoned: acc.abandoned + s.abandoned,
            withinTarget: acc.withinTarget + s.serviceLevel * s.offered,
        }),
        { offered: 0, answered: 0, abandoned: 0, withinTarget: 0 },
    );
    return {
        offered: sum.offered,
        answered: sum.answered,
        abandoned: sum.abandoned,
        serviceLevel: sum.offered === 0 ? 0 : sum.withinTarget / sum.offered,
    };
}

export function percent(fraction: number): string {
    return `${Math.round(fraction * 100)}%`;
}
