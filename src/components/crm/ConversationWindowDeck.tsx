"use client";

import { useEffect, useState } from "react";

import type { EntryType, MediaType } from "@/lib/conversations/types";
import type { WindowConversations } from "@/lib/conversations/windowed-conversations";
import {
  type Viewport,
  type WindowDeck,
  clampDeckToViewport,
  closeWindow,
  dockHeight,
  dockedBoxes,
  emptyDeck,
  focusWindow,
  moveWindow,
  openWindow,
  resizeWindow,
  setMinimized,
  toggleMaximized,
} from "@/lib/conversations/window-deck";

import ConversationWindow, {
  type ConversationWindowActionsBundle,
  type ConversationWindowTranslations,
} from "./ConversationWindow";
import type { SendButtonWsInput } from "@/hooks/use-conversation-ws";


interface ConversationWindowDeckProps {
  conversations: WindowConversations;
  focusRequest: { key: string; nonce: number } | null;
  translations: ConversationWindowTranslations;
  actions: ConversationWindowActionsBundle;
  canSend: boolean;
  noPermissionSend?: string;
  onClose: (entryId: string, entryType: EntryType) => void;
  onLoadHistory: (entryId: string, entryType: EntryType) => void;
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
  onSend,
  onSendMedia,
  onSendButton,
  onTyping,
  onVisibilityChange,
  onDockHeightChange,
}: ConversationWindowDeckProps) {
  const [deck, setDeck] = useState<WindowDeck>(emptyDeck);
  const [viewport, setViewport] = useState<Viewport>(currentViewport);

  useEffect(() => {
    setDeck((prev) => {
      let next = prev;
      const area = layoutAreaFor(prev, currentViewport());

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
    if (!focusRequest) return;
    setDeck((prev) =>
      setMinimized(focusWindow(prev, focusRequest.key), focusRequest.key, false),
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
    const onResize = () => setViewport(currentViewport());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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

  if (deck.windows.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {deck.windows.map((geometry) => {
        const state = conversations.get(geometry.key);
        if (!state) return null;

        const { entry_id: entryId, entry_type: entryType } = state.conversation;
        const docked = parked.get(geometry.key);

        return (
          <ConversationWindow
            key={geometry.key}
            geometry={geometry}
            dockedBox={docked}
            state={state}
            translations={translations}
            actions={actions}
            canSend={canSend}
            noPermissionSend={noPermissionSend}
            onFocus={() => setDeck((prev) => focusWindow(prev, geometry.key))}
            onClose={() => onClose(entryId, entryType)}
            onToggleMinimize={() => {
              const nextMinimized = !geometry.minimized;
              setDeck((prev) =>
                setMinimized(prev, geometry.key, nextMinimized),
              );
              onVisibilityChange(entryId, entryType, !nextMinimized);
            }}
            onToggleMaximize={() =>
              setDeck((prev) =>
                toggleMaximized(prev, geometry.key, layoutViewport),
              )
            }
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
      })}
    </div>
  );
}
