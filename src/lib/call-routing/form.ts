import {
    DEFAULT_HOLD_PRESET,
    type CallQueue,
    type CallQueuePayload,
    type HoldMusicRef,
    type QueueStrategy,
} from "@/lib/call-routing/types";

export const QUEUE_LIMITS = {
    name: 80,
    ring: { min: 5, max: 60, default: 15 },
    maxWait: { min: 10, max: 3600, default: 300 },
    wrapUp: { min: 0, max: 300, default: 10 },
} as const;

export type MembersFrom = "department" | "people";

export interface QueueForm {
    name: string;
    strategy: QueueStrategy;
    membersFrom: MembersFrom;
    departmentId: string;
    memberUserIds: string[];
    ringSeconds: number;
    maxWaitSeconds: number;
    wrapUpSeconds: number;
    holdMusic: HoldMusicRef;
}

export type QueueFormError = "name" | "department" | "members" | "ringSeconds" | "maxWaitSeconds" | "wrapUpSeconds";

export function queueFormFrom(queue: CallQueue | null): QueueForm {
    if (!queue) {
        return {
            name: "",
            strategy: "longest_idle",
            membersFrom: "people",
            departmentId: "",
            memberUserIds: [],
            ringSeconds: QUEUE_LIMITS.ring.default,
            maxWaitSeconds: QUEUE_LIMITS.maxWait.default,
            wrapUpSeconds: QUEUE_LIMITS.wrapUp.default,
            holdMusic: { presetId: DEFAULT_HOLD_PRESET },
        };
    }
    return {
        name: queue.name,
        strategy: queue.strategy,
        membersFrom: queue.departmentId ? "department" : "people",
        departmentId: queue.departmentId ?? "",
        memberUserIds: queue.memberUserIds,
        ringSeconds: queue.ringSeconds,
        maxWaitSeconds: queue.maxWaitSeconds,
        wrapUpSeconds: queue.wrapUpSeconds,
        holdMusic: queue.holdMusic,
    };
}

function within(value: number, limits: { min: number; max: number }): boolean {
    return Number.isInteger(value) && value >= limits.min && value <= limits.max;
}

export function queueFormErrors(form: QueueForm): QueueFormError[] {
    const errors: QueueFormError[] = [];
    const name = form.name.trim();
    if (!name || name.length > QUEUE_LIMITS.name) errors.push("name");
    if (form.membersFrom === "department" && !form.departmentId) errors.push("department");
    if (form.membersFrom === "people" && form.memberUserIds.length === 0) errors.push("members");
    if (!within(form.ringSeconds, QUEUE_LIMITS.ring)) errors.push("ringSeconds");
    if (!within(form.maxWaitSeconds, QUEUE_LIMITS.maxWait)) errors.push("maxWaitSeconds");
    if (!within(form.wrapUpSeconds, QUEUE_LIMITS.wrapUp)) errors.push("wrapUpSeconds");
    return errors;
}

export function queuePayload(form: QueueForm): CallQueuePayload {
    return {
        name: form.name.trim(),
        strategy: form.strategy,
        ...(form.membersFrom === "department"
            ? { departmentId: form.departmentId }
            : { memberUserIds: Array.from(new Set(form.memberUserIds)) }),
        ringSeconds: form.ringSeconds,
        maxWaitSeconds: form.maxWaitSeconds,
        wrapUpSeconds: form.wrapUpSeconds,
        holdMusic: form.holdMusic.mediaId ? { mediaId: form.holdMusic.mediaId } : { presetId: form.holdMusic.presetId || DEFAULT_HOLD_PRESET },
    };
}
