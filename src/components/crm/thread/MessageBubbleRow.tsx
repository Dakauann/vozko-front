"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRef, useState, type KeyboardEvent, type MouseEvent, type RefObject } from "react";

import { ArrowBendUpLeft, DotsThree, WhatsappLogo } from "@/components/icons";
import { ChannelAvatar } from "@/components/channels/channel-avatar";
import { LocationMessageCard } from "@/components/crm/LocationMessageCard";
import { EmailMessageBody } from "@/components/email/EmailMessageBody";
import {
  PostbackChip,
  ReferralChip,
  SentViaBadge,
  SharedLinkCard,
  StickerPlaceholder,
} from "@/components/crm/MetaMessageParts";
import TemplateBubble from "@/components/crm/TemplateBubble";
import { MercadoLivreMessageMarks } from "@/components/mercadolivre/mercadolivre-message-marks";
import { RcsThreadCards, RcsThreadSuggestions } from "@/components/rcs/preview/RcsThreadContent";
import { SmsSegmentsBadge } from "@/components/sms/SmsSegmentsBadge";
import { readRcsTranscript, readSmsTranscript } from "@/lib/carrier-messaging/transcript";
import { emailCampaignName } from "@/lib/email/campaign";
import { bubbleSide, directionOfRow, showsDeliveryTicks } from "@/lib/conversations/bubble-side";
import { messageTypeOf, senderBadge } from "@/lib/conversations/direction";
import { hasTemplateMetadata, readFormBlock } from "@/lib/conversations/form-metadata";
import { readInteractiveMessage } from "@/lib/conversations/interactive-message";
import {
  metaPrefix,
  readLinkShare,
  readPostShare,
  readPostback,
  readReferral,
  readSentVia,
} from "@/lib/conversations/meta-metadata";
import { messageMenuItems } from "@/lib/conversations/message-menu";
import { senderLabelKey } from "@/lib/conversations/sender-label";
import { mediaLabelKey } from "@/lib/conversations/thread-labels";
import { joinedEdges, opensGroup, type ThreadRow } from "@/lib/conversations/thread-rows";
import type { ConversationMessage, TemplateMessageMetadata } from "@/lib/conversations/types";
import { arrivalTransition } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { bubbleCorners } from "./bubble-corners";

import { MessageMedia } from "../message-media";
import { CollapsibleMessageText, MessageTimestamp, ReadReceipt } from "./message-parts";
import { AudioTranscript, EditedMark, RetractedNotice } from "./message-states";
import { FormMessageCard, FormResponseCard } from "./FormCards";
import { InteractiveMessageCard } from "./InteractiveMessageCard";
import { MessageActionsMenu, type MenuAnchor } from "./MessageActionsMenu";
import { MessageEditor } from "./MessageEditor";
import { ReactionChips } from "./ReactionChips";
import { PendingSendMark, SendFailure } from "./SendStatus";
import { useThreadRow } from "./thread-context";

type MessageRow = Extract<ThreadRow, { kind: "message" }>;

const MENU_WIDTH_PX = 224;

const REPLY_BUTTON =
  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-border/80 hover:text-muted-foreground";

function ReplyButton({ message }: { message: ConversationMessage }) {
  const t = useTranslations("crmConversation.thread");
  const { onReply } = useThreadRow();
  if (!onReply || message.local_send || message.retracted_at) return null;
  return (
    <button type="button" onClick={() => onReply(message)} className={REPLY_BUTTON} aria-label={t("reply")}>
      <ArrowBendUpLeft weight="bold" className="h-3.5 w-3.5" />
    </button>
  );
}

function MenuButton({ onOpen }: { onOpen: (button: HTMLButtonElement) => void }) {
  const t = useTranslations("crmMessage.actions");
  return (
    <button
      type="button"
      aria-haspopup="menu"
      onClick={(event) => onOpen(event.currentTarget)}
      className={REPLY_BUTTON}
      aria-label={t("open")}
    >
      <DotsThree weight="bold" className="h-3.5 w-3.5" />
    </button>
  );
}

interface HoverActionsProps {
  message: ConversationMessage;
  menuAvailable: boolean;
  onOpenMenu: (button: HTMLButtonElement) => void;
}

function HoverActions({ message, menuAvailable, onOpenMenu }: HoverActionsProps) {
  return (
    <>
      <ReplyButton message={message} />
      {menuAvailable ? <MenuButton onOpen={onOpenMenu} /> : null}
    </>
  );
}

function QuotedMessage({ replyToId }: { replyToId: string }) {
  const t = useTranslations("crmConversation.thread");
  const { messagesById, onJumpToMessage, canSeekOriginal } = useThreadRow();
  const original = messagesById.get(replyToId);

  if (original) {
    return (
      <button
        type="button"
        onClick={() => onJumpToMessage(original.id)}
        className="mb-1 w-full rounded-lg bg-black/5 px-2.5 py-1.5 text-left border-l-[3px] border-info hover:bg-black/[0.08] transition-colors"
      >
        <p className="text-2xs font-semibold text-primary-ink truncate">{original.sender_name || original.from}</p>
        <p className="text-2xs text-muted-foreground truncate">
          {original.media_type ? `📎 ${t(`media.${mediaLabelKey(original.media_type)}`)}` : original.text || "..."}
        </p>
      </button>
    );
  }

  if (canSeekOriginal) {
    return (
      <button
        type="button"
        onClick={() => onJumpToMessage(replyToId)}
        className="mb-1 w-full rounded-lg bg-black/5 px-2.5 py-1.5 text-left border-l-[3px] border-foreground/20 hover:bg-black/[0.08] transition-colors"
      >
        <p className="text-2xs text-muted-foreground italic">{t("originalNotLoaded")}</p>
      </button>
    );
  }

  return (
    <div className="mb-1 rounded-lg bg-black/5 px-2.5 py-1.5 border-l-[3px] border-foreground/20">
      <p className="text-2xs text-muted-foreground italic">{t("originalUnavailable")}</p>
    </div>
  );
}

function ChannelLabel({ channel, own }: { channel: string; own: boolean }) {
  return (
    <div className={cn("flex items-center gap-1 mb-1", own ? "justify-end" : "justify-start")}>
      {channel === "whatsapp" && (
        <>
          <WhatsappLogo weight="fill" className="h-2.5 w-2.5 text-healthy-ink/60" />
          <span className="text-2xs font-semibold text-healthy-ink/50">WhatsApp</span>
        </>
      )}
    </div>
  );
}

function MetaParts({ message }: { message: ConversationMessage }) {
  const metadata = (message.metadata ?? null) as Record<string, unknown> | null;
  const prefix = metaPrefix(message.channel ?? message.entry_type);
  const messageType = messageTypeOf(message);
  const referral = prefix ? readReferral(metadata, prefix) : null;
  const postback = prefix === "facebook" ? readPostback(metadata) : null;
  const sharedLink = prefix && messageType === "link_share" ? readLinkShare(metadata, prefix) : null;
  const sharedPost = prefix && messageType === "post_share" ? readPostShare(metadata, prefix) : null;

  return (
    <>
      {referral && <ReferralChip referral={referral} />}
      {postback && <PostbackChip title={postback.title} />}
      {sharedLink && <SharedLinkCard kind="link" url={sharedLink.url} title={sharedLink.title} />}
      {sharedPost && <SharedLinkCard kind="post" url={sharedPost.url} title={sharedPost.title} />}
    </>
  );
}

function PendingMediaLabel({ message }: { message: ConversationMessage }) {
  const t = useTranslations("crmConversation.thread");
  if (!message.local_send || !message.media_type) return null;
  return <p className="text-2xs text-muted-foreground">📎 {t(`media.${mediaLabelKey(message.media_type)}`)}</p>;
}

function BubbleBody({ message }: { message: ConversationMessage }) {
  const { conversation } = useThreadRow();
  const messageType = messageTypeOf(message);
  const templateCard = messageType === "template" && hasTemplateMetadata(message.metadata);
  const form = readFormBlock(message.metadata);
  const transcript = message.transcript?.trim();

  if (form?.kind === "message") return <FormMessageCard message={message} block={form} />;
  if (form?.kind === "response") return <FormResponseCard message={message} block={form} />;
  const interactive = templateCard ? null : readInteractiveMessage(message.metadata);
  if (interactive) return <InteractiveMessageCard text={message.text} interactive={interactive} />;
  const channel = message.channel ?? message.entry_type;
  const rcs = channel === "rcs" ? readRcsTranscript(message.metadata) : null;
  const sms = channel === "sms" ? readSmsTranscript(message.metadata) : null;
  if (rcs?.content.cards?.length) {
    return (
      <>
        <RcsThreadCards content={rcs.content} />
        <RcsThreadSuggestions content={rcs.content} />
      </>
    );
  }

  return (
    <>
      {messageType === "sticker" && !message.media_url && !message.media_id && <StickerPlaceholder />}

      <PendingMediaLabel message={message} />

      {(message.media_url || message.media_id) && message.media_type && (
        <MessageMedia
          type={message.media_type}
          url={message.media_url}
          mediaId={message.media_id}
          entryType={message.entry_type}
          entryId={message.entry_id}
          messageId={message.id}
          text={message.text}
          layout={message.media_layout}
        />
      )}

      {transcript ? <AudioTranscript transcript={transcript} /> : null}

      {templateCard && <TemplateBubble metadata={message.metadata as TemplateMessageMetadata} />}

      {message.location && (
        <LocationMessageCard
          messageId={message.id}
          location={message.location}
          leadId={conversation.lead_id}
          leadName={conversation.lead_name}
          leadNumber={conversation.lead_number}
        />
      )}

      {message.text && !message.location && !templateCard && (channel === "email" ? (
        <EmailMessageBody message={message} fallback={<CollapsibleMessageText text={message.text} />} />
      ) : (
        <CollapsibleMessageText text={message.text} />
      ))}

      {rcs ? <RcsThreadSuggestions content={rcs.content} /> : null}

      {sms ? <SmsSegmentsBadge segments={sms.segments} /> : null}
    </>
  );
}

export function MessageContent({ message }: { message: ConversationMessage }) {
  return (
    <>
      {message.reply_to_message_id && <QuotedMessage replyToId={message.reply_to_message_id} />}

      <MetaParts message={message} />

      <BubbleBody message={message} />
    </>
  );
}

function BubbleFooter({ message, outgoing, own, ticks }: { message: ConversationMessage; outgoing: boolean; own: boolean; ticks: boolean }) {
  const tCrm = useTranslations("crm");
  const { conversation, perspective } = useThreadRow();
  const badge = perspective === "business" ? senderBadge(message, conversation.lead_number) : null;
  const badgeKey = senderLabelKey(badge ?? undefined, message.channel ?? message.entry_type);
  const campaignName = badge === "campaign" ? emailCampaignName(message) : null;
  const badgeLabel = campaignName ? tCrm("messageSender.campaignNamed", { name: campaignName }) : badgeKey ? tCrm(badgeKey) : null;
  const prefix = metaPrefix(message.channel ?? message.entry_type);
  const metadata = (message.metadata ?? null) as Record<string, unknown> | null;
  const sentVia = prefix === "facebook" && outgoing ? readSentVia(metadata) : null;
  const isTemplate = messageTypeOf(message) === "template";

  return (
    <div className={cn("flex items-center gap-1 mt-0.5", own ? "justify-end" : "justify-start")}>
      {badge && (
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-2xs font-semibold",
            badge === "human" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {badgeLabel}
        </span>
      )}
      {sentVia && <SentViaBadge via={sentVia} />}
      {isTemplate && (
        <span className="rounded-md bg-healthy px-1.5 py-0.5 text-2xs font-semibold  text-healthy-foreground">
          {tCrm("messageSender.template")}
        </span>
      )}
      {message.edited_at && !message.retracted_at ? <EditedMark editedAt={message.edited_at} /> : null}
      <span className="text-2xs text-muted-foreground">
        <MessageTimestamp message={message} outgoing={ticks} />
      </span>
      {ticks && message.local_send?.state === "pending" && <PendingSendMark />}
      {ticks && !message.local_send && (
        <ReadReceipt read={message.read} deliveryStatus={message.delivery_status} metadata={message.metadata} />
      )}
    </div>
  );
}

function useMessageMenu(rowRef: RefObject<HTMLDivElement | null>) {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);

  const relative = (x: number, y: number) => {
    const rect = rowRef.current?.getBoundingClientRect();
    return rect ? { x: x - rect.left, y: y - rect.top } : { x: 0, y: 0 };
  };

  const openAtPointer = (event: MouseEvent<HTMLElement>) => {
    setAnchor({ ...relative(event.clientX, event.clientY), restoreFocus: event.currentTarget });
  };

  const openBeside = (element: HTMLElement, outgoing: boolean) => {
    const rect = element.getBoundingClientRect();
    const x = outgoing ? rect.right - MENU_WIDTH_PX : rect.left;
    setAnchor({ ...relative(x, rect.bottom), restoreFocus: element });
  };

  return { anchor, openAtPointer, openBeside, close: () => setAnchor(null) };
}

function opensMenu(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === "Enter" || event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
}

export function MessageBubbleRow({ row }: { row: MessageRow }) {
  const thread = useThreadRow();
  const { conversation, matchedIds, currentMatchId, arrivalStart, messageActions, onReply, onResendMessage, perspective, senderLabel } = thread;
  const { message, outgoing, groupPosition } = row;
  const direction = directionOfRow(row);
  const own = bubbleSide(direction, perspective) === "right";
  const ticks = showsDeliveryTicks(direction, perspective);
  const sourceLabel = senderLabel?.(message);
  const rowRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const menu = useMessageMenu(rowRef);
  const isGroupConversation = Boolean(conversation.is_group);
  const showSenderName = opensGroup(groupPosition) && (sourceLabel !== undefined || !outgoing);
  const showAuthorAvatar = isGroupConversation && showSenderName;
  const senderName = sourceLabel ?? (message.sender_name || message.from);
  const channelColor = message.channel === "whatsapp" ? "border-healthy" : "border-foreground/20";
  const retracted = Boolean(message.retracted_at);
  const editing = thread.editingId === message.id;
  const items = messageMenuItems(message, messageActions.actionsFor(message), {
    canReply: Boolean(onReply),
    canResend: Boolean(onResendMessage),
  });
  const menuAvailable = items.length > 0 && !editing;
  const openMenuBeside = (button: HTMLButtonElement) => menu.openBeside(button, own);

  const handleBubbleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !menuAvailable || !opensMenu(event)) return;
    event.preventDefault();
    menu.openBeside(event.currentTarget, own);
  };

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (!menuAvailable) return;
    event.preventDefault();
    menu.openAtPointer(event);
  };

  const stopEditing = () => {
    thread.onStopEdit();
    requestAnimationFrame(() => bubbleRef.current?.focus({ preventScroll: true }));
  };

  return (
    <motion.div
      ref={rowRef}
      data-msg-id={message.id}
      data-group-position={groupPosition}
      initial={arrivalStart(message.id)}
      animate={{ opacity: 1 }}
      transition={arrivalTransition}
      className={cn(
        "group/msg relative flex items-center gap-1",
        own ? "justify-end" : "justify-start",
        joinedEdges(groupPosition).top ? "pt-[1px]" : "pt-1",
        message.reactions?.length ? "mb-3" : null,
      )}
    >
      {own && !editing && <HoverActions message={message} menuAvailable={menuAvailable} onOpenMenu={openMenuBeside} />}
      {isGroupConversation && !own && (
        <div className="size-8 shrink-0 self-start">
          {showAuthorAvatar && <ChannelAvatar name={senderName} pictureUrl={message.sender_avatar} size="sm" />}
        </div>
      )}
      <div
        ref={bubbleRef}
        data-bubble=""
        tabIndex={menuAvailable ? 0 : undefined}
        aria-haspopup={menuAvailable ? "menu" : undefined}
        aria-keyshortcuts={menuAvailable ? "Enter Shift+F10" : undefined}
        onKeyDown={handleBubbleKeyDown}
        onContextMenu={handleContextMenu}
        className={cn(
          "relative max-w-[75%] rounded-lg px-3 py-2 shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          matchedIds.has(message.id) && "ring-2 ring-warning ring-offset-1 bg-muted",
          currentMatchId === message.id && "ring-2 ring-healthy ring-offset-2",
          own
            ? "bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef] border-r-[3px]"
            : "bg-card text-foreground border-l-[3px]",
          channelColor,
          bubbleCorners(groupPosition, own),
        )}
      >
        {row.channelRunStart && <ChannelLabel channel={message.channel ?? ""} own={own} />}

        {showSenderName && <p className="text-2xs font-semibold mb-0.5 text-healthy-ink">{senderName}</p>}

        {retracted ? (
          <RetractedNotice outgoing={outgoing} />
        ) : editing ? (
          <MessageEditor
            initialText={message.text}
            onCancel={stopEditing}
            onSave={(text) => {
              messageActions.edit(message, text);
              stopEditing();
            }}
          />
        ) : (
          <MessageContent message={message} />
        )}

        <ReactionChips message={message} own={own} />

        <BubbleFooter message={message} outgoing={outgoing} own={own} ticks={ticks} />

        {message.channel === "mercadolivre" && !retracted ? <MercadoLivreMessageMarks message={message} outgoing={outgoing} /> : null}

        <SendFailure message={message} />
      </div>
      {!own && !editing && <HoverActions message={message} menuAvailable={menuAvailable} onOpenMenu={openMenuBeside} />}
      {menuAvailable ? (
        <MessageActionsMenu
          message={message}
          items={items}
          anchor={menu.anchor}
          onClose={menu.close}
          handlers={{
            onReply: () => onReply?.(message),
            onReact: (emoji) => messageActions.react(message, emoji),
            onEdit: () => thread.onStartEdit(message.id),
            onResend: () => onResendMessage?.(message.id),
            onDelete: () => messageActions.remove(message),
          }}
        />
      ) : null}
    </motion.div>
  );
}
