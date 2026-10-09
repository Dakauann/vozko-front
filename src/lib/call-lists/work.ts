import type { CallBlocker } from "@/lib/call-session/call-readiness";
import type { DialBlocker } from "@/lib/dialer/dial-targets";
import { callOutcome } from "@/lib/dialer/dial-string";

import { CALLBACK_DISPOSITION, type CallListItem, type CallListTrunk, type CallListTrunkRefusal } from "./types";

export type WorkStage = "idle" | "ready" | "calling" | "ended" | "lost" | "notStarted";

export interface EndedCall {
  callId?: string;
  reason?: string;
  durationSeconds?: number;
}

export interface ItemCallView {
  status: "ringing" | "answered" | "waiting_slot" | "ended";
  callId?: string;
  reason?: string;
  durationSeconds?: number;
}

export interface ItemCallTrack {
  seen: ItemCallView | null;
  ended: EndedCall | null;
}

export interface ItemDial {
  itemId: string;
  requestId: string;
  track: ItemCallTrack;
}

export interface CallSnapshot extends ItemCallView {
  requestId?: string;
}

const IDLE_TRACK: ItemCallTrack = { seen: null, ended: null };
const NEVER_STARTED = "dial_failed";
const CONNECTION_LOST = "connection_lost";

function sameView(a: ItemCallView | null, b: ItemCallView | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.status === b.status && a.callId === b.callId && a.reason === b.reason && a.durationSeconds === b.durationSeconds;
}

function endOf(call: ItemCallView): EndedCall {
  const ended: EndedCall = {};
  if (call.callId) ended.callId = call.callId;
  if (call.reason) ended.reason = call.reason;
  if (call.durationSeconds !== undefined) ended.durationSeconds = call.durationSeconds;
  return ended;
}

export function trackItemCall(track: ItemCallTrack, call: ItemCallView | null, errorCode: string | null): ItemCallTrack {
  if (call) {
    if (sameView(track.seen, call)) return track;
    return { seen: call, ended: call.status === "ended" ? endOf(call) : null };
  }
  if (!track.seen) return track;
  if (track.seen.status === "ended" || track.ended) return { seen: null, ended: track.ended };
  if (track.seen.callId) return { seen: null, ended: errorCode ? { callId: track.seen.callId, reason: errorCode } : { callId: track.seen.callId } };
  return { seen: null, ended: { reason: errorCode ?? NEVER_STARTED } };
}

function dialFor(dial: ItemDial | null, item: CallListItem | null): ItemDial | null {
  return dial && item && dial.itemId === item.id ? dial : null;
}

function connectionLost(ended: EndedCall): boolean {
  return callOutcome(ended.reason) === CONNECTION_LOST;
}

export function dialItem(item: CallListItem, requestId: string): ItemDial {
  return { itemId: item.id, requestId, track: IDLE_TRACK };
}

function viewOf(dial: ItemDial, call: CallSnapshot | null): ItemCallView | null {
  if (!call || !call.requestId || call.requestId !== dial.requestId) return null;
  return { status: call.status, ...endOf(call) };
}

export function followItemCall(dial: ItemDial, call: CallSnapshot | null, errorCode: string | null): ItemDial {
  const track = trackItemCall(dial.track, viewOf(dial, call), errorCode);
  return track === dial.track ? dial : { ...dial, track };
}

export function ownsCall(dial: ItemDial | null, call: CallSnapshot | null): boolean {
  return dial !== null && viewOf(dial, call) !== null;
}

export function workStage({ item, dial }: { item: CallListItem | null; dial: ItemDial | null }): WorkStage {
  if (!item) return "idle";
  const own = dialFor(dial, item);
  if (!own) return item.closable ? "ended" : "ready";
  if (own.track.seen && own.track.seen.status !== "ended") return "calling";
  const ended = own.track.ended;
  if (ended) {
    if (connectionLost(ended)) return "lost";
    return ended.callId ? "ended" : "notStarted";
  }
  return item.closable ? "ended" : "ready";
}

export type CloseBlocker = "notCalled" | "callLive" | "noOutcome" | "callbackTime";

export function closeBlocker({
  item,
  anyLive,
  disposition,
  callbackAt,
}: {
  item: CallListItem | null;
  anyLive: boolean;
  disposition: string;
  callbackAt: string;
}): CloseBlocker | null {
  if (!item) return "notCalled";
  if (anyLive) return "callLive";
  if (!item.closable) return "notCalled";
  if (!disposition) return "noOutcome";
  if (disposition === CALLBACK_DISPOSITION && !callbackAt) return "callbackTime";
  return null;
}

export function listDialBlocker({
  readiness,
  trunks,
  trunkRefusal,
  trunk,
}: {
  readiness: CallBlocker | null;
  trunks: readonly CallListTrunk[];
  trunkRefusal: CallListTrunkRefusal | undefined;
  trunk: CallListTrunk | null;
}): DialBlocker | null {
  if (readiness) return readiness;
  if (trunkRefusal) return trunkRefusal;
  if (trunks.length === 0 || !trunk) return "no_dialable_trunk";
  return null;
}

export function reservationLive(item: CallListItem, userId: string, now: Date): boolean {
  if (item.state !== "reserved" || !userId || item.reservedBy !== userId || !item.reservedUntil) return false;
  const until = Date.parse(item.reservedUntil);
  return Number.isFinite(until) && until > now.getTime();
}

export function heldItem(items: readonly CallListItem[], userId: string): CallListItem | null {
  if (!userId) return null;
  return items.find((candidate) => candidate.state === "reserved" && candidate.reservedBy === userId) ?? null;
}

export type RestorePlan = "next" | "card" | "none";

export function restorePlan({
  held,
  userId,
  now,
  serving,
}: {
  held: CallListItem | null;
  userId: string;
  now: Date;
  serving: boolean;
}): RestorePlan {
  if (!held) return "none";
  if (reservationLive(held, userId, now)) return serving ? "next" : "card";
  return held.closable ? "card" : "none";
}
