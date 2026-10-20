"use client";

import { useCallback, useRef, useState } from "react";

import type {
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
  windowKey,
} from "@/lib/conversations/window-deck";
import { useEntryReply } from "@/hooks/use-entry-reply";

import {
  ArrowsInSimple,
  ArrowsOut,
  Minus,
  PictureInPicture,
  PictureInPictureExit,
  X,
} from "@/components/icons";
import { ChannelAvatar } from "@/components/channels/channel-avatar";
import AssignMemberPicker from "./AssignMemberPicker";
import type { HandBackTarget } from "@/lib/conversations/hand-back";
import ConversationWindowActions, {
  type ConversationWindowActionsTranslations,
} from "./ConversationWindowActions";
import CrmConversationView from "./CrmConversationView";
import { ConversationViewers } from "./ConversationViewers";
import CrmMessageInput, { type ComposerControl } from "./CrmMessageInput";
import { ConversationDropZone } from "./ConversationDropZone";
import SendTemplateNowDialog from "./SendTemplateNowDialog";
import SendFormDialog from "./SendFormDialog";
import { useWorkspace } from "@/contexts/workspace-context";
import { reopensWithTemplate } from "@/lib/conversations/window-reopen";
import CrmWallpaper from "./CrmWallpaper";
import type { SendButtonWsInput } from "@/hooks/use-conversation-ws";
import type { HistoryAnchor } from "@/lib/conversations/history-anchor";
import type { Outbox } from "@/lib/conversations/outbox";
import { cn } from "@/lib/utils";
import type { LiveRead } from "@/lib/live-decisions/types";

export interface ConversationWindowTranslations {
  conversation: React.ComponentProps<
    typeof CrmConversationView
  >["translations"];
  input: React.ComponentProps<typeof CrmMessageInput>["translations"];
  minimize: string;
  restore: string;
  maximize: string;
  close: string;
  dragHint: string;
  popOut: string;
  returnToPage: string;
  actions: ConversationWindowActionsTranslations;
}

export interface ConversationWindowEntryContext {
  assignedUserId?: string | null;
  currentStages?: { stage_id: string; name: string; color: string }[];
  availableStages?: { stage_id: string; name: string; color: string }[];
  currentLabels?: InboxEntryLabel[];
  handBack?: HandBackTarget | null;
  liveRead?: LiveRead | null;
  businessPhoneId?: string;
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
  funnelStages?: FunnelStages[];
  labels?: Label[];
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
  onSendAndFinish?: (entryId: string, entryType: EntryType) => void;
  onReopenWindow?: (entryId: string, entryType: EntryType, templateId: string, parameters: string[]) => void;
  onHandBack?: (entryId: string, entryType: EntryType) => void;
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
  dockedBox?: { x: number; y: number; width: number; height: number };
  poppedOut?: boolean;
  state: WindowConversationState;
  translations: ConversationWindowTranslations;
  actions: ConversationWindowActionsBundle;
  canSend: boolean;
  noPermissionSend?: string;
  onFocus: () => void;
  onClose: () => void;
  onToggleMinimize: () => void;
  onToggleMaximize: () => void;
  onTogglePopOut?: () => void;
  onMove: (position: { x: number; y: number }) => void;
  onResize: (size: { width: number; height: number }) => void;
  onLoadHistory: () => void;
  onSearchMessages?: (query: string) => void;
  onClearMessageSearch?: () => void;
  onLoadAround?: (anchor: HistoryAnchor) => void;
  onLoadNewer?: () => void;
  onReturnToPresent?: () => void;
  outbox?: Outbox;
  onRetrySend?: (requestId: string) => void;
  onResendMessage?: (messageId: string) => void;
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
  poppedOut = false,
  state,
  translations: t,
  actions,
  canSend,
  noPermissionSend,
  onFocus,
  onClose,
  onToggleMinimize,
  onToggleMaximize,
  onTogglePopOut,
  onMove,
  onResize,
  onLoadHistory,
  onSearchMessages,
  onClearMessageSearch,
  onLoadAround,
  onLoadNewer,
  onReturnToPresent,
  outbox,
  onRetrySend,
  onResendMessage,
  onSend,
  onSendMedia,
  onSendButton,
  onTyping,
}: ConversationWindowProps) {
  const dragRef = useRef<DragOrigin | null>(null);
  const resizeRef = useRef<ResizeOrigin | null>(null);

  const { conversation } = state;
  const entryContext = actions.resolve(
    conversation.entry_id,
    conversation.entry_type,
  );
  const title = conversation.lead_name || conversation.lead_number || "…";
  const pinned = geometry.maximized || poppedOut;
  const { replyTo, reply, clearReply } = useEntryReply(
    windowKey(conversation.entry_id, conversation.entry_type),
  );

  const handleDragPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      if (pinned || geometry.minimized) return;

      dragRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        windowX: geometry.x,
        windowY: geometry.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      onFocus();
    },
    [pinned, geometry.minimized, geometry.x, geometry.y, onFocus],
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

  const composerControlRef = useRef<ComposerControl>(null);
  const attachDroppedFiles = useCallback((files: File[]) => composerControlRef.current?.attachFiles(files), []);
  const composerAcceptsInput = conversation.window_open && canSend;
  const finishes = canSend && conversation.conversation_status !== "finished" && Boolean(actions.onSendAndFinish);
  const sendAndFinish = useCallback(
    () => actions.onSendAndFinish?.(conversation.entry_id, conversation.entry_type),
    [actions, conversation.entry_id, conversation.entry_type],
  );
  const [templateNowOpen, setTemplateNowOpen] = useState(false);
  const sendsTemplateNow = Boolean(actions.onReopenWindow) && reopensWithTemplate(conversation.entry_type);
  const { can } = useWorkspace();
  const [formSendOpen, setFormSendOpen] = useState(false);
  const sendsForm = conversation.entry_type === "whatsapp" && can("whatsapp_forms", "send");

  return (
    <section
      role="dialog"
      aria-label={title}
      data-conversation-window={`${conversation.entry_type}-${conversation.entry_id}`}
      onPointerDown={onFocus}
      className={cn(
        "pointer-events-auto fixed flex flex-col overflow-hidden bg-card",
        poppedOut
          ? "inset-0"
          : "rounded-[--radius] border border-border shadow-lg",
      )}
      style={poppedOut ? undefined : boxStyle(geometry, dockedBox)}
    >
      <header
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={
          geometry.minimized
            ? (e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                onToggleMinimize();
              }
            : undefined
        }
        onDoubleClick={
          geometry.minimized || poppedOut ? undefined : onToggleMaximize
        }
        title={geometry.minimized ? t.restore : pinned ? undefined : t.dragHint}
        className={cn(
          "flex shrink-0 items-center gap-2 border-b border-border bg-card px-2.5",
          geometry.minimized
            ? "h-full cursor-pointer border-b-0"
            : pinned
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
          {}
          {!geometry.minimized &&
          conversation.lead_name &&
          conversation.lead_number ? (
            <p className="truncate text-2xs text-muted-foreground">
              {conversation.lead_number}
            </p>
          ) : null}
        </div>

        {!geometry.minimized ? (
          <ConversationViewers entryId={conversation.entry_id} entryType={conversation.entry_type as EntryType} />
        ) : null}

        <div className="flex shrink-0 items-center gap-0.5">
          {}
          {geometry.minimized && conversation.unread_count > 0 && (
            <span className="mr-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-[--radius] bg-healthy px-1 text-2xs font-semibold text-healthy-foreground">
              {conversation.unread_count > 99
                ? "99+"
                : conversation.unread_count}
            </span>
          )}

          {}
          {!geometry.minimized && (
            <>
              {}
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
                  handBack={entryContext.handBack ?? null}
                  onHandBack={
                    actions.onHandBack
                      ? () =>
                          actions.onHandBack?.(
                            conversation.entry_id,
                            conversation.entry_type,
                          )
                      : undefined
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

              {onTogglePopOut && (
                <WindowButton
                  label={poppedOut ? t.returnToPage : t.popOut}
                  onClick={onTogglePopOut}
                >
                  {poppedOut ? (
                    <PictureInPictureExit size={14} weight="bold" />
                  ) : (
                    <PictureInPicture size={14} weight="bold" />
                  )}
                </WindowButton>
              )}

              {!poppedOut && (
                <>
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
            </>
          )}
          <WindowButton label={t.close} onClick={onClose} danger>
            <X size={14} weight="bold" />
          </WindowButton>
        </div>
      </header>

      {}
      {!geometry.minimized && (
        <>
          <ConversationDropZone enabled={composerAcceptsInput} onFiles={attachDroppedFiles} className="flex min-h-0 flex-1 flex-col">
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
                onSearchMessages={onSearchMessages}
                onClearMessageSearch={onClearMessageSearch}
                messageSearchResults={state.search?.results ?? null}
                searchingMessages={state.search?.searching ?? false}
                messageSearchTotalItems={state.search?.totalItems ?? 0}
                messageSearchQuery={state.search?.query ?? null}
                onLoadAround={onLoadAround}
                onLoadNewer={onLoadNewer}
                onReturnToPresent={onReturnToPresent}
                outbox={outbox}
                onRetrySend={onRetrySend}
                onResendMessage={onResendMessage}
                onReply={reply}
                tags={actions.stages}
                currentEntryTags={entryContext.currentStages}
                entryAvailableTags={entryContext.availableStages}
                liveRead={entryContext.liveRead}
                funnelStages={actions.funnelStages}
                onMoveToFunnel={
                  actions.canAssignStage ? actions.onMoveToFunnel : undefined
                }
                onEntryStageChange={
                  actions.canAssignStage
                    ? actions.onEntryStageChange
                    : undefined
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
            onSend={onSend}
            onSendMedia={onSendMedia}
            onSendButton={onSendButton}
            onSendAndFinish={finishes ? sendAndFinish : undefined}
            onSendTemplateNow={sendsTemplateNow ? () => setTemplateNowOpen(true) : undefined}
            onSendForm={sendsForm ? () => setFormSendOpen(true) : undefined}
            onTyping={onTyping}
            windowOpen={conversation.window_open}
            windowExpiresAt={conversation.window_expires_at}
            windowClosedReason={conversation.window_closed_reason}
            windowClosedDetail={conversation.window_closed_detail}
            windowTier={conversation.window_tier}
            translations={t.input}
            replyToMessage={replyTo}
            onClearReply={clearReply}
            controlRef={composerControlRef}
            disabled={!canSend}
            disabledReason={canSend ? undefined : noPermissionSend}
          />
          </ConversationDropZone>

          {templateNowOpen && actions.onReopenWindow && (
            <SendTemplateNowDialog
              open
              onOpenChange={(open) => {
                if (!open) setTemplateNowOpen(false);
              }}
              businessPhoneId={entryContext.businessPhoneId ?? ""}
              recipientName={conversation.lead_name}
              onSend={(templateId, parameters) =>
                actions.onReopenWindow?.(conversation.entry_id, conversation.entry_type, templateId, parameters)
              }
            />
          )}

          {formSendOpen && sendsForm && (
            <SendFormDialog
              open
              onOpenChange={(open) => {
                if (!open) setFormSendOpen(false);
              }}
              entryId={conversation.entry_id}
              businessPhoneId={entryContext.businessPhoneId ?? ""}
              recipientName={conversation.lead_name}
              onUseTemplate={sendsTemplateNow ? () => setTemplateNowOpen(true) : undefined}
            />
          )}

          {!pinned && (
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

function boxStyle(
  geometry: WindowGeometry,
  dockedBox: ConversationWindowProps["dockedBox"],
): React.CSSProperties {
  if (geometry.minimized && dockedBox) {
    return {
      left: dockedBox.x,
      top: dockedBox.y,
      width: dockedBox.width,
      maxWidth: MINIMIZED_WINDOW_WIDTH,
      height: dockedBox.height,
      zIndex: geometry.z,
    };
  }
  return {
    left: geometry.x,
    top: geometry.y,
    width: geometry.width,
    height: geometry.minimized ? MINIMIZED_WINDOW_HEIGHT : geometry.height,
    zIndex: geometry.z,
  };
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
