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

/**
 * The floating conversations, and where they sit.
 *
 * One direction only: the socket hook owns WHICH conversations are open, this
 * component owns WHERE their boxes are. Geometry is derived from
 * `conversations` — a key that appears gets a window, a key that disappears
 * loses one — so there is no second list to fall out of step with the first.
 *
 * Geometry is window-deck's business and transcripts are
 * windowed-conversations'; keeping them apart is what lets a drag re-render
 * without touching a thread, and lets both be tested without a browser.
 *
 * Renders nothing when no window is open, so it costs nothing to an operator
 * who never opens one.
 */

interface ConversationWindowDeckProps {
  conversations: WindowConversations;
  /**
   * Bumped whenever a conversation is opened — including one already open, so
   * picking it again brings its window forward instead of doing nothing.
   */
  focusRequest: { key: string; nonce: number } | null;
  translations: ConversationWindowTranslations;
  /** The CRM actions a windowed conversation can be worked with. */
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
  /**
   * Parked or restored. Reaches the socket because it decides whether
   * arriving messages are receipted as read or counted as unread.
   */
  onVisibilityChange: (
    entryId: string,
    entryType: EntryType,
    visible: boolean,
  ) => void;
  /**
   * How much room the page must leave at its bottom edge for the parked
   * conversations, so the dock never covers the centre pane's composer.
   */
  onDockHeightChange?: (height: number) => void;
}

function currentViewport(): Viewport {
  if (typeof window === "undefined") return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * The floor on the space left for real windows once the dock has taken its
 * strip. Only reachable on a viewport too short to hold both, where a readable
 * window matters more than a dock that never overlaps.
 */
const MIN_LAYOUT_HEIGHT = 360;

/**
 * The space open windows may occupy: the viewport, less the strip the parked
 * conversations hold.
 *
 * Without it a window reaches the bottom edge and sits ON TOP of the dock —
 * including the one it was just restored from.
 */
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

  // Geometry follows the open conversations, in both directions.
  useEffect(() => {
    setDeck((prev) => {
      let next = prev;
      // Read off `prev` rather than the render's own value: this runs inside
      // the updater, where the deck may already have moved on.
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
    // Picking the conversation again un-parks it, which is the operator
    // looking at it — the same thing as clicking its bar in the dock.
    const restored = conversations.get(focusRequest.key);
    if (restored) {
      onVisibilityChange(
        restored.conversation.entry_id,
        restored.conversation.entry_type,
        true,
      );
    }
    // Only when a NEW request arrives; `conversations` changes constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewport(currentViewport());
    // Also once on mount: the first render happens before the browser has a
    // size to report, so without this the deck lays everything out against the
    // server-side fallback and only corrects itself if someone resizes.
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const parked = dockedBoxes(deck, viewport);
  const room = dockHeight(deck);

  const layoutViewport = layoutAreaFor(deck, viewport);

  // Parking or restoring changes how much room there is, and so does resizing
  // the browser, so the open windows are pulled back into whatever is left.
  const { width: areaWidth, height: areaHeight } = layoutViewport;
  useEffect(() => {
    setDeck((prev) =>
      clampDeckToViewport(prev, { width: areaWidth, height: areaHeight }),
    );
  }, [areaWidth, areaHeight]);

  useEffect(() => {
    onDockHeightChange?.(room);
  }, [onDockHeightChange, room]);

  // The page must stop reserving room for a dock that is no longer there.
  useEffect(() => () => onDockHeightChange?.(0), [onDockHeightChange]);

  if (deck.windows.length === 0) return null;

  return (
    // A layer, not a blocker: pointer events belong to the windows themselves,
    // so the inbox underneath stays clickable between them.
    <div className="pointer-events-none fixed inset-0 z-40">
      {deck.windows.map((geometry) => {
        const state = conversations.get(geometry.key);
        if (!state) return null;

        const { entry_id: entryId, entry_type: entryType } = state.conversation;
        // A parked conversation is laid out by the dock, not by its own box —
        // which it keeps, so restoring returns it exactly where it was.
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
              // Parking a window stops it reading; restoring resumes it and
              // sends the receipts held back while it sat in the dock.
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
