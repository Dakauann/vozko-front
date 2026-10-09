export const VERSION_CONFLICT = "version_conflict";

export type VersionedSaveResult<SavedKey extends string, T, E> =
  | ({ status: "saved" } & Record<SavedKey, T>)
  | { status: "conflict"; current: T }
  | { status: "failed"; error: E };

export function ifMatchHeader(version: number | undefined): Record<string, string> {
  return version === undefined ? {} : { "If-Match": String(version) };
}

export function isVersionConflict(error: { status?: number; code?: string }): boolean {
  return error.status === 409 && error.code === VERSION_CONFLICT;
}
