const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 720;
const CLOSE_POLL_MS = 600;

export interface PopupSize {
  width: number;
  height: number;
}

export function openCenteredPopup(url: string, name: string, size: PopupSize = { width: POPUP_WIDTH, height: POPUP_HEIGHT }): Window | null {
  const left = window.screenX + Math.max(0, (window.outerWidth - size.width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - size.height) / 2);
  return window.open(url, name, `width=${size.width},height=${size.height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
}

export function watchPopupClosed(popup: Window, onClosed: () => void): () => void {
  const timer = window.setInterval(() => {
    if (!popup.closed) return;
    window.clearInterval(timer);
    onClosed();
  }, CLOSE_POLL_MS);
  return () => window.clearInterval(timer);
}

export function closePopup(popup: Window): boolean {
  try {
    popup.close();
    return true;
  } catch {
    return false;
  }
}
