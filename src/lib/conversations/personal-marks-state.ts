import {
  beginOperation,
  confirmOperation,
  emptyLedger,
  pendingOn,
  rollbackOperation,
  type OptimisticLedger,
} from "@/lib/crm/optimistic";

import { inboxEntryKey } from "./inbox-hold";
import { NO_PERSONAL_MARKS, markOf, marksFromPage, withMark, type MarkedEntry, type PersonalMarks } from "./personal-marks";
import type { PersonalMark, PersonalMarkEntry, WsPersonalMarkPayload } from "./types";

export interface PersonalMarksState {
  marks: PersonalMarks;
  ledger: OptimisticLedger<PersonalMark | null>;
  issued: ReadonlyMap<string, string>;
}

export const EMPTY_PERSONAL_MARKS_STATE: PersonalMarksState = {
  marks: NO_PERSONAL_MARKS,
  ledger: emptyLedger(),
  issued: new Map(),
};

export function beginMarkChange(
  state: PersonalMarksState,
  requestId: string,
  entry: MarkedEntry,
  next: PersonalMark | null,
): PersonalMarksState {
  const target = inboxEntryKey(entry);
  return {
    marks: withMark(state.marks, entry, next),
    ledger: beginOperation(state.ledger, { id: requestId, target, snapshot: markOf(state.marks, entry) }),
    issued: new Map(state.issued).set(requestId, target),
  };
}

export function receiveMark(state: PersonalMarksState, payload: WsPersonalMarkPayload): PersonalMarksState {
  const entry = { entry_id: payload.entry_id, entry_type: payload.entry_type };
  const target = inboxEntryKey(entry);
  const pending = pendingOn(state.ledger, target);
  return {
    marks: withMark(state.marks, entry, payload.mark),
    ledger: pending ? confirmOperation(state.ledger, pending.id).ledger : state.ledger,
    issued: state.issued,
  };
}

export function refuseMarkChange(
  state: PersonalMarksState,
  requestId: string | undefined,
): { state: PersonalMarksState; owned: boolean } {
  const target = requestId ? state.issued.get(requestId) : undefined;
  if (!requestId || !target) return { state, owned: false };
  const issued = new Map(state.issued);
  issued.delete(requestId);
  if (!state.ledger.has(requestId)) return { state: { ...state, issued }, owned: true };
  const { ledger, snapshot } = rollbackOperation(state.ledger, requestId);
  const marks = new Map(state.marks);
  if (snapshot) marks.set(target, snapshot);
  else marks.delete(target);
  return { state: { marks, ledger, issued }, owned: true };
}

export function receivePage(
  state: PersonalMarksState,
  pageEntries: readonly MarkedEntry[],
  pageMarks: readonly PersonalMarkEntry[] | undefined,
): PersonalMarksState {
  const marks = marksFromPage(state.marks, pageEntries, pageMarks);
  return marks === state.marks ? state : { ...state, marks };
}
