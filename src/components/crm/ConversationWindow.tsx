"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ConversationMessage,
  EntryType,
  InboxEntryLabel,
  Label,
  MediaType,
  Stage,
} from "@/lib/conversations/types";
import type { FunnelStages } from "@/app/actions/stages";
import type { NextConversationStatus } from "@/lib/conversations/status-actions";
import type { WindowConversationState } from "@/lib/conversations/windowed-conversations";
import type { ConversationWindow as WindowGeometry } from "@/lib/conversations/window-deck";
import {
  MINIMIZED_WINDOW_HEIGHT,
  MINIMIZED_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
} from "@/lib/conversations/window-deck";

import { ArrowsInSimple, ArrowsOut, Minus, X } from "@/components/icons";
import { ChannelAvatar } from "@/components/channels/channel-avatar";
import AssignMemberPicker from "./AssignMemberPicker";
import ConversationWindowActions, {
  type ConversationWindowActionsTranslations,
} from "./ConversationWindowActions";
import CrmConversationView from "./CrmConversationView";
import CrmMessageInput from "./CrmMessageInput";
import CrmWallpaper from "./CrmWallpaper";
import type { SendButtonWsInput } from "@/hooks/use-conversation-ws";
import { cn } from "@/lib/utils";

/**
 * One conversation, in its own window.
 *
 * The same thread and composer the centre pane uses, so a windowed
 * conversation is not a reduced copy of the real one — it reads and sends
 * identically. What it deliberately leaves out is the chrome that only makes
 * sense once: the contact panel, message search and the ops drawer stay in the
 * centre pane rather than being duplicated four times across the screen.
 */

export interface ConversationWindowTranslations {
  conversation: React.ComponentProps<typeof CrmConversationView>["translations"];
  input: React.ComponentProps<typeof CrmMessageInput>["translations"];
  minimize: string;
  restore: string;
  maximize: string;
  close: string;
  dragHint: string;
  actions: ConversationWindowActionsTranslations;
}

/**
 * Everything a windowed conversation can be ACTED on with, as opposed to read.
 *
 * Passed in rather than reached for: the window is rendered by the deck, which
 * has no CRM context of its own, and a second source of truth for who may
 * assign or what stages exist is how two views of one conversation start
 * disagreeing.
 */
export interface ConversationWindowEntryContext {
  assignedUserId?: string | null;
  currentStages?: { stage_id: string; name: string; color: string }[];
  availableStages?: { stage_id: string; name: string; color: string }[];
  currentLabels?: InboxEntryLabel[];
}

export interface ConversationWindowActionsBundle {
  workspaceId?: string;
  onlineUserIds?: Set<string>;
  canAssign: boolean;
  canSetStatus: boolean;
  canToggleAutomation: boolean;
  canAssignStage: boolean;
  canAssignLabel: boolean;
  togglingAutomation?: boolean;
  stages?: Stage[];
  /**
   * Every conversation funnel with its stages, for the "move to another
   * funnel" dialog the thread renders. Absent it, the affordance is simply not
   * shown, which is how a window used to differ from the centre pane.
   */
  funnelStages?: FunnelStages[];
  labels?: Label[];
  /**
   * The parts that differ per conversation — who owns it, which stages and
   * labels it carries.
   *
   * A function rather than values, because one bundle serves every open
   * window: baking one conversation's owner into it would show the same
   * responsável on all four.
   */
  resolve: (
    entryId: string,
    entryType: EntryType,
  ) => ConversationWindowEntryContext;
  onAssign: (entryId: string, entryType: EntryType, userId: string) => void;
  onSetStatus: (
    entryId: string,
    entryType: EntryType,
    status: NextConversationStatus,
  ) => void;
  onToggleAutomation: (entryId: string, entryType: EntryType) => void;
  onEntryStageChange?: (
    entryId: string,
    entryType: EntryType,
    newStageId: string,
    oldStageId: string | null,
  ) => void;
  onAssignStage?: (
    stageId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  /**
   * Applies a funnel change. Resolves to an error message, or null on success.
   *
   * Same handler the centre pane gets, so a conversation offers the same
   * controls wherever it is opened. A window that quietly lacked the option was
   * read as a bug, not as a boundary.
   */
  onMoveToFunnel?: (
    entryId: string,
    entryType: EntryType,
    stageId: string,
  ) => Promise<string | null>;
  onAssignLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  onRemoveLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
}

interface ConversationWindowProps {
  geometry: WindowGeometry;
  /**
   * Where the dock parked this window, when it is minimized.
   *
   * The window keeps its own box while parked, so restoring it puts it back
   * exactly where the operator left it instead of wherever the dock had it.
   */
  dockedBox?: { x: number; y: number; width: number; height: number };
  state: WindowConversationState;
  translations: ConversationWindowTranslations;
  actions: ConversationWindowActionsBundle;
  canSend: boolean;
  noPermissionSend?: string;
  onFocus: () => void;
  onClose: () => void;
  onToggleMinimize: () => void;
  onToggleMaximize: () => void;
  onMove: (position: { x: number; y: number }) => void;
  onResize: (size: { width: number; height: number }) => void;
  onLoadHistory: () => void;
  onSend: (text: string, signed: boolean, replyToMessageId?: string) => void;
  onSendMedia: (
    text: string,
    mediaId: string,
    mediaType: MediaType,
    signed: boolean,
    replyToMessageId?: string,
  ) => void;
  onSendButton: (input: SendButtonWsInput, replyToMessageId?: string) => void;
  onTyping: (isTyping: boolean) => void;
}

/** Where the pointer grabbed the window, so a drag does not snap its corner. */
interface DragOrigin {
  pointerX: number;
  pointerY: number;
  windowX: number;
  windowY: number;
}

interface ResizeOrigin {
  pointerX: number;
  pointerY: number;
  width: number;
  height: number;
}

export default function ConversationWindow({
  geometry,
  dockedBox,
  state,
  translations: t,
  actions,
  canSend,
  noPermissionSend,
  onFocus,
  onClose,
  onToggleMinimize,
  onToggleMaximize,
  onMove,
  onResize,
  onLoadHistory,
  onSend,
  onSendMedia,
  onSendButton,
  onTyping,
}: ConversationWindowProps) {
  const [replyTo, setReplyTo] = useState<ConversationMessage | null>(null);
  const dragRef = useRef<DragOrigin | null>(null);
  const resizeRef = useRef<ResizeOrigin | null>(null);

  const { conversation } = state;
  // Who owns this conversation, and which stages/labels it carries.
  const entryContext = actions.resolve(
    conversation.entry_id,
    conversation.entry_type,
  );
  const title = conversation.lead_name || conversation.lead_number || "…";

  // A reply is answering THIS message in THIS thread; carrying it to whatever
  // the window shows next would quote the wrong conversation.
  useEffect(() => {
    setReplyTo(null);
  }, [conversation.entry_id, conversation.entry_type]);

  const handleDragPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Only a plain drag on the bar itself: the buttons in it must stay
      // clickable rather than becoming drag handles.
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      // A maximized window has no free position, and a parked one is placed by
      // the dock — dragging either would move a box nobody can see.
      if (geometry.maximized || geometry.minimized) return;

      dragRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        windowX: geometry.x,
        windowY: geometry.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      onFocus();
    },
    [geometry.maximized, geometry.minimized, geometry.x, geometry.y, onFocus],
  );

  const handleDragPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const origin = dragRef.current;
      if (!origin) return;
      onMove({
        x: origin.windowX + (e.clientX - origin.pointerX),
        y: origin.windowY + (e.clientY - origin.pointerY),
      });
    },
    [onMove],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLElement>) => {
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      resizeRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        width: geometry.width,
        height: geometry.height,
      };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      onFocus();
    },
    [geometry.height, geometry.width, onFocus],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const origin = resizeRef.current;
      if (!origin) return;
      onResize({
        width: Math.max(
          MIN_WINDOW_WIDTH,
          origin.width + (e.clientX - origin.pointerX),
        ),
        height: Math.max(
          MIN_WINDOW_HEIGHT,
          origin.height + (e.clientY - origin.pointerY),
        ),
      });
    },
    [onResize],
  );

  const endResize = useCallback((e: React.PointerEvent<HTMLElement>) => {
    resizeRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  const handleSend = useCallback(
    (text: string, signed: boolean) => {
      onSend(text, signed, replyTo?.id);
      setReplyTo(null);
    },
    [onSend, replyTo],
  );

  const handleSendMedia = useCallback(
    (text: string, mediaId: string, mediaType: MediaType, signed: boolean) => {
      onSendMedia(text, mediaId, mediaType, signed, replyTo?.id);
      setReplyTo(null);
    },
    [onSendMedia, replyTo],
  );

  const handleSendButton = useCallback(
    (input: SendButtonWsInput) => {
      onSendButton(input, replyTo?.id);
      setReplyTo(null);
    },
    [onSendButton, replyTo],
  );

  return (
    <section
      role="dialog"
      aria-label={title}
      data-conversation-window={`${conversation.entry_type}-${conversation.entry_id}`}
      onPointerDown={onFocus}
      className={cn(
        "pointer-events-auto fixed flex flex-col overflow-hidden rounded-[--radius] border border-border bg-card shadow-lg",
        // The deck is the only thing that positions these, so geometry comes
        // from style rather than from classes that would need a value per pixel.
      )}
      style={
        // Parked: the dock owns the position, and the box shrinks to the
        // title bar. Otherwise the window sits where it was placed or dragged.
        geometry.minimized && dockedBox
          ? {
              left: dockedBox.x,
              top: dockedBox.y,
              width: dockedBox.width,
              maxWidth: MINIMIZED_WINDOW_WIDTH,
              height: dockedBox.height,
              zIndex: geometry.z,
            }
          : {
              left: geometry.x,
              top: geometry.y,
              width: geometry.width,
              height: geometry.minimized
                ? MINIMIZED_WINDOW_HEIGHT
                : geometry.height,
              zIndex: geometry.z,
            }
      }
    >
      <header
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // Parked, the whole bar is the way back in — the way a chat dock
        // behaves. Only then, so a click on a real window's title bar does not
        // fold it away by accident.
        onClick={
          geometry.minimized
            ? (e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                onToggleMinimize();
              }
            : undefined
        }
        onDoubleClick={geometry.minimized ? undefined : onToggleMaximize}
        title={
          geometry.minimized
            ? t.restore
            : geometry.maximized
              ? undefined
              : t.dragHint
        }
        className={cn(
          "flex shrink-0 items-center gap-2 border-b border-border bg-card px-2.5",
          geometry.minimized
            // Parked, the bar IS the window, so the header fills it rather than
            // leaving a strip of empty card below the name.
            ? "h-full cursor-pointer border-b-0"
            : geometry.maximized
              ? "h-11 cursor-default"
              : "h-11 cursor-grab active:cursor-grabbing",
        )}
      >
        <ChannelAvatar
          name={title}
          pictureUrl={conversation.lead_picture}
          entryType={conversation.entry_type as EntryType}
          isGroup={conversation.is_group}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {title}
          </p>
          {/* The number is context for a conversation you are READING. Parked,
              the bar has one job — say who is waiting — and a second line of
              small grey text in 44px crowds out the name doing it. */}
          {!geometry.minimized &&
          conversation.lead_name &&
          conversation.lead_number ? (
            <p className="truncate text-2xs text-muted-foreground">
              {conversation.lead_number}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {/* What a set-aside conversation most needs to tell you. */}
          {geometry.minimized && conversation.unread_count > 0 && (
            <span className="mr-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-[--radius] bg-healthy px-1 text-2xs font-semibold text-healthy-foreground">
              {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
            </span>
          )}

          {/* Parked, the bar itself is the way back in, so it carries only the
              one control that is not "restore me": close. Three buttons in
              260px leaves the name nowhere to go. */}
          {!geometry.minimized && (
            <>
              {/* A windowed conversation has to be workable, not just
                  readable, so the actions the centre pane offers come with it.
                  Assigning keeps its own control — it is the one an operator
                  reaches for most, and it is already a 32px trigger. */}
              {actions.canAssign && actions.workspaceId && (
                <AssignMemberPicker
                  workspaceId={actions.workspaceId}
                  assignedUserId={entryContext.assignedUserId ?? null}
                  onlineUserIds={actions.onlineUserIds}
                  onAssign={(userId) =>
                    actions.onAssign(
                      conversation.entry_id,
                      conversation.entry_type,
                      userId,
                    )
                  }
                />
              )}

              <ConversationWindowActions
                conversationStatus={conversation.conversation_status}
                automationEnabled={conversation.automation_enabled}
                canSetStatus={actions.canSetStatus}
                canToggleAutomation={actions.canToggleAutomation}
                togglingAutomation={actions.togglingAutomation}
                translations={t.actions}
                onSetStatus={(status) =>
                  actions.onSetStatus(
                    conversation.entry_id,
                    conversation.entry_type,
                    status,
                  )
                }
                onToggleAutomation={() =>
                  actions.onToggleAutomation(
                    conversation.entry_id,
                    conversation.entry_type,
                  )
                }
              />

              <WindowButton label={t.minimize} onClick={onToggleMinimize}>
                <Minus size={14} weight="bold" />
              </WindowButton>
              <WindowButton
                label={geometry.maximized ? t.restore : t.maximize}
                onClick={onToggleMaximize}
              >
                {geometry.maximized ? (
                  <ArrowsInSimple size={14} weight="bold" />
                ) : (
                  <ArrowsOut size={14} weight="bold" />
                )}
              </WindowButton>
            </>
          )}
          <WindowButton label={t.close} onClick={onClose} danger>
            <X size={14} weight="bold" />
          </WindowButton>
        </div>
      </header>

      {/* A minimized window keeps its subscription and its transcript; only the
          body is hidden, so restoring it is instant and nothing was missed. */}
      {!geometry.minimized && (
        <>
          <div className="relative isolate flex min-h-0 flex-1 flex-col">
            <CrmWallpaper />
            <div className="min-h-0 flex-1">
              <CrmConversationView
                conversation={conversation}
                isTyping={state.typingUserIds.length > 0}
                onLoadMore={onLoadHistory}
                loadingHistory={state.loadingHistory}
                loadingConversation={state.loadingConversation}
                translations={t.conversation}
                onReply={setReplyTo}
                // Stage and label are rendered by the thread itself, the same
                // way the centre pane gets them — reusing that rather than
                // building a second, slightly different set of controls.
                tags={actions.stages}
                currentEntryTags={entryContext.currentStages}
                entryAvailableTags={entryContext.availableStages}
                funnelStages={actions.funnelStages}
                onMoveToFunnel={
                  actions.canAssignStage ? actions.onMoveToFunnel : undefined
                }
                onEntryStageChange={
                  actions.canAssignStage ? actions.onEntryStageChange : undefined
                }
                onAssignStage={
                  actions.canAssignStage ? actions.onAssignStage : undefined
                }
                availableLabels={actions.labels}
                currentEntryLabels={entryContext.currentLabels}
                onAssignLabel={
                  actions.canAssignLabel ? actions.onAssignLabel : undefined
                }
                onRemoveLabel={
                  actions.canAssignLabel ? actions.onRemoveLabel : undefined
                }
              />
            </div>
          </div>

          <CrmMessageInput
            entryType={conversation.entry_type as EntryType}
            entryId={conversation.entry_id}
            onSend={handleSend}
            onSendMedia={handleSendMedia}
            onSendButton={handleSendButton}
            onTyping={onTyping}
            windowOpen={conversation.window_open}
            windowExpiresAt={conversation.window_expires_at}
            windowClosedReason={conversation.window_closed_reason}
            translations={t.input}
            replyToMessage={replyTo}
            onClearReply={() => setReplyTo(null)}
            disabled={!canSend}
            disabledReason={canSend ? undefined : noPermissionSend}
          />

          {!geometry.maximized && (
            <div
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              aria-hidden
              className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
            />
          )}
        </>
      )}
    </section>
  );
}

function WindowButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors",
        danger
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
