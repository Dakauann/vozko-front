import { describe, expect, it } from "vitest";

import {
    availableColleagues,
    callEndReasonFor,
    transferContextFrom,
    transferMessage,
    transferErrorCode,
    transferStateFrom,
} from "./transfer";

describe("transfer status", () => {
    it("reads the server status into the operator's transfer state", () => {
        expect(
            transferStateFrom({ transfer_id: "t1", call_id: "c1", status: "ringing", target_user_id: "u2", target_name: "Bia" }),
        ).toEqual({ transferId: "t1", callId: "c1", status: "ringing", targetName: "Bia", queueName: undefined, reason: undefined });
    });

    it("ignores statuses it does not know", () => {
        expect(transferStateFrom({ transfer_id: "t1", call_id: "c1", status: "teleported" })).toBeNull();
    });

    it("ends the operator's call once the caller is handed over or leaves", () => {
        const state = (status: string) => transferStateFrom({ transfer_id: "t", call_id: "c", status })!;
        expect(callEndReasonFor(state("queued"))).toBe("transferred");
        expect(callEndReasonFor(state("connected"))).toBe("transferred");
        expect(callEndReasonFor(state("ended"))).toBe("caller_hung_up");
        expect(callEndReasonFor(state("ringing"))).toBeNull();
        expect(callEndReasonFor(state("returned"))).toBeNull();
    });
});

describe("transfer message", () => {
    it("names the colleague or the queue and trims the notes", () => {
        expect(transferMessage({ kind: "member", userId: "u2" }, "  quer cancelar ")).toEqual({
            target_kind: "member",
            user_id: "u2",
            notes: "quer cancelar",
        });
        expect(transferMessage({ kind: "queue", queueId: "q1" }, "   ")).toEqual({ target_kind: "queue", queue_id: "q1" });
    });
});

describe("transfer context on an incoming call", () => {
    it("keeps who sent the call, the queue and the notes", () => {
        expect(transferContextFrom({ from_name: "Ana", queue_name: "Suporte", notes: " segunda via " })).toEqual({
            fromUserId: undefined,
            fromName: "Ana",
            queueId: undefined,
            queueName: "Suporte",
            notes: "segunda via",
        });
    });

    it("is absent for an ordinary call", () => {
        expect(transferContextFrom(undefined)).toBeUndefined();
        expect(transferContextFrom({ notes: "  " })).toBeUndefined();
    });
});

describe("colleagues to transfer to", () => {
    it("lists free colleagues by name, never yourself", () => {
        const presence = [
            { userId: "me", username: "Ana", busy: false },
            { userId: "u3", username: "Caio", busy: false },
            { userId: "u2", username: "Bia", busy: false },
            { userId: "u4", username: "Dani", busy: true },
        ];
        expect(availableColleagues(presence, "me").map((p) => p.username)).toEqual(["Bia", "Caio"]);
    });
});

describe("transfer errors", () => {
    it("recognises the server's transfer refusals and nothing else", () => {
        expect(transferErrorCode("target_unavailable")).toBe("target_unavailable");
        expect(transferErrorCode("no_active_call")).toBeNull();
        expect(transferErrorCode(null)).toBeNull();
    });
});
