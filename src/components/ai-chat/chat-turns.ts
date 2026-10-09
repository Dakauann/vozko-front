import { getChatMessagesAction, stopChatTurnAction } from "@/app/actions/aichat";
import { chatStreams, readChatStream, type ChatStreamRequest, type StreamHandlers, type StreamOutcome } from "@/lib/aichat/chat-stream";
import { toolStartFrame } from "@/lib/aichat/generating-media";
import { chatTurns } from "@/lib/aichat/turn-store";
import type { PendingAction } from "@/lib/aichat/types";
import { hydrate, type UIMessage } from "@/lib/aichat/ui-message";

import { answerScreenCommand, endScreenTurn } from "./screen-bridge";

export interface TurnStart {
  request: ChatStreamRequest;
  open: (messages: UIMessage[]) => UIMessage[];
  approved?: PendingAction;
}

export type OpenedThread = "live" | "loaded" | "missing";

export const REATTACH_LIMIT = 20;
export const REATTACH_DELAY_MS = 250;
const MAX_REATTACH_DELAY_MS = 3000;

function turnHandlers(threadId: string, approved?: PendingAction): StreamHandlers {
  return {
    onReasoning: (text) => chatTurns.apply(threadId, { kind: "reasoning", text }),
    onReasoningDone: () => chatTurns.apply(threadId, { kind: "reasoning_done" }),
    onToolStart: (name) => chatTurns.apply(threadId, { kind: "tool_start", name, frame: toolStartFrame(name, approved) }),
    onTool: (name, summary, ok, subject) => chatTurns.apply(threadId, { kind: "tool", name, summary, ok, subject }),
    onChart: (chart) => chatTurns.apply(threadId, { kind: "chart", chart }),
    onCard: (card) => chatTurns.apply(threadId, { kind: "card", card }),
    onImage: (media) => chatTurns.apply(threadId, { kind: "media", media }),
    onDelta: (text) => chatTurns.apply(threadId, { kind: "delta", text }),
    onProposal: (action) => chatTurns.apply(threadId, { kind: "proposal", action }),
    onAwaitingApproval: () => chatTurns.apply(threadId, { kind: "finalize" }),
    onScreenCommand: (command) => void answerScreenCommand(threadId, command),
    onError: (message) => {
      chatTurns.apply(threadId, { kind: "finalize" });
      chatTurns.fail(threadId, message);
      endScreenTurn();
    },
    onDone: () => {
      chatTurns.apply(threadId, { kind: "finalize" });
      endScreenTurn();
    },
  };
}

async function runTurn(threadId: string, { request, open, approved }: TurnStart): Promise<StreamOutcome | "busy"> {
  const signal = chatTurns.begin(threadId);
  if (!signal) return "busy";
  chatTurns.update(threadId, open);
  try {
    return await readChatStream(request, turnHandlers(threadId, approved), signal);
  } finally {
    chatTurns.end(threadId);
  }
}

function liveReply(): UIMessage {
  const now = new Date().toISOString();
  return { id: `a-live-${now}`, role: "assistant", content: "", createdAt: now, segments: [] };
}

export async function refreshThread(threadId: string): Promise<boolean> {
  const { data } = await getChatMessagesAction(threadId);
  if (!data) return false;
  chatTurns.load(threadId, data.items.map(hydrate));
  return true;
}

async function watchTurn(threadId: string, attempt: number): Promise<void> {
  const outcome = await runTurn(threadId, { request: chatStreams.observe(threadId), open: (messages) => [...messages, liveReply()] });
  if (outcome === "missing") await refreshThread(threadId);
  if (outcome === "detached" && attempt < REATTACH_LIMIT) await reattach(threadId, attempt + 1);
}

async function reattach(threadId: string, attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.min(REATTACH_DELAY_MS * attempt, MAX_REATTACH_DELAY_MS)));
  await loadThread(threadId, attempt);
}

async function loadThread(threadId: string, attempt: number): Promise<OpenedThread> {
  if (chatTurns.isStreaming(threadId)) return "live";
  const { data } = await getChatMessagesAction(threadId);
  if (!data) return "missing";
  if (!chatTurns.load(threadId, data.items.map(hydrate))) return "live";
  if (data.running) void watchTurn(threadId, attempt);
  return "loaded";
}

export function openThread(threadId: string): Promise<OpenedThread> {
  return loadThread(threadId, 0);
}

export async function startTurn(threadId: string, start: TurnStart): Promise<boolean> {
  const outcome = await runTurn(threadId, start);
  if (outcome === "busy") return false;
  if (outcome === "detached") await openThread(threadId);
  return true;
}

export async function stopTurn(threadId: string): Promise<void> {
  if (!chatTurns.isStreaming(threadId)) return;
  await stopChatTurnAction(threadId);
  chatTurns.abort(threadId);
}
