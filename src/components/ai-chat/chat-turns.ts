import { getChatMessagesAction, queueChatMessageAction, stopChatTurnAction, unqueueChatMessageAction } from "@/app/actions/aichat";
import { chatStreams, readChatStream, type ChatStreamRequest, type StreamHandlers, type StreamOutcome } from "@/lib/aichat/chat-stream";
import { toolStartFrame } from "@/lib/aichat/generating-media";
import { addQueued, queuedAsUser, queuedListFrom, removeQueued, restoreQueued, withoutQueued, type QueuedMessage } from "@/lib/aichat/queue";
import { chatTurns } from "@/lib/aichat/turn-store";
import type { ChatMessageList, PendingAction } from "@/lib/aichat/types";
import { hydrate, type UIMessage } from "@/lib/aichat/ui-message";

import { answerScreenCommand, endScreenTurn, receiveScreenGo } from "./screen-bridge";

export interface TurnStart {
  request: ChatStreamRequest;
  open: (messages: UIMessage[]) => UIMessage[];
  approved?: PendingAction;
}

export type OpenedThread = "live" | "loaded" | "missing";

export const REATTACH_LIMIT = 20;
export const REATTACH_DELAY_MS = 250;
const MAX_REATTACH_DELAY_MS = 3000;

interface TurnRun {
  outcome: StreamOutcome | "busy";
  delivered: boolean;
}

function turnHandlers(threadId: string, run: TurnRun, approved?: PendingAction): StreamHandlers {
  return {
    onReasoning: (text) => chatTurns.apply(threadId, { kind: "reasoning", text }),
    onReasoningDone: () => chatTurns.apply(threadId, { kind: "reasoning_done" }),
    onRetry: (retraction) => chatTurns.apply(threadId, { kind: "retract", ...retraction }),
    onToolStart: (name) => chatTurns.apply(threadId, { kind: "tool_start", name, frame: toolStartFrame(name, approved) }),
    onTool: (name, summary, ok, subject) => chatTurns.apply(threadId, { kind: "tool", name, summary, ok, subject }),
    onChart: (chart) => chatTurns.apply(threadId, { kind: "chart", chart }),
    onCard: (card) => {
      chatTurns.apply(threadId, { kind: "card", card });
      if (card.kind === "studio_project" && card.studioProject.projectId) chatTurns.bindProject(threadId, card.studioProject.projectId);
    },
    onImage: (media) => chatTurns.apply(threadId, { kind: "media", media }),
    onDelta: (text) => chatTurns.apply(threadId, { kind: "delta", text }),
    onProposal: (action) => chatTurns.apply(threadId, { kind: "proposal", action }),
    onAwaitingApproval: () => chatTurns.apply(threadId, { kind: "finalize" }),
    onScreenCommand: (command) => void answerScreenCommand(threadId, command),
    onScreenGo: receiveScreenGo,
    onQueued: (item) => chatTurns.queue(threadId, (queued) => addQueued(queued, item)),
    onUnqueued: (clientId) => chatTurns.queue(threadId, (queued) => removeQueued(queued, clientId)),
    onDelivered: (items) => {
      run.delivered = true;
      chatTurns.apply(threadId, { kind: "delivered", messages: items.map(queuedAsUser) });
      chatTurns.queue(threadId, (queued) => withoutQueued(queued, items.map((item) => item.clientId)));
    },
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

async function runTurn(threadId: string, { request, open, approved }: TurnStart): Promise<TurnRun> {
  const run: TurnRun = { outcome: "busy", delivered: false };
  const signal = chatTurns.begin(threadId);
  if (!signal) return run;
  chatTurns.update(threadId, open);
  try {
    run.outcome = await readChatStream(request, turnHandlers(threadId, run, approved), signal);
    return run;
  } finally {
    chatTurns.end(threadId);
  }
}

function liveReply(): UIMessage {
  const now = new Date().toISOString();
  return { id: `a-live-${now}`, role: "assistant", content: "", createdAt: now, segments: [] };
}

let lifetime = 0;

export function closeTurns(): void {
  lifetime += 1;
  chatTurns.abortAll();
}

function loadInto(threadId: string, data: ChatMessageList): boolean {
  chatTurns.bindProject(threadId, data.projectId || null);
  if (!chatTurns.load(threadId, data.items.map(hydrate))) return false;
  chatTurns.queue(threadId, () => queuedListFrom(data.queued));
  return true;
}

export async function learnProject(threadId: string): Promise<void> {
  const { data } = await getChatMessagesAction(threadId);
  if (data) chatTurns.bindProject(threadId, data.projectId || null);
}

export async function refreshThread(threadId: string): Promise<boolean> {
  const { data } = await getChatMessagesAction(threadId);
  if (!data) return false;
  loadInto(threadId, data);
  return true;
}

async function watchTurn(threadId: string, attempt: number): Promise<void> {
  const generation = lifetime;
  const { outcome, delivered } = await runTurn(threadId, { request: chatStreams.observe(threadId), open: (messages) => [...messages, liveReply()] });
  if (outcome === "missing" || (outcome === "finished" && delivered)) await refreshThread(threadId);
  if (outcome === "detached" && attempt < REATTACH_LIMIT) await reattach(threadId, attempt + 1, generation);
}

async function reattach(threadId: string, attempt: number, generation: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.min(REATTACH_DELAY_MS * attempt, MAX_REATTACH_DELAY_MS)));
  if (generation !== lifetime) return;
  await loadThread(threadId, attempt);
}

async function loadThread(threadId: string, attempt: number): Promise<OpenedThread> {
  if (chatTurns.isStreaming(threadId)) return "live";
  const { data } = await getChatMessagesAction(threadId);
  if (!data) return "missing";
  if (!loadInto(threadId, data)) return "live";
  if (data.running) void watchTurn(threadId, attempt);
  return "loaded";
}

export function openThread(threadId: string): Promise<OpenedThread> {
  return loadThread(threadId, 0);
}

export async function startTurn(threadId: string, start: TurnStart): Promise<boolean> {
  const generation = lifetime;
  const { outcome } = await runTurn(threadId, start);
  if (outcome === "busy") return false;
  if (outcome === "detached" && generation === lifetime) await openThread(threadId);
  return true;
}

export async function stopTurn(threadId: string): Promise<void> {
  if (!chatTurns.isStreaming(threadId)) return;
  await stopChatTurnAction(threadId);
  chatTurns.abort(threadId);
}

export type QueueResult = { outcome: "queued" } | { outcome: "idle" } | { outcome: "failed"; error: string };

export async function queueMessage(threadId: string, item: QueuedMessage): Promise<QueueResult> {
  chatTurns.queue(threadId, (queued) => addQueued(queued, item));
  const { error } = await queueChatMessageAction(threadId, {
    clientId: item.clientId,
    content: item.content,
    attachments: (item.attachments ?? []).map((a) => a.mediaId),
  });
  if (!error) return { outcome: "queued" };
  chatTurns.queue(threadId, (queued) => removeQueued(queued, item.clientId));
  if (error.code === "turn_not_running") return { outcome: "idle" };
  return { outcome: "failed", error: error.message };
}

export async function unqueueMessage(threadId: string, clientId: string): Promise<string | null> {
  const removed = chatTurns.snapshot(threadId).queued.find((q) => q.clientId === clientId);
  chatTurns.queue(threadId, (queued) => removeQueued(queued, clientId));
  const { error } = await unqueueChatMessageAction(threadId, clientId);
  if (!error || error.code === "queued_message_gone") return null;
  if (removed) chatTurns.queue(threadId, (queued) => restoreQueued(queued, removed));
  return error.message;
}

export function takeQueued(threadId: string): UIMessage[] {
  const queued = chatTurns.snapshot(threadId).queued;
  chatTurns.queue(threadId, () => []);
  return queued.map(queuedAsUser);
}
