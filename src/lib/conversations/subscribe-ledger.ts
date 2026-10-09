import { vouchSubscribedLead, type LeadReread, type SubscribedLead } from "./lead-patch";

export interface PendingSubscribe {
  awaiting: number;
  reread?: LeadReread;
}

function foldReread(held: LeadReread | undefined, next: LeadReread | undefined): LeadReread | undefined {
  if (!next) return held;
  if (!held || held.leadId !== next.leadId) return next;
  return { leadId: next.leadId, fields: [...new Set([...held.fields, ...next.fields])] };
}

function pendingOf(awaiting: number, reread: LeadReread | undefined): PendingSubscribe {
  return reread ? { awaiting, reread } : { awaiting };
}

export function subscribeSent(pending: PendingSubscribe | undefined, reread?: LeadReread): PendingSubscribe {
  return pendingOf((pending?.awaiting ?? 0) + 1, foldReread(pending?.reread, reread));
}

export function subscribeAnswered<A extends SubscribedLead>(
  pending: PendingSubscribe | undefined,
  answer: A,
): { answer: A; pending: PendingSubscribe | undefined } {
  const vouched = vouchSubscribedLead(answer, pending?.reread);
  const awaiting = (pending?.awaiting ?? 0) - 1;
  return { answer: vouched, pending: awaiting > 0 ? pendingOf(awaiting, pending?.reread) : undefined };
}

export function subscribesDropped(pending: PendingSubscribe | undefined): PendingSubscribe | undefined {
  return pending?.reread ? { awaiting: 0, reread: pending.reread } : undefined;
}
