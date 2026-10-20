"use client";

import type { ComponentType } from "react";

import type { ThreadRow, ThreadRowKind } from "@/lib/conversations/thread-rows";

import { AgentToolCallRow } from "./AgentToolCallRow";
import { CallEventRow, CallPermissionRow, LikeStickerRow, StoryRow, SystemRow, UnsupportedRow } from "./event-rows";
import { DayRow, UnreadDividerRow } from "./marker-rows";
import { MessageBubbleRow } from "./MessageBubbleRow";
import { NoteRow } from "./NoteRow";
import { ToolEventRow } from "./ToolEventRow";

type RowRenderers = { [K in ThreadRowKind]: ComponentType<{ row: Extract<ThreadRow, { kind: K }> }> };

const ROW_RENDERERS: RowRenderers = {
  day: DayRow,
  "unread-divider": UnreadDividerRow,
  message: MessageBubbleRow,
  note: NoteRow,
  "agent-tool-call": AgentToolCallRow,
  tool: ToolEventRow,
  system: SystemRow,
  call: CallEventRow,
  "call-permission": CallPermissionRow,
  story: StoryRow,
  unsupported: UnsupportedRow,
  "like-sticker": LikeStickerRow,
};

export function ThreadRowView({ row }: { row: ThreadRow }) {
  const Renderer = ROW_RENDERERS[row.kind] as ComponentType<{ row: ThreadRow }>;
  return <Renderer row={row} />;
}
