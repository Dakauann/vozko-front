export function activeThreadKey(workspaceId: string): string {
  return `aichat:active-thread:${workspaceId}`;
}

export function readActiveThread(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function rememberActiveThread(key: string, threadId: string): void {
  try {
    window.localStorage.setItem(key, threadId);
  } catch {}
}

export function forgetActiveThread(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}
