"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isActionError, type ActionError } from "@/app/actions/action-result";
import { getStudioProjectAction, saveStudioProjectAction } from "@/app/actions/studio";
import type { DocumentOf, StudioKind } from "@/lib/studio/document";
import { readProject, type StudioChange, type StudioProject } from "@/lib/studio/project";
import type { DocumentIssue } from "@/lib/studio/validate";

export const AUTOSAVE_DELAY_MS = 1500;
export const KEEPALIVE_LIMIT_BYTES = 60 * 1024;

export type StudioSaveStatus = "saved" | "saving" | "unsaved" | "conflict" | "error";

export type StudioProjectLoad<K extends StudioKind> =
  | { status: "loading" }
  | { status: "failed"; error: ActionError | null; issue: DocumentIssue | null }
  | { status: "ready"; project: StudioProject<DocumentOf<K>> };

export interface StudioCommitted {
  version: number | null;
  settled: boolean;
}

export interface StudioProjectHandle<K extends StudioKind> {
  load: StudioProjectLoad<K>;
  generation: number;
  name: string | null;
  saveStatus: StudioSaveStatus;
  saveError: ActionError | null;
  conflict: StudioProject | null;
  edit: (change: StudioChange) => void;
  flush: () => Promise<void>;
  committed: () => StudioCommitted;
  retrySave: () => void;
  reloadFromServer: () => void;
  keepMine: () => void;
  reload: () => void;
}

interface Session<K extends StudioKind> {
  key: string;
  load: StudioProjectLoad<K>;
  generation: number;
  name: string | null;
  saveStatus: StudioSaveStatus;
  saveError: ActionError | null;
  conflict: StudioProject | null;
}

function freshSession<K extends StudioKind>(key: string): Session<K> {
  return { key, load: { status: "loading" }, generation: 0, name: null, saveStatus: "saved", saveError: null, conflict: null };
}

function merged(older: StudioChange | null, newer: StudioChange | null): StudioChange | null {
  if (!older) return newer;
  if (!newer) return older;
  return { ...older, ...newer };
}

function bodyBytes(change: StudioChange): number {
  return new TextEncoder().encode(JSON.stringify(change)).length;
}

export function useStudioProject<K extends StudioKind>(projectId: string, kind: K): StudioProjectHandle<K> {
  const [attempt, setAttempt] = useState(0);
  const key = `${kind}:${projectId}#${attempt}`;
  const [stored, setSession] = useState<Session<K>>(() => freshSession(key));
  const session = stored.key === key ? stored : freshSession<K>(key);

  const version = useRef<number | null>(null);
  const pending = useRef<StudioChange | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conflicted = useRef(false);
  const saveRef = useRef<(keepalive: boolean) => Promise<void>>(() => Promise.resolve());

  const patch = useCallback(
    (change: Partial<Omit<Session<K>, "key">> | ((current: Session<K>) => Partial<Omit<Session<K>, "key">>)) =>
      setSession((current) => {
        const base = current.key === key ? current : freshSession<K>(key);
        return { ...base, ...(typeof change === "function" ? change(base) : change) };
      }),
    [key],
  );

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const scheduleSave = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => void saveRef.current(false), AUTOSAVE_DELAY_MS);
  }, [clearTimer]);

  const adopt = useCallback(
    (project: StudioProject): boolean => {
      const read = readProject(project, kind);
      if (!read.ok) {
        patch({ load: { status: "failed", error: null, issue: read.issue } });
        return false;
      }
      version.current = project.version;
      patch({ load: { status: "ready", project: read.project }, name: project.name });
      return true;
    },
    [kind, patch],
  );

  useEffect(() => {
    let cancelled = false;
    version.current = null;
    pending.current = null;
    conflicted.current = false;
    void getStudioProjectAction(projectId).then((result) => {
      if (cancelled) return;
      if (isActionError(result)) {
        patch({ load: { status: "failed", error: result, issue: null } });
        return;
      }
      adopt(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, adopt, patch]);

  const save = useCallback(
    (keepalive: boolean): Promise<void> => {
      clearTimer();
      if (inFlight.current) return inFlight.current;
      const change = pending.current;
      const base = version.current;
      if (!change || base === null || conflicted.current) return Promise.resolve();
      pending.current = null;
      patch({ saveStatus: "saving" });
      const run = saveStudioProjectAction(projectId, base, change, { keepalive: keepalive && bodyBytes(change) <= KEEPALIVE_LIMIT_BYTES }).then((result) => {
        inFlight.current = null;
        if (result.status === "saved") {
          version.current = result.project.version;
          patch({ saveError: null, saveStatus: pending.current ? "unsaved" : "saved" });
          if (pending.current) scheduleSave();
          return;
        }
        pending.current = merged(change, pending.current);
        if (result.status === "conflict") {
          conflicted.current = true;
          patch({ conflict: result.current, saveStatus: "conflict" });
          return;
        }
        patch({ saveError: result.error, saveStatus: "error" });
      });
      inFlight.current = run;
      return run;
    },
    [projectId, clearTimer, scheduleSave, patch],
  );

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const edit = useCallback(
    (change: StudioChange) => {
      pending.current = merged(pending.current, change);
      if (change.name !== undefined) patch({ name: change.name });
      if (conflicted.current) return;
      patch((current) => ({ saveStatus: current.saveStatus === "saving" ? "saving" : "unsaved" }));
      scheduleSave();
    },
    [scheduleSave, patch],
  );

  const flush = useCallback(async () => {
    if (inFlight.current) await inFlight.current;
    await save(false);
  }, [save]);

  const committed = useCallback(
    (): StudioCommitted => ({ version: version.current, settled: !pending.current && !inFlight.current && !conflicted.current }),
    [],
  );

  const retrySave = useCallback(() => void save(false), [save]);

  const keepMine = useCallback(() => {
    const current = session.conflict;
    if (!current) return;
    version.current = current.version;
    conflicted.current = false;
    patch({ conflict: null });
    void save(false);
  }, [session.conflict, save, patch]);

  const reloadFromServer = useCallback(() => {
    const current = session.conflict;
    if (!current) return;
    clearTimer();
    pending.current = null;
    conflicted.current = false;
    patch({ conflict: null, saveError: null, saveStatus: "saved" });
    if (adopt(current)) patch((state) => ({ generation: state.generation + 1 }));
  }, [session.conflict, adopt, clearTimer, patch]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    const flushHidden = () => {
      if (document.visibilityState === "hidden" && pending.current) void save(true);
    };
    const flushLeaving = () => {
      if (pending.current) void save(true);
    };
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current || inFlight.current) event.preventDefault();
    };
    document.addEventListener("visibilitychange", flushHidden);
    window.addEventListener("pagehide", flushLeaving);
    window.addEventListener("beforeunload", warn);
    return () => {
      document.removeEventListener("visibilitychange", flushHidden);
      window.removeEventListener("pagehide", flushLeaving);
      window.removeEventListener("beforeunload", warn);
      clearTimer();
      if (pending.current) void save(true);
    };
  }, [save, clearTimer]);

  return {
    load: session.load,
    generation: session.generation,
    name: session.name,
    saveStatus: session.saveStatus,
    saveError: session.saveError,
    conflict: session.conflict,
    edit,
    flush,
    committed,
    retrySave,
    reloadFromServer,
    keepMine,
    reload,
  };
}
