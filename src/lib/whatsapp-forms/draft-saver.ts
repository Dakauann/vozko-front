import type { CodedRefusal } from "@/lib/api/coded-error";
import type { ParsedAnswer } from "@/lib/api/parsed-request";

import { isStaleDraft, problemsOf } from "./errors";
import type { Document, Problem, Version } from "./types";

export type DraftSaveStatus = "saved" | "pending" | "saving" | "stale" | "failed";

export interface DraftSaveState {
  status: DraftSaveStatus;
  problems: Problem[];
  error?: CodedRefusal;
}

export interface DraftSaverDeps {
  save: (document: Document, baseVersionId: string) => Promise<ParsedAnswer<Version>>;
  onState: (state: DraftSaveState) => void;
  onSaved?: (version: Version) => void;
  onStale?: (saver: DraftSaver) => void;
}

export interface DraftSaver {
  base: () => string;
  request: (document: Document) => Promise<void>;
  retry: () => Promise<void>;
  rebase: (baseVersionId: string) => void;
  busy: () => boolean;
}

export function createDraftSaver(baseVersionId: string, deps: DraftSaverDeps): DraftSaver {
  let self: DraftSaver | null = null;
  let base = baseVersionId;
  let queued: Document | null = null;
  let failed: Document | null = null;
  let running: Promise<void> | null = null;
  let stale = false;

  const run = async () => {
    while (queued && !stale) {
      const document = queued;
      queued = null;
      deps.onState({ status: "saving", problems: [] });
      const answer = await deps.save(document, base);
      if (answer.error) {
        if (isStaleDraft(answer.error)) {
          stale = true;
          queued = null;
          deps.onState({ status: "stale", problems: [], error: answer.error });
          if (self) deps.onStale?.(self);
          return;
        }
        failed = queued ?? document;
        queued = null;
        deps.onState({ status: "failed", problems: problemsOf(answer.error), error: answer.error });
        return;
      }
      failed = null;
      base = answer.data.id;
      deps.onSaved?.(answer.data);
      if (!queued) deps.onState({ status: "saved", problems: answer.data.problems ?? [] });
    }
  };

  const start = (): Promise<void> => {
    if (!running) {
      running = run().finally(() => {
        running = null;
      });
    }
    return running;
  };

  self = {
    base: () => base,
    busy: () => running !== null,
    request: (document) => {
      if (stale) return Promise.resolve();
      queued = document;
      failed = null;
      if (running) {
        deps.onState({ status: "pending", problems: [] });
        return running.then(() => (queued ? start() : undefined));
      }
      return start();
    },
    retry: () => {
      if (stale || !failed) return Promise.resolve();
      queued = failed;
      failed = null;
      return start();
    },
    rebase: (baseVersionId) => {
      base = baseVersionId;
      stale = false;
      queued = null;
      failed = null;
    },
  };
  return self;
}
