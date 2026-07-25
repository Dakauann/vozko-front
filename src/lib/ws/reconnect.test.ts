// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { backoffDelay, createReconnectController } from "./reconnect";

describe("backoffDelay", () => {
    it("grows exponentially and caps at maxDelay", () => {
        expect(backoffDelay(0, 1000, 30000)).toBe(1000);
        expect(backoffDelay(1, 1000, 30000)).toBe(2000);
        expect(backoffDelay(2, 1000, 30000)).toBe(4000);
        expect(backoffDelay(5, 1000, 30000)).toBe(30000); // 32000 capped
        expect(backoffDelay(50, 1000, 30000)).toBe(30000); // never overflows
    });
    it("clamps negative attempts", () => {
        expect(backoffDelay(-3, 1000, 30000)).toBe(1000);
    });
});

/** Minimal fake DOM target capturing listeners so tests can fire events. */
function fakeTarget() {
    const listeners = new Map<string, Set<EventListener>>();
    return {
        addEventListener(type: string, cb: EventListener) {
            (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(cb);
        },
        removeEventListener(type: string, cb: EventListener) {
            listeners.get(type)?.delete(cb);
        },
        fire(type: string) {
            for (const cb of listeners.get(type) ?? []) cb(new Event(type));
        },
        count(type: string) {
            return listeners.get(type)?.size ?? 0;
        },
    };
}

describe("createReconnectController", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("reconnects forever with capped backoff (never gives up)", () => {
        const connect = vi.fn();
        const c = createReconnectController({
            connect,
            shouldReconnect: () => true,
            baseDelayMs: 1000,
            maxDelayMs: 30000,
            win: null,
            doc: null,
        });

        // 20 close→reconnect cycles: the old hooks died after 15.
        for (let i = 0; i < 20; i++) {
            c.scheduleReconnect();
            vi.runOnlyPendingTimers();
        }
        expect(connect).toHaveBeenCalledTimes(20);
        // Backoff is capped, not unbounded.
        c.scheduleReconnect();
        expect(c.pendingDelay()).toBe(30000);
    });

    it("does NOT reconnect when shouldReconnect is false (no logged-out loop)", () => {
        const connect = vi.fn();
        const c = createReconnectController({
            connect,
            shouldReconnect: () => false,
            win: null,
            doc: null,
        });
        c.scheduleReconnect();
        expect(c.pendingDelay()).toBeNull();
        vi.runAllTimers();
        expect(connect).not.toHaveBeenCalled();
    });

    it("resetBackoff returns to the base delay", () => {
        const c = createReconnectController({
            connect: vi.fn(),
            shouldReconnect: () => true,
            baseDelayMs: 1000,
            maxDelayMs: 30000,
            win: null,
            doc: null,
        });
        c.scheduleReconnect(); // attempt 0 -> 1000
        vi.runOnlyPendingTimers();
        c.scheduleReconnect(); // attempt 1 -> 2000
        expect(c.pendingDelay()).toBe(2000);
        c.resetBackoff();
        c.scheduleReconnect(); // back to 1000
        expect(c.pendingDelay()).toBe(1000);
    });

    it("reconnects immediately when the tab becomes visible", () => {
        const connect = vi.fn();
        let visible: DocumentVisibilityState = "hidden";
        const doc = fakeTarget();
        const c = createReconnectController({
            connect,
            shouldReconnect: () => true,
            win: null,
            doc: { ...doc, get visibilityState() { return visible; } } as never,
        });
        c.start();
        c.scheduleReconnect(); // pending backoff
        expect(c.pendingDelay()).not.toBeNull();

        // Hidden -> a visibilitychange while still hidden does nothing.
        doc.fire("visibilitychange");
        expect(connect).not.toHaveBeenCalled();

        // Becomes visible -> immediate reconnect, pending backoff cancelled.
        visible = "visible";
        doc.fire("visibilitychange");
        expect(connect).toHaveBeenCalledTimes(1);
        expect(c.pendingDelay()).toBeNull();
    });

    it("reconnects immediately when the network comes back online", () => {
        const connect = vi.fn();
        const win = fakeTarget();
        const c = createReconnectController({
            connect,
            shouldReconnect: () => true,
            win: win as never,
            doc: null,
        });
        c.start();
        win.fire("online");
        expect(connect).toHaveBeenCalledTimes(1);
    });

    it("stop() removes listeners and cancels timers (no leaks)", () => {
        const connect = vi.fn();
        const win = fakeTarget();
        const doc = fakeTarget();
        const c = createReconnectController({
            connect,
            shouldReconnect: () => true,
            win: win as never,
            doc: { ...doc, visibilityState: "visible" } as never,
        });
        c.start();
        c.scheduleReconnect();
        expect(win.count("online")).toBe(1);
        expect(doc.count("visibilitychange")).toBe(1);

        c.stop();
        expect(win.count("online")).toBe(0);
        expect(doc.count("visibilitychange")).toBe(0);
        expect(c.pendingDelay()).toBeNull();
        // Firing after stop is inert.
        win.fire("online");
        vi.runAllTimers();
        expect(connect).not.toHaveBeenCalled();
    });
});
