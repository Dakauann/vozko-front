"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type PictureInPictureSize,
  mirrorDocumentAppearance,
  requestPictureInPictureWindow,
  supportsDocumentPictureInPicture,
} from "@/lib/picture-in-picture";

const subscribeToNothing = () => () => {};

export function useDocumentPictureInPicture(onClosed: () => void) {
  const supported = useSyncExternalStore(
    subscribeToNothing,
    () => supportsDocumentPictureInPicture(window),
    () => false,
  );
  const [pictureWindow, setPictureWindow] = useState<Window | null>(null);
  const currentRef = useRef<Window | null>(null);
  const onClosedRef = useRef(onClosed);

  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  const open = useCallback(
    async (size: PictureInPictureSize, onOpened: () => void) => {
      const opened = await requestPictureInPictureWindow(window, size).catch(
        () => null,
      );
      if (!opened) return;

      const stopMirroring = mirrorDocumentAppearance(document, opened.document);
      opened.addEventListener(
        "pagehide",
        () => {
          stopMirroring();
          if (currentRef.current !== opened) return;
          currentRef.current = null;
          setPictureWindow(null);
          onClosedRef.current();
        },
        { once: true },
      );

      currentRef.current = opened;
      setPictureWindow(opened);
      onOpened();
    },
    [],
  );

  const close = useCallback(() => {
    currentRef.current?.close();
  }, []);

  useEffect(
    () => () => {
      const held = currentRef.current;
      currentRef.current = null;
      held?.close();
    },
    [],
  );

  return { supported, pictureWindow, open, close };
}
