"use client";

import { CHAT_AUTHOR, CHAT_OWN_CONTENT, chatBubbleClass, chatMetaClass, chatRowClass } from "@/components/chat/chat-styles";
import { opensGroup } from "@/lib/chat/message-groups";
import { bubbleSide, directionOfRow } from "@/lib/conversations/bubble-side";
import type { ThreadRow } from "@/lib/conversations/thread-rows";

import { InteractiveMessageActions } from "./InteractiveMessageCard";
import { MessageContent } from "./MessageBubbleRow";
import { MessageTimestamp } from "./message-parts";
import { EditedMark } from "./message-states";
import { useThreadRow } from "./thread-context";

type MessageRow = Extract<ThreadRow, { kind: "message" }>;

export function ChatMessageRow({ row }: { row: MessageRow }) {
  const { perspective, senderLabel } = useThreadRow();
  const { message, groupPosition } = row;
  const own = bubbleSide(directionOfRow(row), perspective) === "right";
  const author = !own && opensGroup(groupPosition) ? (senderLabel?.(message) ?? (message.sender_name || message.from)) : null;

  return (
    <div data-msg-id={message.id} data-group-position={groupPosition} className={chatRowClass(own, groupPosition)}>
      <div data-bubble="" className={chatBubbleClass(own, groupPosition)}>
        {author ? <p className={CHAT_AUTHOR}>{author}</p> : null}
        <div className={own ? CHAT_OWN_CONTENT : undefined}>
          <MessageContent message={message} />
        </div>
        <p className={chatMetaClass(own)}>
          {message.edited_at ? <EditedMark editedAt={message.edited_at} /> : null}
          <MessageTimestamp message={message} outgoing={false} />
        </p>
        {message.interactive && !message.retracted_at ? <InteractiveMessageActions message={message} content={message.interactive} /> : null}
      </div>
    </div>
  );
}
