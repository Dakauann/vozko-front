"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { openCenteredPopup, watchPopupClosed } from "@/lib/browser/popup";

const PORTAL_POPUP_NAME = "meta-portal";
const PORTAL_SIZE = { width: 1080, height: 820 };

export function usePortalPopup(onReturn: () => void) {
  const [awaiting, setAwaiting] = useState(false);
  const onReturnRef = useRef(onReturn);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onReturnRef.current = onReturn;
  }, [onReturn]);

  useEffect(() => () => stopRef.current?.(), []);

  const openPortal = useCallback((url: string): boolean => {
    stopRef.current?.();
    const popup = openCenteredPopup(url, PORTAL_POPUP_NAME, PORTAL_SIZE);

    const stop = () => {
      window.removeEventListener("focus", onFocus);
      stopWatching();
      stopRef.current = null;
      setAwaiting(false);
    };

    const onFocus = () => {
      if (!popup || popup.closed) stop();
      onReturnRef.current();
    };

    const stopWatching = popup
      ? watchPopupClosed(popup, () => {
          stop();
          onReturnRef.current();
        })
      : () => {};

    window.addEventListener("focus", onFocus);
    stopRef.current = stop;
    setAwaiting(true);
    return popup !== null;
  }, []);

  return { openPortal, awaiting };
}
