import { describe, expect, it } from "vitest";

import { formatWait, localDayWindow, percent, queueAttention, totals, withElapsed } from "./monitoring";
import type { QueueLive } from "./types";

function queue(overrides: Partial<QueueLive> = {}): QueueLive {
    return {
        id: "q1",
        name: "Suporte",
        waiting: [],
        longestWaitSeconds: 0,
        agents: [],
        counts: { free: 1, ringing: 0, onCall: 0, wrapUp: 0, offline: 0 },
        ...overrides,
    };
}

describe("queue monitoring", () => {
    it("asks for the manager's whole local day", () => {
        const { from, to } = localDayWindow(new Date(2026, 8, 30, 15, 42));
        expect(new Date(from).getTime()).toBe(new Date(2026, 8, 30).getTime());
        expect(new Date(to).getTime()).toBe(new Date(2026, 9, 1).getTime() - 1);
    });

    it("writes waits like a clock", () => {
        expect(formatWait(0)).toBe("0:00");
        expect(formatWait(65)).toBe("1:05");
        expect(formatWait(3725)).toBe("1:02:05");
    });

    it("keeps waits counting between refreshes", () => {
        const live = queue({ waiting: [{ callId: "c1", remoteNumber: "1", waitingSeconds: 10 }], longestWaitSeconds: 10 });
        const later = withElapsed(live, 2);
        expect(later.longestWaitSeconds).toBe(12);
        expect(later.waiting[0].waitingSeconds).toBe(12);
        expect(withElapsed(live, 0)).toBe(live);
    });

    it("flags a queue that needs a manager", () => {
        const one = [{ callId: "c1", remoteNumber: "1", waitingSeconds: 5 }];
        expect(queueAttention(queue())).toBe("calm");
        expect(queueAttention(queue({ waiting: one, longestWaitSeconds: 5 }))).toBe("busy");
        expect(queueAttention(queue({ waiting: one, longestWaitSeconds: 75 }))).toBe("critical");
        expect(queueAttention(queue({ waiting: one, longestWaitSeconds: 5, counts: { free: 0, ringing: 0, onCall: 0, wrapUp: 0, offline: 3 } }))).toBe("critical");
    });

    it("adds up the day across queues", () => {
        const stat = { queueId: "q", offered: 5, answered: 4, abandoned: 1, timedOut: 0, averageAnswerSeconds: 9, serviceLevel: 0.8, serviceLevelTargetSeconds: 20 };
        expect(totals([stat, { ...stat, queueId: "q2", offered: 2, answered: 2, abandoned: 0 }])).toMatchObject({ offered: 7, answered: 6, abandoned: 1 });
        expect(totals([stat, { ...stat, queueId: "q2", offered: 5, serviceLevel: 0.4 }]).serviceLevel).toBeCloseTo(0.6);
        expect(totals([]).serviceLevel).toBe(0);
        expect(percent(0.826)).toBe("83%");
    });
});
