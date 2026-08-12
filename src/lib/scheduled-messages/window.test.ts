import { describe, expect, it } from "vitest";

import {
    MAX_SCHEDULE_HORIZON_MS,
    MIN_SCHEDULE_LEAD_MS,
    canSchedule,
    marginBeforeWindowCloses,
    scheduleBounds,
    validateScheduledAt,
} from "./window";

/**
 * This is the SAME case table as the Go test in
 * `vozko-back/domain/scheduled_message/entity_test.go`.
 *
 * That duplication is the point: the client disables what the server would
 * refuse, and the only way to keep the two honest is to make a divergence fail
 * a test on one side or the other.
 */

const now = new Date("2026-08-12T12:00:00.000Z");
const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
const HOUR = 60 * 60 * 1000;

describe("scheduleBounds", () => {
    it("gives no bound for a closed window", () => {
        const bounds = scheduleBounds({ open: false }, now);
        expect(bounds.latest).toBeNull();
        expect(bounds.reason).toBe("window_closed");
    });

    // THE case. Some channels report an expiry while CLOSED — it is a provider
    // restriction countdown, not a deadline to schedule up to.
    it("gives no bound for a closed window that still reports an expiry", () => {
        const bounds = scheduleBounds({ open: false, expiresAt: at(6 * HOUR) }, now);
        expect(bounds.latest).toBeNull();
        expect(bounds.reason).toBe("window_closed");
    });

    it("bounds an open clockless channel by the horizon", () => {
        const bounds = scheduleBounds({ open: true }, now);
        expect(bounds.latest?.getTime()).toBe(now.getTime() + MAX_SCHEDULE_HORIZON_MS);
    });

    it("bounds by the window when it closes before the horizon", () => {
        const bounds = scheduleBounds({ open: true, expiresAt: at(6 * HOUR) }, now);
        expect(bounds.latest?.getTime()).toBe(now.getTime() + 6 * HOUR);
    });

    it("bounds by the horizon when the window outlasts it", () => {
        const bounds = scheduleBounds(
            { open: true, expiresAt: at(MAX_SCHEDULE_HORIZON_MS + 24 * HOUR) },
            now,
        );
        expect(bounds.latest?.getTime()).toBe(now.getTime() + MAX_SCHEDULE_HORIZON_MS);
    });

    // The server already did this arithmetic and its answer is authoritative;
    // deriving our own would be a second place for the boundary to live.
    it("prefers the server's latestAllowedAt over anything derived", () => {
        const bounds = scheduleBounds(
            { open: true, expiresAt: at(6 * HOUR), latestAllowedAt: at(3 * HOUR) },
            now,
        );
        expect(bounds.latest?.getTime()).toBe(now.getTime() + 3 * HOUR);
    });

    it("holds the earliest at the minimum lead", () => {
        const bounds = scheduleBounds({ open: true, expiresAt: at(6 * HOUR) }, now);
        expect(bounds.earliest?.getTime()).toBe(now.getTime() + MIN_SCHEDULE_LEAD_MS);
    });
});

describe("validateScheduledAt", () => {
    const openWindow = { open: true, expiresAt: at(6 * HOUR) };

    it("accepts a time comfortably inside the window", () => {
        expect(validateScheduledAt(new Date(now.getTime() + 2 * HOUR), openWindow, now))
            .toEqual({ ok: true });
    });

    it("accepts exactly the window boundary", () => {
        expect(validateScheduledAt(new Date(now.getTime() + 6 * HOUR), openWindow, now))
            .toEqual({ ok: true });
    });

    it("refuses one millisecond past the window", () => {
        expect(validateScheduledAt(new Date(now.getTime() + 6 * HOUR + 1), openWindow, now))
            .toEqual({ ok: false, code: "past_window" });
    });

    it("accepts exactly the minimum lead", () => {
        expect(validateScheduledAt(new Date(now.getTime() + MIN_SCHEDULE_LEAD_MS), openWindow, now))
            .toEqual({ ok: true });
    });

    it("refuses one millisecond inside the minimum lead", () => {
        expect(
            validateScheduledAt(new Date(now.getTime() + MIN_SCHEDULE_LEAD_MS - 1), openWindow, now),
        ).toEqual({ ok: false, code: "too_soon" });
    });

    it("refuses the past", () => {
        expect(validateScheduledAt(new Date(now.getTime() - HOUR), openWindow, now))
            .toEqual({ ok: false, code: "too_soon" });
    });

    it("refuses a closed window before any other check", () => {
        expect(
            validateScheduledAt(new Date(now.getTime() + 2 * HOUR), { open: false, expiresAt: at(6 * HOUR) }, now),
        ).toEqual({ ok: false, code: "window_closed" });
    });

    // A clockless channel must say "too far", not "past the window" — there is
    // no window to have passed.
    it("refuses past the horizon on a clockless channel as too_far", () => {
        expect(
            validateScheduledAt(
                new Date(now.getTime() + MAX_SCHEDULE_HORIZON_MS + HOUR),
                { open: true },
                now,
            ),
        ).toEqual({ ok: false, code: "too_far" });
    });

    // Both bounds are breached; the window is the one the operator can act on.
    it("reports a window breach ahead of a horizon breach", () => {
        expect(
            validateScheduledAt(
                new Date(now.getTime() + MAX_SCHEDULE_HORIZON_MS + HOUR),
                openWindow,
                now,
            ),
        ).toEqual({ ok: false, code: "past_window" });
    });
});

describe("canSchedule", () => {
    it("offers scheduling only on an open window", () => {
        expect(canSchedule({ open: true })).toBe(true);
        expect(canSchedule({ open: false, expiresAt: at(6 * HOUR) })).toBe(false);
        expect(canSchedule(null)).toBe(false);
        expect(canSchedule(undefined)).toBe(false);
    });
});

describe("marginBeforeWindowCloses", () => {
    it("reports how much window is left after delivery", () => {
        expect(
            marginBeforeWindowCloses(new Date(now.getTime() + 2 * HOUR), {
                open: true,
                expiresAt: at(6 * HOUR),
            }),
        ).toBe(4 * HOUR);
    });

    it("reports nothing on a channel with no clock", () => {
        expect(marginBeforeWindowCloses(new Date(now.getTime() + 2 * HOUR), { open: true })).toBeNull();
    });

    it("reports nothing on a closed window", () => {
        expect(
            marginBeforeWindowCloses(new Date(now.getTime() + 2 * HOUR), {
                open: false,
                expiresAt: at(6 * HOUR),
            }),
        ).toBeNull();
    });
});
