import type { SchedulingWindow } from "./types";

/**
 * The scheduling bound, client-side.
 *
 * A direct port of the server's `LatestAllowed`
 * (`vozko-back/domain/scheduled_message/entity.go`), and it exists so the date
 * picker can DISABLE times the server would refuse rather than let the operator
 * pick one and be told no. `window.test.ts` runs the same case table as the Go
 * test, so the two cannot drift apart without one of them failing.
 *
 * Two rules, and the second is the subtle one:
 *
 *  - A closed window has no bound at all: we could not send this second, so we
 *    do not offer to send later.
 *  - An expiry bounds scheduling ONLY when the window is open. Some channels
 *    report an expiry while CLOSED — it is the countdown on a provider
 *    restriction, not a deadline to schedule up to — and reading it as a bound
 *    would invert its meaning. An OPEN window with no expiry is a channel with
 *    no clock, bounded only by the horizon.
 */

/** Matches `scheduled_message.MinScheduleLead`. */
export const MIN_SCHEDULE_LEAD_MS = 60_000;

/** Matches `scheduled_message.MaxScheduleHorizon`. */
export const MAX_SCHEDULE_HORIZON_MS = 30 * 24 * 60 * 60 * 1000;

export type ScheduleBoundReason = "window_closed";

export interface ScheduleBounds {
    /** Earliest acceptable instant, or null when the window is closed. */
    earliest: Date | null;
    /** Latest acceptable instant, or null when the window is closed. */
    latest: Date | null;
    /** Set when there is no bound because scheduling is impossible. */
    reason?: ScheduleBoundReason;
}

function parse(value: string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function scheduleBounds(
    window: SchedulingWindow | null | undefined,
    now: Date = new Date(),
): ScheduleBounds {
    if (!window?.open) {
        return { earliest: null, latest: null, reason: "window_closed" };
    }

    const earliest = new Date(now.getTime() + MIN_SCHEDULE_LEAD_MS);
    const horizon = new Date(now.getTime() + MAX_SCHEDULE_HORIZON_MS);

    // The server already computed this and it is authoritative; deriving our
    // own from expiresAt is the fallback for a response that predates the field.
    const serverLatest = parse(window.latestAllowedAt);
    if (serverLatest) {
        return { earliest, latest: serverLatest };
    }

    const expires = parse(window.expiresAt);
    if (!expires) {
        return { earliest, latest: horizon };
    }
    return { earliest, latest: expires < horizon ? expires : horizon };
}

export type ScheduleValidity =
    | { ok: true }
    | { ok: false; code: "window_closed" | "too_soon" | "past_window" | "too_far" };

/**
 * Whether a chosen instant is acceptable. Mirrors the server's
 * `ValidateScheduledAt`, including which of the two upper-bound refusals is
 * reported: a window breach outranks a horizon breach, because the window is
 * the one the operator can actually act on.
 */
export function validateScheduledAt(
    at: Date,
    window: SchedulingWindow | null | undefined,
    now: Date = new Date(),
): ScheduleValidity {
    const bounds = scheduleBounds(window, now);
    if (!bounds.earliest || !bounds.latest) {
        return { ok: false, code: "window_closed" };
    }
    if (at.getTime() < bounds.earliest.getTime()) {
        return { ok: false, code: "too_soon" };
    }
    if (at.getTime() > bounds.latest.getTime()) {
        const expires = parse(window?.expiresAt);
        if (expires && at.getTime() > expires.getTime()) {
            return { ok: false, code: "past_window" };
        }
        return { ok: false, code: "too_far" };
    }
    return { ok: true };
}

/**
 * Whether the composer should offer scheduling at all.
 *
 * Deliberately the same predicate that enables the composer itself: offering a
 * clock on a conversation that cannot be replied to is a promise the backend
 * refuses.
 */
export function canSchedule(window: SchedulingWindow | null | undefined): boolean {
    return Boolean(window?.open);
}

/**
 * How much of the window is left after a scheduled message goes out.
 *
 * Rendered next to the picker as reassurance ("7h 40m before the window
 * closes"): operators reason about the deadline, not the absolute time.
 * Null when the channel has no clock — there is no margin to report.
 */
export function marginBeforeWindowCloses(
    at: Date,
    window: SchedulingWindow | null | undefined,
): number | null {
    const expires = parse(window?.expiresAt);
    if (!window?.open || !expires) return null;
    return expires.getTime() - at.getTime();
}
