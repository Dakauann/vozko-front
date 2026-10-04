"use client";

import { useCallback, useRef, type FocusEvent, type MouseEvent } from "react";

export function useSelectOnFocus() {
  const justFocused = useRef(false);

  const onFocus = useCallback((event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.select();
    justFocused.current = true;
  }, []);

  const onMouseUp = useCallback((event: MouseEvent<HTMLInputElement>) => {
    if (!justFocused.current) return;
    justFocused.current = false;
    event.preventDefault();
  }, []);

  return { onFocus, onMouseUp };
}
