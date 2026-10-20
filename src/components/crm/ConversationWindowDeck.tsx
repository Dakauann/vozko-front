"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { WindowPortal } from "@/components/ui/window-portal";
import { useDocumentPictureInPicture } from "@/hooks/use-document-picture-in-picture";
import type { EntryType, MediaType } from "@/lib/conversations/types";
import type { PictureInPictureSize } from "@/lib/picture-in-picture";
import type { WindowConversations } from "@/lib/conversations/windowed-conversations";
import {
  type ConversationWindow as WindowGeometry,
  type Viewport,
  type WindowDeck,
  clampDeckToViewport,
  closeWindow,
  defaultWindowSize,
  dockHeight,
  dockedBoxes,
  emptyDeck,
  focusWindow,
  moveWindow,
  openWindow,
  popOutWindow,
  poppedOutWindow,
  resizeWindow,
  returnToPage,
  setMinimized,
  toggleMaximized,
} from "@/lib/conversations/window-deck";

import ConversationWindow, {
  type ConversationWindowActionsBundle,
  type ConversationWindowTranslations,
} from "./ConversationWindow";
import type { SendButtonWsInput } from "@/hooks/use-conversation-ws";
import type { HistoryAnchor } from "@/lib/conversations/history-anchor";
import type { Outbox } from "@/lib/conversations/outbox";

export interface WindowThreadSearch {
  search: (entryId: string, entryType: EntryType, query: string) => void;
  clear: (entryId: string, entryType: EntryType) => void;
  loadAround: (entryId: string, entryType: EntryType, anchor: HistoryAnchor) => void;
}

export interface WindowThreadTransport {
  outbox: Outbox;
  loadNewer: (entryId: string, entryType: EntryType) => void;
  returnToPresent: (entryId: string, entryType: EntryType) => void;
  retrySend: (requestId: string) => void;
  resend: (entryId: string, entryType: EntryType, messageId: string) => void;
}

interface ConversationWindowDeckProps {
  conversations: WindowConversations;
  focusRequest: { key: string; nonce: number } | null;
  translations: ConversationWindowTranslations;
  actions: ConversationWindowActionsBundle;
  canSend: boolean;
  noPermissionSend?: string;
  onClose: (entryId: string, entryType: EntryType) => void;
  onLoadHistory: (entryId: string, entryType: EntryType) => void;
  threadSearch?: WindowThreadSearch;
  transport?: WindowThreadTransport;
  onSend: (
    entryId: string,
    entryType: EntryType,
    text: string,
    signed: boolean,
    replyToMessageId?: string,
  ) => void;
  onSendMedia: (
    entryId: string,
    entryType: EntryType,
    text: string,
    mediaId: string,
    mediaType: MediaType,
    signed: boolean,
    replyToMessageId?: string,
  ) => void;
  onSendButton: (
    entryId: string,
    entryType: EntryType,
    input: SendButtonWsInput,
    replyToMessageId?: string,
  ) => void;
  onTyping: (entryId: string, entryType: EntryType, isTyping: boolean) => void;
  onVisibilityChange: (
    entryId: string,
    entryType: EntryType,
    visible: boolean,
  ) => void;
  onDockHeightChange?: (height: number) => void;
}

function currentViewport(): Viewport {
  if (typeof window === "undefined") return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function areaOf(element: HTMLElement | null): Viewport {
  if (!element) return currentViewport();
  const { width, height } = element.getBoundingClientRect();
  return width > 0 && height > 0 ? { width, height } : currentViewport();
}

const MIN_LAYOUT_HEIGHT = 360;

function layoutAreaFor(deck: WindowDeck, viewport: Viewport): Viewport {
  return {
    width: viewport.width,
    height: Math.max(viewport.height - dockHeight(deck), MIN_LAYOUT_HEIGHT),
  };
}

export default function ConversationWindowDeck({
  conversations,
  focusRequest,
  translations,
  actions,
  canSend,
  noPermissionSend,
  onClose,
  onLoadHistory,
  threadSearch,
  transport,
  onSend,
  onSendMedia,
  onSendButton,
  onTyping,
  onVisibilityChange,
  onDockHeightChange,
}: ConversationWindowDeckProps) {
  const [deck, setDeck] = useState<WindowDeck>(emptyDeck);
  const [viewport, setViewport] = useState<Viewport>(currentViewport);
  const pictureInPicture = useDocumentPictureInPicture(
    useCallback(() => setDeck(returnToPage), []),
  );
  const {
    supported: pictureInPictureSupported,
    open: openPictureInPicture,
    close: closePictureInPicture,
  } = pictureInPicture;
  const knownKeysRef = useRef<Set<string>>(new Set());
  const areaRef = useRef<HTMLDivElement>(null);

  const popOut = useCallback(
    (key: string, size: PictureInPictureSize) =>
      openPictureInPicture(size, () =>
        setDeck((prev) => popOutWindow(prev, key)),
      ),
    [openPictureInPicture],
  );

  useEffect(() => {
    setDeck((prev) => {
      let next = prev;
      const area = layoutAreaFor(prev, areaOf(areaRef.current));

      for (const [key, state] of conversations) {
        if (next.windows.some((w) => w.key === key)) continue;
        next = openWindow(
          next,
          {
            entryId: state.conversation.entry_id,
            entryType: state.conversation.entry_type,
            leadName:
              state.conversation.lead_name || state.conversation.lead_number,
          },
          area,
        );
      }

      for (const w of next.windows) {
        if (!conversations.has(w.key)) next = closeWindow(next, w.key);
      }

      return next;
    });
  }, [conversations]);

  useEffect(() => {
    const newest = [...conversations.keys()]
      .filter((key) => !knownKeysRef.current.has(key))
      .at(-1);
    knownKeysRef.current = new Set(conversations.keys());
    if (newest && pictureInPictureSupported) {
      void popOut(newest, defaultWindowSize(currentViewport()));
    }
  }, [conversations, pictureInPictureSupported, popOut]);

  useEffect(() => {
    if (!focusRequest) return;
    setDeck((prev) =>
      setMinimized(
        focusWindow(prev, focusRequest.key),
        focusRequest.key,
        false,
      ),
    );
    const restored = conversations.get(focusRequest.key);
    if (restored) {
      onVisibilityChange(
        restored.conversation.entry_id,
        restored.conversation.entry_type,
        true,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewport(areaOf(areaRef.current));
    onResize();
    window.addEventListener("resize", onResize);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResize);
    if (areaRef.current) observer?.observe(areaRef.current);
    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, []);

  const parked = dockedBoxes(deck, viewport);
  const room = dockHeight(deck);

  const layoutViewport = layoutAreaFor(deck, viewport);

  const { width: areaWidth, height: areaHeight } = layoutViewport;
  useEffect(() => {
    setDeck((prev) =>
      clampDeckToViewport(prev, { width: areaWidth, height: areaHeight }),
    );
  }, [areaWidth, areaHeight]);

  useEffect(() => {
    onDockHeightChange?.(room);
  }, [onDockHeightChange, room]);

  useEffect(() => () => onDockHeightChange?.(0), [onDockHeightChange]);

  const popped = poppedOutWindow(deck);
  const poppedKey = popped?.key ?? null;
  useEffect(() => {
    if (poppedKey === null) closePictureInPicture();
  }, [poppedKey, closePictureInPicture]);

  const hostWindow = pictureInPicture.pictureWindow;
  const hostedKey = popped && hostWindow ? popped.key : null;

  const togglePopOutFor = (geometry: WindowGeometry) => {
    if (geometry.key === hostedKey) return closePictureInPicture;
    if (!pictureInPictureSupported) return undefined;
    return () =>
      void popOut(geometry.key, {
        width: geometry.width,
        height: geometry.height,
      });
  };

  const renderWindow = (geometry: WindowGeometry) => {
    const state = conversations.get(geometry.key);
    if (!state) return null;

    const { entry_id: entryId, entry_type: entryType } = state.conversation;
    const docked = parked.get(geometry.key);

    return (
      <ConversationWindow
        key={geometry.key}
        geometry={geometry}
        dockedBox={docked}
        poppedOut={geometry.key === hostedKey}
        state={state}
        translations={translations}
        actions={actions}
        canSend={canSend}
        noPermissionSend={noPermissionSend}
        onFocus={() => setDeck((prev) => focusWindow(prev, geometry.key))}
        onClose={() => onClose(entryId, entryType)}
        onToggleMinimize={() => {
          const nextMinimized = !geometry.minimized;
          setDeck((prev) => setMinimized(prev, geometry.key, nextMinimized));
          onVisibilityChange(entryId, entryType, !nextMinimized);
        }}
        onToggleMaximize={() =>
          setDeck((prev) => toggleMaximized(prev, geometry.key, layoutViewport))
        }
        onTogglePopOut={togglePopOutFor(geometry)}
        onMove={(position) =>
          setDeck((prev) =>
            moveWindow(prev, geometry.key, position, layoutViewport),
          )
        }
        onResize={(size) =>
          setDeck((prev) =>
            resizeWindow(prev, geometry.key, size, layoutViewport),
          )
        }
        onLoadHistory={() => onLoadHistory(entryId, entryType)}
        onSearchMessages={threadSearch ? (query) => threadSearch.search(entryId, entryType, query) : undefined}
        onClearMessageSearch={threadSearch ? () => threadSearch.clear(entryId, entryType) : undefined}
        onLoadAround={threadSearch ? (anchor) => threadSearch.loadAround(entryId, entryType, anchor) : undefined}
        onLoadNewer={transport ? () => transport.loadNewer(entryId, entryType) : undefined}
        onReturnToPresent={transport ? () => transport.returnToPresent(entryId, entryType) : undefined}
        outbox={transport?.outbox}
        onRetrySend={transport?.retrySend}
        onResendMessage={transport ? (messageId) => transport.resend(entryId, entryType, messageId) : undefined}
        onSend={(text, signed, replyToMessageId) =>
          onSend(entryId, entryType, text, signed, replyToMessageId)
        }
        onSendMedia={(text, mediaId, mediaType, signed, replyToMessageId) =>
          onSendMedia(
            entryId,
            entryType,
            text,
            mediaId,
            mediaType,
            signed,
            replyToMessageId,
          )
        }
        onSendButton={(input, replyToMessageId) =>
          onSendButton(entryId, entryType, input, replyToMessageId)
        }
        onTyping={(isTyping) => onTyping(entryId, entryType, isTyping)}
      />
    );
  };

  return (
    <>
      <div ref={areaRef} className="pointer-events-none fixed inset-y-0 left-0 right-[var(--dock-float-reserve)] z-40">
        {deck.windows
          .filter((geometry) => geometry.key !== hostedKey)
          .map(renderWindow)}
      </div>
      {popped && hostWindow && (
        <WindowPortal target={hostWindow} title={popped.leadName}>
          {renderWindow(popped)}
        </WindowPortal>
      )}
    </>
  );
}
