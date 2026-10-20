import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import deMessages from "@/i18n/messages/de.json";

import {
  AUTOSAVE_DELAY_MS,
  MAX_AUTO_RETRIES,
  autosaveDelay,
  canOverwriteDraft,
  canSendDraft,
  draftConflictOf,
  draftFailureKindOf,
  draftSaveReducer,
  draftSaveStatus,
  draftStatusCopy,
  hasUnsavedDraft,
  initialDraftName,
  initialDraftSave,
  type DraftSaveEvent,
  type DraftSaveState,
} from "./draft-save";

const loaded = initialDraftSave({ key: "k1", revision: 3, savedAt: 1_000 });

function run(state: DraftSaveState, ...events: DraftSaveEvent[]): DraftSaveState {
  return events.reduce(draftSaveReducer, state);
}

describe("draft autosave queue", () => {
  it("waits for the debounce after an edit and does nothing while the draft matches what was saved", () => {
    expect(autosaveDelay(loaded, "k1")).toBeNull();
    expect(autosaveDelay(loaded, "k2")).toBe(AUTOSAVE_DELAY_MS);
    expect(AUTOSAVE_DELAY_MS).toBe(1500);
  });

  it("never overlaps requests: nothing is scheduled or sent while one is in flight", () => {
    const sending = run(loaded, { type: "sent" });
    expect(autosaveDelay(sending, "k3")).toBeNull();
    expect(canSendDraft(sending, "k3")).toBe(false);
  });

  it("lets the latest state win: an edit made during a save is sent after it with the new revision", () => {
    const saved = run(loaded, { type: "sent" }, { type: "saved", key: "k2", revision: 4, at: 2_000 });
    expect(saved.revision).toBe(4);
    expect(saved.savedKey).toBe("k2");
    expect(autosaveDelay(saved, "k3")).toBe(AUTOSAVE_DELAY_MS);
    expect(canSendDraft(saved, "k3")).toBe(true);
  });

  it("backs off on transient errors and stops retrying on its own after the cap", () => {
    let state = loaded;
    const delays: (number | null)[] = [];
    for (let attempt = 0; attempt < MAX_AUTO_RETRIES; attempt += 1) {
      state = run(state, { type: "sent" }, { type: "failed", key: "k2", kind: "transient", message: "rede", autoRetry: true });
      delays.push(autosaveDelay(state, "k2"));
    }
    expect(delays.slice(0, 4)).toEqual([1000, 2000, 4000, 8000]);
    expect(delays[MAX_AUTO_RETRIES - 1]).toBeNull();
    expect(state.failure?.attempts).toBe(MAX_AUTO_RETRIES);
  });

  it("does not retry on its own a refusal, an invalid draft or a create that may already have happened", () => {
    for (const failed of [
      { kind: "refused", autoRetry: false },
      { kind: "invalid", autoRetry: false },
      { kind: "transient", autoRetry: false },
    ] as const) {
      const state = run(loaded, { type: "sent" }, { type: "failed", key: "k2", message: "não", ...failed });
      expect(autosaveDelay(state, "k2")).toBeNull();
    }
  });

  it("tries again after a failure once the draft changes", () => {
    const state = run(loaded, { type: "sent" }, { type: "failed", key: "k2", kind: "invalid", message: "sem gatilho", autoRetry: false });
    expect(autosaveDelay(state, "k3")).toBe(AUTOSAVE_DELAY_MS);
    expect(draftSaveStatus(state, "k3").kind).toBe("pending");
  });

  it("retry clears the failure so an explicit save can go now", () => {
    const failed = run(loaded, { type: "sent" }, { type: "failed", key: "k2", kind: "refused", message: "não", autoRetry: false });
    expect(canSendDraft(failed, "k2")).toBe(true);
    const retried = run(failed, { type: "retry" });
    expect(retried.failure).toBeNull();
    expect(autosaveDelay(retried, "k2")).toBe(AUTOSAVE_DELAY_MS);
  });

  it("releases the queue without a failure when a draft write ends in a plain refusal shown elsewhere", () => {
    const settled = run(loaded, { type: "sent" }, { type: "settled" });
    expect(settled.sending).toBe(false);
    expect(settled.failure).toBeNull();
    expect(draftSaveStatus(settled, "k1")).toEqual({ kind: "saved", at: 1_000 });
  });

  it("keeps saving possible after a save whose answer had no readable revision, but refuses to guess one", () => {
    const blind = run(loaded, { type: "sent" }, { type: "saved", key: "k2", revision: null, at: 2_000 });
    expect(blind.revision).toBeNull();
    expect(draftSaveStatus(blind, "k2")).toEqual({ kind: "saved", at: 2_000 });
  });

  it("only moves the revision forward when another response reports it", () => {
    expect(run(loaded, { type: "revised", revision: 2 }).revision).toBe(3);
    expect(run(loaded, { type: "revised", revision: 5 }).revision).toBe(5);
  });
});

describe("draft conflicts", () => {
  const conflicted = run(loaded, { type: "sent" }, { type: "conflicted", revision: 7 });

  it("pause autosave and explicit saves until the person chooses", () => {
    expect(autosaveDelay(conflicted, "k2")).toBeNull();
    expect(canSendDraft(conflicted, "k2")).toBe(false);
    expect(draftSaveStatus(conflicted, "k2").kind).toBe("conflict");
    expect(hasUnsavedDraft(conflicted, "k2")).toBe(true);
  });

  it("overwrite saves again on top of the revision the server reported", () => {
    expect(canOverwriteDraft(conflicted)).toBe(true);
    const overwriting = run(conflicted, { type: "overwrite" });
    expect(overwriting.conflict).toBeNull();
    expect(overwriting.revision).toBe(7);
    expect(canSendDraft(overwriting, "k2")).toBe(true);
  });

  it("never overwrites blind when the server did not say which revision it holds", () => {
    const unknown = run(loaded, { type: "sent" }, { type: "conflicted", revision: null });
    expect(canOverwriteDraft(unknown)).toBe(false);
    expect(run(unknown, { type: "overwrite" })).toEqual(unknown);
  });

  it("reload adopts the stored draft as saved and resumes autosave", () => {
    const reloaded = run(conflicted, { type: "loaded", key: "k9", revision: 7, at: 5_000 });
    expect(reloaded.conflict).toBeNull();
    expect(reloaded.failure).toBeNull();
    expect(reloaded.savedKey).toBe("k9");
    expect(draftSaveStatus(reloaded, "k9")).toEqual({ kind: "saved", at: 5_000 });
  });

  it("can be dismissed and shown again without losing the conflict", () => {
    const dismissed = run(conflicted, { type: "dismissConflict" });
    expect(dismissed.conflict).toEqual({ revision: 7, dismissed: true });
    expect(run(dismissed, { type: "showConflict" }).conflict).toEqual({ revision: 7, dismissed: false });
  });
});

describe("draft save status", () => {
  it("is idle for a new workflow nobody touched and pending once edited", () => {
    const fresh = initialDraftSave({ key: "empty", revision: null, savedAt: null });
    expect(draftSaveStatus(fresh, "empty")).toEqual({ kind: "idle" });
    expect(hasUnsavedDraft(fresh, "empty")).toBe(false);
    expect(draftSaveStatus(fresh, "named")).toEqual({ kind: "pending" });
    expect(hasUnsavedDraft(fresh, "named")).toBe(true);
  });

  it("says saving while a request runs and saved with its time afterwards", () => {
    expect(draftSaveStatus(run(loaded, { type: "sent" }), "k2")).toEqual({ kind: "saving" });
    expect(draftSaveStatus(loaded, "k1")).toEqual({ kind: "saved", at: 1_000 });
  });

  it("reports a failure with the reason and whether trying again can help", () => {
    const refused = run(loaded, { type: "sent" }, { type: "failed", key: "k2", kind: "refused", message: "Sem permissão", autoRetry: false });
    expect(draftSaveStatus(refused, "k2")).toEqual({ kind: "failed", message: "Sem permissão", retryable: true });
    const invalid = run(loaded, { type: "sent" }, { type: "failed", key: "k2", kind: "invalid", message: "Sem gatilho", autoRetry: false });
    expect(draftSaveStatus(invalid, "k2")).toEqual({ kind: "failed", message: "Sem gatilho", retryable: false });
  });

  it("maps every status to copy with a solid mark tone and the action it offers", () => {
    expect(draftStatusCopy({ kind: "pending" })).toEqual({ key: "saving", tone: "muted", action: null });
    expect(draftStatusCopy({ kind: "saving" })).toEqual({ key: "saving", tone: "muted", action: null });
    expect(draftStatusCopy({ kind: "saved", at: 1 })).toEqual({ key: "saved", tone: "healthy", action: null });
    expect(draftStatusCopy({ kind: "saved", at: null })).toEqual({ key: "savedNoTime", tone: "healthy", action: null });
    expect(draftStatusCopy({ kind: "failed", message: "x", retryable: true })).toEqual({ key: "failed", tone: "fault", action: "retry" });
    expect(draftStatusCopy({ kind: "failed", message: "x", retryable: false })).toEqual({ key: "failed", tone: "fault", action: null });
    expect(draftStatusCopy({ kind: "conflict" })).toEqual({ key: "conflict", tone: "warning", action: "resolve" });
    expect(draftStatusCopy({ kind: "idle" })).toBeNull();
  });

  it("has every status key in the four catalogs", () => {
    const keys = ["saving", "saved", "savedNoTime", "failed", "conflict", "retry", "resolve"];
    for (const messages of [ptMessages, enMessages, esMessages, deMessages]) {
      const scope = (messages.workflowsPage as unknown as Record<string, Record<string, unknown>>).draftSave;
      for (const key of keys) expect(typeof scope?.[key], key).toBe("string");
    }
  });
});

describe("draft write errors", () => {
  it("treats network, timeout, throttling and server errors as transient", () => {
    expect(draftFailureKindOf({})).toBe("transient");
    expect(draftFailureKindOf({ code: "timeout" })).toBe("transient");
    expect(draftFailureKindOf({ status: 408 })).toBe("transient");
    expect(draftFailureKindOf({ status: 429 })).toBe("transient");
    expect(draftFailureKindOf({ status: 503 })).toBe("transient");
  });

  it("treats validation, permission and missing workflow answers as refusals", () => {
    for (const status of [400, 401, 403, 404, 422]) expect(draftFailureKindOf({ status })).toBe("refused");
  });

  it("reads the stored revision from a draft conflict", () => {
    expect(draftConflictOf({ status: 409, code: "draft_conflict", details: { revision: 9 } })).toEqual({ revision: 9 });
    expect(draftConflictOf({ status: 409, code: "draft_conflict", details: { revision: "9" } })).toEqual({ revision: null });
    expect(draftConflictOf({ status: 409, code: "draft_conflict" })).toEqual({ revision: null });
    expect(draftConflictOf({ status: 409, code: "version_conflict", details: { revision: 9 } })).toBeNull();
    expect(draftConflictOf({ status: 400, code: "draft_revision_required" })).toBeNull();
  });
});

describe("new draft name", () => {
  it("names a brand new workflow so autosave can start instead of waiting silently for a name", () => {
    expect(initialDraftName(null, "Nova automação")).toBe("Nova automação");
    expect(initialDraftName(undefined, "Nova automação")).toBe("Nova automação");
  });

  it("keeps the name of a stored or prefilled workflow", () => {
    expect(initialDraftName({ name: "Matrícula" }, "Nova automação")).toBe("Matrícula");
  });

  it("has a default name in every locale", () => {
    for (const messages of [ptMessages, enMessages, esMessages, deMessages]) {
      expect(messages.workflowsPage.defaultName.trim()).not.toBe("");
    }
  });
});
