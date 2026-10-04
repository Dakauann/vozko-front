const OPEN_KEY = "assistant-dock:open";
const CHANGED_EVENT = "assistant-dock:changed";

let remembered: boolean | null = null;

function stored(): boolean {
  try {
    return sessionStorage.getItem(OPEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function isDockOpen(): boolean {
  return remembered ?? stored();
}

function persist(open: boolean) {
  try {
    sessionStorage.setItem(OPEN_KEY, String(open));
  } catch {
    return;
  }
}

export function setDockOpen(open: boolean) {
  remembered = open;
  persist(open);
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function subscribeDock(onChange: () => void): () => void {
  window.addEventListener(CHANGED_EVENT, onChange);
  return () => window.removeEventListener(CHANGED_EVENT, onChange);
}

export function openDock() {
  setDockOpen(true);
}
