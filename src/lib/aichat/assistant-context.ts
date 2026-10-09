import type { AttendanceView, LeadsView, StudioView } from "./types";

export interface AssistantScope {
  period: string;
  department: string;
  member: string;
  channel: string;
  campaign?: string;
}

export interface AttendanceAssistantContext {
  kind: "attendance";
  view: AttendanceView;
  scope: AssistantScope;
}

export interface StudioAssistantContext {
  kind: "studio";
  view: StudioView;
  projectName: string;
}

export interface LeadsAssistantScope {
  filter: string;
  selected?: string;
}

export interface LeadsAssistantContext {
  kind: "leads";
  view: LeadsView;
  scope: LeadsAssistantScope;
}

export type AssistantContext = AttendanceAssistantContext | StudioAssistantContext | LeadsAssistantContext;

export interface AssistantContextStore {
  get: () => AssistantContext | null;
  set: (next: AssistantContext | null) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createAssistantContextStore(): AssistantContextStore {
  let current: AssistantContext | null = null;
  let fingerprint = "null";
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      const nextFingerprint = JSON.stringify(next);
      if (nextFingerprint === fingerprint) return;
      current = next;
      fingerprint = nextFingerprint;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
