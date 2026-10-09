export type FollowedKind = "run" | "audience";

export interface FollowedJob {
  id: string;
  kind: FollowedKind;
  since: number;
}

export interface FollowedStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export const FOLLOWED_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const FOLLOWED_LIMIT = 20;

const KINDS: readonly string[] = ["run", "audience"];

export function followedJobsKey(workspaceId: string): string {
  return `vozko.leads.followedJobs.${workspaceId}`;
}

function isFollowedJob(value: unknown, now: number): value is FollowedJob {
  if (typeof value !== "object" || value === null) return false;
  const job = value as Record<string, unknown>;
  if (typeof job.id !== "string" || job.id === "" || typeof job.kind !== "string" || !KINDS.includes(job.kind)) return false;
  return typeof job.since === "number" && Number.isFinite(job.since) && now - job.since <= FOLLOWED_MAX_AGE_MS;
}

export function parseFollowed(raw: string | null, now: number): FollowedJob[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is FollowedJob => isFollowedJob(item, now)).map(({ id, kind, since }) => ({ id, kind, since }));
  } catch {
    return [];
  }
}

export function withoutFollowed(list: readonly FollowedJob[], kind: FollowedKind, id: string): FollowedJob[] {
  return list.filter((job) => job.kind !== kind || job.id !== id);
}

export function withFollowed(list: readonly FollowedJob[], job: FollowedJob): FollowedJob[] {
  return [...withoutFollowed(list, job.kind, job.id), job].slice(-FOLLOWED_LIMIT);
}

export function readFollowed(storage: FollowedStorage | null, workspaceId: string, now: number): FollowedJob[] {
  if (!storage || !workspaceId) return [];
  try {
    return parseFollowed(storage.getItem(followedJobsKey(workspaceId)), now);
  } catch {
    return [];
  }
}

function writeFollowed(storage: FollowedStorage, workspaceId: string, list: readonly FollowedJob[]) {
  const key = followedJobsKey(workspaceId);
  if (list.length === 0) storage.removeItem(key);
  else storage.setItem(key, JSON.stringify(list));
}

export function rememberFollowed(storage: FollowedStorage | null, workspaceId: string, job: FollowedJob, now: number): void {
  if (!storage || !workspaceId) return;
  try {
    writeFollowed(storage, workspaceId, withFollowed(readFollowed(storage, workspaceId, now), job));
  } catch {
    return;
  }
}

export function forgetFollowed(storage: FollowedStorage | null, workspaceId: string, kind: FollowedKind, id: string, now: number): void {
  if (!storage || !workspaceId) return;
  try {
    writeFollowed(storage, workspaceId, withoutFollowed(readFollowed(storage, workspaceId, now), kind, id));
  } catch {
    return;
  }
}

export function browserStorage(): FollowedStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
